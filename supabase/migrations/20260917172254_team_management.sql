-- Team reporting uses invoker rights: normal RLS remains authoritative.
create or replace function public.admin_team_overview()
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if not coalesce(private.current_employee_is_admin(), false) then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'employees', (select coalesce(jsonb_agg(e.data order by e.data->>'display_name'), '[]'::jsonb) from (
      select jsonb_build_object(
        'id', emp.id, 'display_name', emp.display_name, 'first_name', emp.first_name,
        'last_name', emp.last_name, 'email', emp.email, 'phone', emp.phone,
        'role', emp.role, 'rep_code', emp.rep_code, 'active', emp.active,
        'linked', emp.auth_user_id is not null,
        'contacts', (select count(*) from public.contacts c where c.assigned_employee_id = emp.id),
        'leads', (select count(*) from public.leads l where l.assigned_employee_id = emp.id and l.status not in ('converted','lost','archived')),
        'deals', (select count(*) from public.deals d where d.sales_rep_id = emp.id and d.status in ('open','on_hold')),
        'tasks', (select count(*) from public.tasks t where t.employee_id = emp.id and t.status = 'open'),
        'overdue', (select count(*) from public.tasks t where t.employee_id = emp.id and t.status = 'open' and t.due_at < now()),
        'units_sold', (select count(*) from public.unit_sales u where u.employee_id = emp.id),
        'last_activity_at', (select max(a.created_at) from public.activities a where a.employee_id = emp.id and not (a.activity_type = 'lead_created' and a.title = 'Website consultation received'))
      ) as data from public.employees emp
    ) e),
    'unassigned_contacts', (select count(*) from public.contacts where assigned_employee_id is null),
    'unassigned_leads', (select count(*) from public.leads where assigned_employee_id is null and status not in ('converted','lost','archived')),
    'as_of', now()
  );
end;
$$;

create or replace function public.portal_dashboard_summary()
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if private.current_employee_id() is null then
    raise exception 'Active employee access is required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'leads', (select count(*) from public.leads where status not in ('converted','lost','archived')),
    'new_leads', (select count(*) from public.leads where status = 'new'),
    'tasks', (select count(*) from public.tasks where status = 'open'),
    'due_tasks', (select count(*) from public.tasks where status = 'open' and due_at <= now()),
    'quotes', (select count(*) from public.quotes where status in ('draft','sent')),
    'contracts', (select count(*) from public.contracts),
    'units_sold', (select count(*) from public.unit_sales)
  );
end;
$$;
revoke all on function public.admin_team_overview() from public, anon;
revoke all on function public.portal_dashboard_summary() from public, anon;
grant execute on function public.admin_team_overview(), public.portal_dashboard_summary() to authenticated;

-- Only the authenticated Edge Function may supply the actor to these mutations.
-- Remove the direct browser write path that bypassed the audit/safety checks.
grant usage on schema public, private to service_role;
grant select, insert, update on public.employees, public.contacts, public.leads, public.deals, public.tasks, public.quotes to service_role;
grant insert on public.activities, private.audit_log to service_role;
grant usage, select on sequence public.employee_rep_code_seq, public.deal_number_seq to service_role;
revoke insert, update, delete on public.employees from authenticated;
create or replace function public.admin_manage_employee(
  p_actor_employee_id uuid, p_action text, p_employee jsonb default null, p_employee_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_before public.employees;
  v_after public.employees;
  v_role text;
  v_first text;
  v_last text;
begin
  -- Serialize access changes, including the actor check, to prevent concurrent lockouts.
  perform pg_advisory_xact_lock(20260917, 1);
  if not exists (select 1 from public.employees where id = p_actor_employee_id and active and role = 'admin') then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if p_action not in ('create','update','activate','deactivate') or p_action is null then
    raise exception 'Unsupported employee action.';
  end if;
  if p_action in ('create','update') then
    v_first := trim(coalesce(p_employee->>'first_name',''));
    v_last := trim(coalesce(p_employee->>'last_name',''));
    v_role := p_employee->>'role';
    if length(v_first) not between 1 and 100 or length(v_last) not between 1 and 100
      or v_role is null or v_role not in ('admin','sales_rep') then
      raise exception 'A first name, last name, and valid role are required.';
    end if;
  end if;
  if p_action = 'create' then
    if coalesce(p_employee->>'email','') !~* '^[^@\s]+@cmaccontainers\.com$' then
      raise exception 'Use a cmaccontainers.com employee email.';
    end if;
    insert into public.employees(email,first_name,last_name,display_name,role)
      values(lower(trim(p_employee->>'email'))::extensions.citext,v_first,v_last,v_first || ' ' || v_last,v_role)
      returning * into v_after;
  else
    select * into v_before from public.employees where id = p_employee_id for update;
    if not found then raise exception 'Employee not found.'; end if;
    if p_employee_id = p_actor_employee_id and (p_action = 'deactivate' or (p_action = 'update' and v_role <> 'admin')) then
      raise exception 'You cannot remove your own administrator access.';
    end if;
    if v_before.active and v_before.role = 'admin' and (p_action = 'deactivate' or (p_action = 'update' and v_role <> 'admin'))
      and not exists (select 1 from public.employees where active and role = 'admin' and id <> p_employee_id) then
      raise exception 'At least one active administrator must remain.';
    end if;
    if p_action = 'update' then
      update public.employees set first_name = v_first, last_name = v_last,
        display_name = v_first || ' ' || v_last, role = v_role,
        phone = nullif(left(trim(p_employee->>'phone'),50),'')
        where id = p_employee_id returning * into v_after;
    else
      update public.employees set active = (p_action = 'activate') where id = p_employee_id returning * into v_after;
    end if;
  end if;
  insert into private.audit_log(actor_employee_id,action,entity_type,entity_id,metadata)
    values(p_actor_employee_id,'employee_' || p_action,'employee',v_after.id,
      jsonb_build_object('previous_role',v_before.role,'role',v_after.role,'previous_active',v_before.active,'active',v_after.active));
  return jsonb_build_object('employee_id',v_after.id,'display_name',v_after.display_name,'role',v_after.role,'active',v_after.active);
end;
$$;
revoke all on function public.admin_manage_employee(uuid,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.admin_manage_employee(uuid,text,jsonb,uuid) to service_role;

create or replace function public.admin_reassign_contact(
  p_actor_employee_id uuid, p_contact_id uuid, p_employee_id uuid, p_expected_owner_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_contact public.contacts;
  v_target public.employees;
  v_previous_name text;
  v_counts jsonb;
  v_leads int; v_deals int; v_tasks int; v_quotes int;
begin
  perform pg_advisory_xact_lock(20260917, 1);
  if not exists (select 1 from public.employees where id = p_actor_employee_id and active and role = 'admin') then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  select * into v_target from public.employees where id = p_employee_id and active;
  if not found then raise exception 'Choose an active employee.'; end if;
  select * into v_contact from public.contacts where id = p_contact_id for update;
  if not found then raise exception 'Customer not found.'; end if;
  if v_contact.assigned_employee_id = p_employee_id then
    return jsonb_build_object('unchanged',true);
  end if;
  if v_contact.assigned_employee_id is distinct from p_expected_owner_id then
    raise exception 'Ownership changed since this page was opened. Refresh and try again.';
  end if;
  select display_name into v_previous_name from public.employees where id = v_contact.assigned_employee_id;
  update public.contacts set assigned_employee_id = p_employee_id where id = p_contact_id;
  update public.leads set assigned_employee_id = p_employee_id where contact_id = p_contact_id and status not in ('converted','lost','archived');
  get diagnostics v_leads = row_count;
  update public.deals set sales_rep_id = p_employee_id where contact_id = p_contact_id and status in ('open','on_hold');
  get diagnostics v_deals = row_count;
  update public.tasks set employee_id = p_employee_id where status = 'open' and (
    contact_id = p_contact_id or lead_id in (select id from public.leads where contact_id = p_contact_id)
    or deal_id in (select id from public.deals where contact_id = p_contact_id));
  get diagnostics v_tasks = row_count;
  update public.quotes set employee_id = p_employee_id where contact_id = p_contact_id and status in ('draft','sent')
    and deal_id in (select id from public.deals where contact_id = p_contact_id and status in ('open','on_hold'));
  get diagnostics v_quotes = row_count;
  v_counts := jsonb_build_object('leads',v_leads,'deals',v_deals,'tasks',v_tasks,'quotes',v_quotes);
  insert into public.activities(contact_id,employee_id,activity_type,title,description,metadata)
    values(p_contact_id,p_actor_employee_id,'lead_assigned','Customer ownership transferred',
      coalesce(v_previous_name,'Unassigned') || ' → ' || v_target.display_name || '. Open work transferred; completed history retained.',
      v_counts || jsonb_build_object('previous_employee_id',v_contact.assigned_employee_id,'assigned_employee_id',p_employee_id));
  insert into private.audit_log(actor_employee_id,action,entity_type,entity_id,metadata)
    values(p_actor_employee_id,'contact_reassigned','contact',p_contact_id,
      v_counts || jsonb_build_object('previous_employee_id',v_contact.assigned_employee_id,'assigned_employee_id',p_employee_id));
  return v_counts;
end;
$$;
revoke all on function public.admin_reassign_contact(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_reassign_contact(uuid,uuid,uuid,uuid) to service_role;

-- Follow-up lifecycle events were missing from the activity stream.
create or replace function private.record_task_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.contact_id is null and new.lead_id is null and new.deal_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  insert into public.activities(contact_id,lead_id,deal_id,employee_id,activity_type,title,description,metadata)
    values(new.contact_id,new.lead_id,new.deal_id,coalesce(private.current_employee_id(),new.employee_id),
      case when tg_op = 'INSERT' then 'follow_up_created' else 'status_changed' end,
      case when tg_op = 'INSERT' then 'Follow-up scheduled' else 'Follow-up ' || new.status end,
      new.title,jsonb_build_object('task_id',new.id,'assigned_employee_id',new.employee_id,'due_at',new.due_at));
  return new;
end;
$$;
revoke all on function private.record_task_activity() from public, anon, authenticated;
drop trigger if exists task_activity_recorded on public.tasks;
create trigger task_activity_recorded after insert or update of status on public.tasks
  for each row execute function private.record_task_activity();

create index if not exists activities_employee_created_idx on public.activities(employee_id,created_at desc);
create index if not exists tasks_employee_status_due_idx on public.tasks(employee_id,status,due_at);

-- Ownership transfers must use the audited server transaction, not a table PATCH.
revoke update on public.contacts from authenticated;
grant update(first_name,last_name,display_name,email,phone,company,project_address,billing_address,city,state,postal_code,lifecycle_stage) on public.contacts to authenticated;
drop policy activity_insert_related on public.activities;
create policy activity_insert_related on public.activities for insert to authenticated with check (
  employee_id = (select private.current_employee_id())
  and (contact_id is null or (select private.can_access_contact(contact_id)))
  and (lead_id is null or (select private.can_access_lead(lead_id)))
  and (deal_id is null or (select private.can_access_deal(deal_id)))
);
drop policy task_owner_or_admin_all on public.tasks;
create policy task_owner_or_admin_all on public.tasks for all to authenticated
using (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
with check (
  (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
  and (contact_id is null or (select private.can_access_contact(contact_id)))
  and (lead_id is null or (select private.can_access_lead(lead_id)))
  and (deal_id is null or (select private.can_access_deal(deal_id)))
);

create or replace function private.record_transaction_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := private.current_employee_id();
  v_row jsonb := to_jsonb(new);
  v_old jsonb;
begin
  -- Edge workflows write their own richer events; this covers direct portal saves.
  if v_actor is null then return new; end if;
  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    if (v_row - 'updated_at') is not distinct from (v_old - 'updated_at') then return new; end if;
  end if;
  insert into public.activities(contact_id,lead_id,deal_id,employee_id,activity_type,title,description,metadata)
    values(new.contact_id,new.lead_id,
      case when tg_table_name = 'deals' then new.id else (v_row->>'deal_id')::uuid end,
      v_actor,
      case when tg_op = 'UPDATE' then 'status_changed' when tg_table_name = 'deals' then 'deal_created' else 'quote_created' end,
      case when tg_table_name = 'deals' then 'Deal ' else 'Quote ' end || case when tg_op = 'INSERT' then 'created' else 'updated' end,
      coalesce(v_row->>'deal_number',v_row->>'quote_number') || ' · ' || new.status,
      jsonb_build_object('record_id',new.id,'previous_status',v_old->>'status','status',new.status));
  return new;
end;
$$;
revoke all on function private.record_transaction_activity() from public, anon, authenticated;
drop trigger if exists deal_activity_recorded on public.deals;
create trigger deal_activity_recorded after insert or update on public.deals for each row execute function private.record_transaction_activity();
drop trigger if exists quote_activity_recorded on public.quotes;
create trigger quote_activity_recorded after insert or update on public.quotes for each row execute function private.record_transaction_activity();

-- An administrator can also own work. Preserve any active owner on repeat inquiries
-- and keep promoted reps' existing leads editable. Automatic rotation still selects sales reps.
create or replace function public.manage_lead(
  p_actor_employee_id uuid,
  p_action text,
  p_lead_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_variable
declare
  actor_record public.employees%rowtype;
  contact_record public.contacts%rowtype;
  lead_record public.leads%rowtype;
  deal_record public.deals%rowtype;
  requested_owner_id uuid;
  owner_id uuid;
  normalized_email extensions.citext;
  first_name text;
  last_name text;
  display_name text;
  phone text;
  source_value text;
  status_value text;
  project_type_value text;
  project_location_value text;
  desired_timing_value text;
  summary_value text;
  lost_reason_value text;
begin
  -- Share the team-management lock to serialize ownership and access changes.
  perform pg_advisory_xact_lock(20260917, 1);
  select * into actor_record
  from public.employees
  where id = p_actor_employee_id and active = true
  for share;

  if actor_record.id is null or actor_record.role not in ('admin', 'sales_rep') then
    raise exception 'An active employee account is required' using errcode = '42501';
  end if;

  if p_action not in ('create', 'update', 'convert') then
    raise exception 'Unsupported lead action' using errcode = '22023';
  end if;

  if p_action in ('update', 'convert') and actor_record.role <> 'admin' then
    raise exception 'Administrator access is required to edit or convert leads' using errcode = '42501';
  end if;

  requested_owner_id := nullif(trim(p_payload->>'assigned_employee_id'), '')::uuid;
  if requested_owner_id is not null and not exists (
    select 1 from public.employees
    where id = requested_owner_id and active = true
  ) then
    raise exception 'The selected salesperson is not active' using errcode = '22023';
  end if;

  if p_action = 'create' then
    first_name := trim(coalesce(p_payload->>'first_name', ''));
    last_name := trim(coalesce(p_payload->>'last_name', ''));
    display_name := trim(coalesce(p_payload->>'display_name', concat_ws(' ', first_name, last_name)));
    normalized_email := lower(trim(coalesce(p_payload->>'email', '')))::extensions.citext;
    phone := trim(coalesce(p_payload->>'phone', ''));
    source_value := lower(trim(coalesce(p_payload->>'source', 'phone')));
    project_type_value := trim(coalesce(p_payload->>'project_type', ''));
    project_location_value := trim(coalesce(p_payload->>'project_location', ''));
    desired_timing_value := trim(coalesce(p_payload->>'desired_timing', ''));
    summary_value := nullif(trim(coalesce(p_payload->>'summary', '')), '');

    if length(first_name) < 1 or length(display_name) < 2
      or normalized_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      or length(regexp_replace(phone, '[^0-9]', '', 'g')) < 7
      or source_value not in ('phone', 'referral', 'walk_in', 'social', 'website', 'other')
      or length(project_type_value) < 1 or length(project_location_value) < 2
      or length(desired_timing_value) < 1 then
      raise exception 'Complete all required lead fields with valid information' using errcode = '22023';
    end if;

    select * into contact_record
    from public.contacts
    where lower(email::text) = lower(normalized_email::text)
    for update;

    if actor_record.role = 'sales_rep' then
      if contact_record.id is not null and exists (
        select 1 from public.employees
        where id = contact_record.assigned_employee_id and active = true
      ) then
        owner_id := contact_record.assigned_employee_id;
      else
        owner_id := actor_record.id;
      end if;
    elsif requested_owner_id is not null then
      owner_id := requested_owner_id;
    elsif contact_record.id is not null and exists (
      select 1 from public.employees
      where id = contact_record.assigned_employee_id and active = true
    ) then
      owner_id := contact_record.assigned_employee_id;
    else
      owner_id := private.assign_next_sales_rep();
    end if;

    if contact_record.id is null then
      insert into public.contacts (
        first_name, last_name, display_name, email, phone, project_address, city,
        lifecycle_stage, assigned_employee_id, created_by
      ) values (
        first_name, last_name, display_name, normalized_email, phone, project_location_value,
        project_location_value, 'lead', owner_id, actor_record.id
      ) returning * into contact_record;
    else
      update public.contacts set
        first_name = case when actor_record.role = 'admin' then first_name else coalesce(nullif(public.contacts.first_name, ''), first_name) end,
        last_name = case when actor_record.role = 'admin' then last_name else coalesce(nullif(public.contacts.last_name, ''), last_name) end,
        display_name = case when actor_record.role = 'admin' then display_name else coalesce(nullif(public.contacts.display_name, ''), display_name) end,
        phone = case when actor_record.role = 'admin' then phone else coalesce(nullif(public.contacts.phone, ''), phone) end,
        project_address = case when actor_record.role = 'admin' then project_location_value else coalesce(nullif(public.contacts.project_address, ''), project_location_value) end,
        city = case when actor_record.role = 'admin' then project_location_value else coalesce(nullif(public.contacts.city, ''), project_location_value) end,
        assigned_employee_id = owner_id
      where id = contact_record.id
      returning * into contact_record;
    end if;

    insert into public.leads (
      contact_id, assigned_employee_id, source, status, project_type, project_location,
      desired_timing, summary
    ) values (
      contact_record.id, owner_id, source_value, 'new', project_type_value,
      project_location_value, desired_timing_value, summary_value
    ) returning * into lead_record;

    insert into public.activities (
      contact_id, lead_id, employee_id, activity_type, title, description,
      metadata
    ) values (
      contact_record.id, lead_record.id, actor_record.id, 'lead_created',
      'Manual lead created', concat_ws(' · ', project_type_value, project_location_value, desired_timing_value),
      jsonb_build_object('source', source_value, 'assigned_employee_id', owner_id)
    );

    insert into private.audit_log (actor_employee_id, action, entity_type, entity_id, metadata)
    values (actor_record.id, 'lead_created_manual', 'lead', lead_record.id, jsonb_build_object('source', source_value, 'assigned_employee_id', owner_id));

    return jsonb_build_object(
      'lead_id', lead_record.id,
      'contact_id', contact_record.id,
      'assigned_employee_id', owner_id,
      'message', 'Lead created successfully.'
    );
  end if;

  if p_lead_id is null then
    raise exception 'Lead ID is required' using errcode = '22023';
  end if;

  select * into lead_record
  from public.leads
  where id = p_lead_id
  for update;
  if lead_record.id is null then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  select * into contact_record
  from public.contacts
  where id = lead_record.contact_id
  for update;

  if p_action = 'update' then
    if lead_record.status = 'converted' then
      raise exception 'Converted leads are locked; edit the linked deal instead' using errcode = '22023';
    end if;

    first_name := trim(coalesce(p_payload->>'first_name', contact_record.first_name));
    last_name := trim(coalesce(p_payload->>'last_name', contact_record.last_name));
    display_name := trim(coalesce(p_payload->>'display_name', concat_ws(' ', first_name, last_name)));
    normalized_email := lower(trim(coalesce(p_payload->>'email', contact_record.email::text)))::extensions.citext;
    phone := trim(coalesce(p_payload->>'phone', contact_record.phone, ''));
    source_value := lower(trim(coalesce(p_payload->>'source', lead_record.source)));
    status_value := lower(trim(coalesce(p_payload->>'status', lead_record.status)));
    project_type_value := trim(coalesce(p_payload->>'project_type', lead_record.project_type, ''));
    project_location_value := trim(coalesce(p_payload->>'project_location', lead_record.project_location, ''));
    desired_timing_value := trim(coalesce(p_payload->>'desired_timing', lead_record.desired_timing, ''));
    summary_value := nullif(trim(coalesce(p_payload->>'summary', lead_record.summary, '')), '');
    lost_reason_value := nullif(trim(coalesce(p_payload->>'lost_reason', lead_record.lost_reason, '')), '');
    owner_id := coalesce(requested_owner_id, lead_record.assigned_employee_id);

    if length(first_name) < 1 or length(display_name) < 2
      or normalized_email::text !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
      or length(regexp_replace(phone, '[^0-9]', '', 'g')) < 7
      or source_value not in ('phone', 'referral', 'walk_in', 'social', 'website', 'other')
      or status_value not in ('new', 'contacted', 'nurturing', 'qualified', 'lost', 'archived')
      or owner_id is null
      or not exists (
        select 1 from public.employees
        where id = owner_id and active = true
      )
      or length(project_type_value) < 1 or length(project_location_value) < 2
      or length(desired_timing_value) < 1 then
      raise exception 'Complete all required lead fields with valid information' using errcode = '22023';
    end if;
    if status_value = 'lost' and lost_reason_value is null then
      raise exception 'A lost reason is required before closing a lead' using errcode = '22023';
    end if;

    update public.contacts set
      first_name = first_name,
      last_name = last_name,
      display_name = display_name,
      email = normalized_email,
      phone = phone,
      project_address = project_location_value,
      city = project_location_value,
      assigned_employee_id = owner_id
    where id = contact_record.id;

    update public.leads set
      assigned_employee_id = owner_id,
      source = source_value,
      status = status_value,
      project_type = project_type_value,
      project_location = project_location_value,
      desired_timing = desired_timing_value,
      summary = summary_value,
      lost_reason = case when status_value = 'lost' then lost_reason_value else null end
    where id = lead_record.id;

    if owner_id is distinct from lead_record.assigned_employee_id then
      update public.tasks set employee_id = owner_id
      where lead_id = lead_record.id and status = 'open';

      insert into public.activities (contact_id, lead_id, employee_id, activity_type, title, description, metadata)
      values (
        contact_record.id, lead_record.id, actor_record.id, 'lead_assigned', 'Lead reassigned',
        'Lead ownership was reassigned by an administrator.',
        jsonb_build_object('from_employee_id', lead_record.assigned_employee_id, 'to_employee_id', owner_id)
      );
    end if;

    if status_value is distinct from lead_record.status then
      insert into public.activities (contact_id, lead_id, employee_id, activity_type, title, description, metadata)
      values (
        contact_record.id, lead_record.id, actor_record.id, 'status_changed', 'Lead status updated',
        replace(lead_record.status, '_', ' ') || ' → ' || replace(status_value, '_', ' '),
        jsonb_build_object('from', lead_record.status, 'to', status_value)
      );
    else
      insert into public.activities (contact_id, lead_id, employee_id, activity_type, title, description)
      values (contact_record.id, lead_record.id, actor_record.id, 'note_added', 'Lead details updated', 'Customer and project information was updated by an administrator.');
    end if;

    insert into private.audit_log (actor_employee_id, action, entity_type, entity_id, metadata)
    values (
      actor_record.id, 'lead_updated', 'lead', lead_record.id,
      jsonb_build_object('status', status_value, 'assigned_employee_id', owner_id)
    );

    return jsonb_build_object('lead_id', lead_record.id, 'message', 'Lead updated successfully.');
  end if;

  select * into deal_record
  from public.deals
  where lead_id = lead_record.id
  order by created_at
  limit 1
  for update;

  if deal_record.id is not null then
    return jsonb_build_object(
      'lead_id', lead_record.id,
      'deal_id', deal_record.id,
      'deal_number', deal_record.deal_number,
      'message', 'This lead already has a deal.'
    );
  end if;

  owner_id := coalesce(requested_owner_id, lead_record.assigned_employee_id);
  if owner_id is null or not exists (
    select 1 from public.employees
    where id = owner_id and active = true
  ) then
    raise exception 'Assign an active salesperson before converting this lead' using errcode = '22023';
  end if;

  insert into public.deals (
    contact_id, lead_id, sales_rep_id, stage, status, project_name,
    project_address, notes
  ) values (
    contact_record.id, lead_record.id, owner_id, 'draft', 'open',
    concat_ws(' — ', contact_record.display_name, nullif(lead_record.project_type, '')),
    lead_record.project_location,
    concat_ws(E'\n', 'Converted from ' || replace(lead_record.source, '_', ' ') || ' lead.', lead_record.summary)
  ) returning * into deal_record;

  update public.contacts set
    assigned_employee_id = owner_id,
    lifecycle_stage = case when lifecycle_stage = 'customer' then lifecycle_stage else 'prospect' end
  where id = contact_record.id;

  update public.leads set
    assigned_employee_id = owner_id,
    status = 'converted',
    converted_at = coalesce(converted_at, now())
  where id = lead_record.id;

  update public.tasks set employee_id = owner_id
  where lead_id = lead_record.id and status = 'open';

  insert into public.activities (contact_id, lead_id, deal_id, employee_id, activity_type, title, description, metadata)
  values
    (
      contact_record.id, lead_record.id, deal_record.id, actor_record.id, 'status_changed',
      'Lead converted', replace(lead_record.status, '_', ' ') || ' → converted',
      jsonb_build_object('from', lead_record.status, 'to', 'converted')
    ),
    (
      contact_record.id, lead_record.id, deal_record.id, actor_record.id, 'deal_created',
      'Draft deal created', deal_record.deal_number || ' was created from this lead.',
      jsonb_build_object('deal_id', deal_record.id, 'deal_number', deal_record.deal_number)
    );

  insert into private.audit_log (actor_employee_id, action, entity_type, entity_id, metadata)
  values (
    actor_record.id, 'lead_converted', 'lead', lead_record.id,
    jsonb_build_object('deal_id', deal_record.id, 'deal_number', deal_record.deal_number, 'assigned_employee_id', owner_id)
  );

  return jsonb_build_object(
    'lead_id', lead_record.id,
    'deal_id', deal_record.id,
    'deal_number', deal_record.deal_number,
    'message', 'Lead converted to a draft deal.'
  );
end;
$$;
