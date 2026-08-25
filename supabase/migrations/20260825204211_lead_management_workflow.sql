create or replace function public.manage_lead(
  p_actor_employee_id uuid,
  p_action text,
  p_lead_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
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
    where id = requested_owner_id and active = true and role = 'sales_rep'
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
        where id = contact_record.assigned_employee_id and active = true and role = 'sales_rep'
      ) then
        owner_id := contact_record.assigned_employee_id;
      else
        owner_id := actor_record.id;
      end if;
    elsif requested_owner_id is not null then
      owner_id := requested_owner_id;
    elsif contact_record.id is not null and exists (
      select 1 from public.employees
      where id = contact_record.assigned_employee_id and active = true and role = 'sales_rep'
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
        where id = owner_id and active = true and role = 'sales_rep'
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
    where id = owner_id and active = true and role = 'sales_rep'
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

revoke all on function public.manage_lead(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.manage_lead(uuid, text, uuid, jsonb) to service_role;

drop policy if exists lead_update_owner_or_admin on public.leads;
create policy lead_update_admin_only on public.leads for update to authenticated
using ((select private.current_employee_is_admin()))
with check ((select private.current_employee_is_admin()));

revoke insert, update on public.leads from authenticated;
