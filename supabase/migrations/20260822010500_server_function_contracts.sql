create or replace function public.process_contract_event(
  p_provider_event_id text,
  p_envelope_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_contract public.contracts%rowtype;
  normalized_status text;
begin
  select * into target_contract from public.contracts where provider_envelope_id = p_envelope_id for update;
  if target_contract.id is null then return jsonb_build_object('found', false); end if;

  insert into private.contract_events (contract_id, provider_event_id, event_type, occurred_at, payload)
  values (target_contract.id, p_provider_event_id, p_event_type, p_occurred_at, p_payload)
  on conflict (provider, provider_event_id) do nothing;
  if not found then return jsonb_build_object('found', true, 'duplicate', true, 'contract_id', target_contract.id); end if;

  normalized_status := case lower(p_event_type)
    when 'envelope-sent' then 'sent'
    when 'envelope-delivered' then 'delivered'
    when 'envelope-signed' then 'signed'
    when 'envelope-completed' then 'completed'
    when 'envelope-declined' then 'declined'
    when 'envelope-voided' then 'voided'
    else null
  end;

  if normalized_status is not null then
    update public.contracts set
      status = normalized_status,
      sent_at = case when normalized_status = 'sent' then coalesce(sent_at, p_occurred_at) else sent_at end,
      delivered_at = case when normalized_status = 'delivered' then coalesce(delivered_at, p_occurred_at) else delivered_at end,
      signed_at = case when normalized_status in ('signed', 'completed') then coalesce(signed_at, p_occurred_at) else signed_at end,
      completed_at = case when normalized_status = 'completed' then coalesce(completed_at, p_occurred_at) else completed_at end,
      declined_at = case when normalized_status = 'declined' then coalesce(declined_at, p_occurred_at) else declined_at end,
      voided_at = case when normalized_status = 'voided' then coalesce(voided_at, p_occurred_at) else voided_at end
    where id = target_contract.id;

    insert into public.activities (contact_id, deal_id, employee_id, activity_type, title, metadata)
    values (
      target_contract.contact_id,
      target_contract.deal_id,
      target_contract.employee_id,
      case normalized_status when 'completed' then 'contract_signed' when 'declined' then 'contract_declined' when 'delivered' then 'contract_viewed' else 'status_changed' end,
      'DocuSign envelope ' || replace(normalized_status, '_', ' '),
      jsonb_build_object('contract_id', target_contract.id, 'provider_envelope_id', p_envelope_id)
    );
  end if;

  return jsonb_build_object('found', true, 'duplicate', false, 'contract_id', target_contract.id, 'status', normalized_status);
end;
$$;

create or replace function public.admin_manage_employee(
  p_actor_employee_id uuid,
  p_action text,
  p_employee jsonb default null,
  p_employee_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  if not exists (select 1 from public.employees where id = p_actor_employee_id and active and role = 'admin') then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if p_action = 'create' then
    if lower(p_employee->>'email') not like '%@cmaccontainers.com' or p_employee->>'role' not in ('admin', 'sales_rep') then
      raise exception 'Invalid employee identity or role' using errcode = '22023';
    end if;
    insert into public.employees (email, first_name, last_name, display_name, role)
    values (lower(p_employee->>'email'), trim(p_employee->>'first_name'), trim(p_employee->>'last_name'), trim(p_employee->>'display_name'), p_employee->>'role')
    returning id into target_id;
  elsif p_action in ('activate', 'deactivate') then
    target_id := p_employee_id;
    if target_id = p_actor_employee_id and p_action = 'deactivate' then
      raise exception 'Administrators cannot deactivate their own active session' using errcode = '22023';
    end if;
    update public.employees set active = (p_action = 'activate') where id = target_id;
    if not found then raise exception 'Employee not found' using errcode = 'P0002'; end if;
  else
    raise exception 'Unsupported employee action' using errcode = '22023';
  end if;

  insert into private.audit_log (actor_employee_id, action, entity_type, entity_id, metadata)
  values (p_actor_employee_id, 'employee_' || p_action, 'employee', target_id, coalesce(p_employee, '{}'::jsonb));
  return jsonb_build_object('employee_id', target_id, 'action', p_action);
end;
$$;

revoke all on function public.process_contract_event(text, text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.process_contract_event(text, text, text, timestamptz, jsonb) to service_role;
revoke all on function public.admin_manage_employee(uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.admin_manage_employee(uuid, text, jsonb, uuid) to service_role;

drop policy if exists marketing_storage_employee_read on storage.objects;
create policy marketing_storage_employee_read on storage.objects for select to authenticated
using (
  bucket_id = 'marketing-materials'
  and exists (
    select 1 from public.marketing_materials m
    where m.storage_path = name
      and (m.is_active or (select private.current_employee_is_admin()))
  )
);

drop policy if exists signed_contract_storage_read on storage.objects;
create policy signed_contract_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'signed-contracts'
  and exists (
    select 1
    from public.contracts c
    join public.deals d on d.id = c.deal_id
    where c.id::text = (storage.foldername(name))[2]
      and (d.sales_rep_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
  )
);
