-- CRM record deletion
--
-- Lets any active employee permanently delete a lead or a customer they can
-- already access (a representative: records assigned to them; an administrator:
-- any). Deletion goes through this function, called only by the manage-lead
-- Edge Function, which derives the actor from the session. The browser still
-- has no DELETE privilege on these tables.
--
-- Safeguards:
--   * A lead that became a deal, and a customer with deals, quotes, contracts,
--     or sent marketing on record, cannot be deleted. That history backs sales
--     attribution; the customer can be marked inactive instead.
--   * A full copy of everything removed is written to private.audit_log in the
--     same transaction, so an administrator can recover a mistaken deletion.
--   * Deleting a lead leaves a note on the customer's timeline.
--
-- Deleting a customer cascades (existing foreign keys) to their leads,
-- follow-ups, and timeline. Deleting a lead cascades to its follow-ups and
-- timeline entries.

grant delete on public.leads, public.contacts to service_role;
grant select on public.contracts, public.marketing_sends, public.activities to service_role;

create or replace function public.delete_crm_record(
  p_actor_employee_id uuid,
  p_kind text,
  p_record_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_record public.employees%rowtype;
  lead_record public.leads%rowtype;
  contact_record public.contacts%rowtype;
  v_snapshot jsonb;
  v_leads integer := 0;
  v_tasks integer := 0;
  v_activities integer := 0;
begin
  -- Share the ownership lock so a delete cannot interleave with a transfer or reassignment.
  perform pg_advisory_xact_lock(20260917, 1);

  select * into actor_record
  from public.employees
  where id = p_actor_employee_id and active = true
  for share;
  if actor_record.id is null or actor_record.role not in ('admin', 'sales_rep') then
    raise exception 'An active employee account is required' using errcode = '42501';
  end if;
  if p_record_id is null or p_kind is null or p_kind not in ('lead', 'contact') then
    raise exception 'Choose a lead or customer to delete' using errcode = '22023';
  end if;

  if p_kind = 'lead' then
    select * into lead_record from public.leads where id = p_record_id for update;
    if lead_record.id is null then
      raise exception 'Lead not found' using errcode = 'P0002';
    end if;
    if actor_record.role <> 'admin' and lead_record.assigned_employee_id is distinct from actor_record.id then
      raise exception 'You can only delete leads assigned to you' using errcode = '42501';
    end if;
    if lead_record.status = 'converted' or exists (select 1 from public.deals d where d.lead_id = lead_record.id) then
      raise exception 'This lead became a deal and is part of its history. It cannot be deleted.' using errcode = '22023';
    end if;

    select * into contact_record from public.contacts where id = lead_record.contact_id;
    select count(*) into v_tasks from public.tasks t where t.lead_id = lead_record.id;
    select count(*) into v_activities from public.activities a where a.lead_id = lead_record.id;
    v_snapshot := jsonb_build_object(
      'lead', to_jsonb(lead_record),
      'contact', jsonb_build_object('id', contact_record.id, 'display_name', contact_record.display_name, 'email', contact_record.email),
      'tasks', coalesce((select jsonb_agg(to_jsonb(t)) from public.tasks t where t.lead_id = lead_record.id), '[]'::jsonb),
      'activities', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.activities a where a.lead_id = lead_record.id), '[]'::jsonb)
    );

    insert into private.audit_log (actor_employee_id, action, entity_type, entity_id, metadata)
    values (actor_record.id, 'lead_deleted', 'lead', lead_record.id, v_snapshot);

    delete from public.leads where id = lead_record.id;

    insert into public.activities (contact_id, employee_id, activity_type, title, description, metadata)
    values (
      contact_record.id, actor_record.id, 'status_changed', 'Lead deleted',
      concat_ws(' · ', nullif(lead_record.project_type, ''), nullif(lead_record.project_location, ''), replace(lead_record.status, '_', ' ')),
      jsonb_build_object('deleted_lead_id', lead_record.id, 'tasks_removed', v_tasks, 'timeline_entries_removed', v_activities)
    );

    return jsonb_build_object(
      'deleted', true, 'kind', 'lead', 'id', lead_record.id, 'contact_id', contact_record.id,
      'tasks_removed', v_tasks, 'message', 'Lead deleted.'
    );
  end if;

  select * into contact_record from public.contacts where id = p_record_id for update;
  if contact_record.id is null then
    raise exception 'Customer not found' using errcode = 'P0002';
  end if;
  if actor_record.role <> 'admin' and (
    contact_record.assigned_employee_id is distinct from actor_record.id
    or exists (select 1 from public.leads l where l.contact_id = contact_record.id and l.assigned_employee_id is distinct from actor_record.id)
  ) then
    raise exception 'You can only delete customers assigned to you' using errcode = '42501';
  end if;
  if exists (select 1 from public.deals d where d.contact_id = contact_record.id)
    or exists (select 1 from public.quotes q where q.contact_id = contact_record.id)
    or exists (select 1 from public.contracts c where c.contact_id = contact_record.id)
    or exists (select 1 from public.marketing_sends m where m.contact_id = contact_record.id) then
    raise exception 'This customer has deals, quotes, contracts, or sent marketing on record and cannot be deleted. Mark them inactive instead.' using errcode = '22023';
  end if;

  select count(*) into v_leads from public.leads l where l.contact_id = contact_record.id;
  select count(*) into v_tasks from public.tasks t
  where t.contact_id = contact_record.id or t.lead_id in (select l.id from public.leads l where l.contact_id = contact_record.id);
  v_snapshot := jsonb_build_object(
    'contact', to_jsonb(contact_record),
    'leads', coalesce((select jsonb_agg(to_jsonb(l)) from public.leads l where l.contact_id = contact_record.id), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(t)) from public.tasks t
      where t.contact_id = contact_record.id or t.lead_id in (select l.id from public.leads l where l.contact_id = contact_record.id)), '[]'::jsonb),
    'activities', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.activities a
      where a.contact_id = contact_record.id or a.lead_id in (select l.id from public.leads l where l.contact_id = contact_record.id)), '[]'::jsonb)
  );

  insert into private.audit_log (actor_employee_id, action, entity_type, entity_id, metadata)
  values (actor_record.id, 'contact_deleted', 'contact', contact_record.id, v_snapshot);

  delete from public.contacts where id = contact_record.id;

  return jsonb_build_object(
    'deleted', true, 'kind', 'contact', 'id', contact_record.id,
    'leads_removed', v_leads, 'tasks_removed', v_tasks, 'message', 'Customer deleted.'
  );
end;
$$;

revoke all on function public.delete_crm_record(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.delete_crm_record(uuid, text, uuid) to service_role;
