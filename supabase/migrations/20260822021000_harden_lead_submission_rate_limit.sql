create or replace function public.submit_public_lead(
  p_first_name text,
  p_last_name text,
  p_display_name text,
  p_email extensions.citext,
  p_phone text,
  p_project_type text,
  p_project_location text,
  p_desired_timing text,
  p_ip_hash text,
  p_email_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  contact_record public.contacts%rowtype;
  owner_id uuid;
  lead_id uuid;
  rapid_duplicate boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email_hash, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_hash, 1));

  if (select count(*) from private.lead_submission_attempts a where a.ip_hash = p_ip_hash and a.submitted_at > now() - interval '1 hour') >= 5
    or (select count(*) from private.lead_submission_attempts a where a.email_hash = p_email_hash and a.submitted_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('accepted', false, 'reason', 'rate_limited');
  end if;

  select exists (
    select 1 from private.lead_submission_attempts a
    where a.email_hash = p_email_hash and a.submitted_at > now() - interval '15 minutes'
  ) into rapid_duplicate;

  insert into private.lead_submission_attempts (ip_hash, email_hash) values (p_ip_hash, p_email_hash);

  if rapid_duplicate then
    return jsonb_build_object('accepted', true, 'duplicate', true);
  end if;

  select c.* into contact_record
  from public.contacts c
  where lower(c.email::text) = lower(p_email::text)
  for update;

  if found then
    owner_id := contact_record.assigned_employee_id;
    if owner_id is not null and not exists (select 1 from public.employees e where e.id = owner_id and e.active = true) then
      owner_id := null;
    end if;
  else
    owner_id := null;
  end if;

  if owner_id is null then
    owner_id := private.assign_next_sales_rep();
  end if;

  insert into public.contacts (
    first_name, last_name, display_name, email, phone, city, lifecycle_stage, assigned_employee_id
  ) values (
    p_first_name, coalesce(p_last_name, ''), p_display_name, lower(p_email::text), p_phone,
    p_project_location, 'lead', owner_id
  )
  on conflict (email) do update set
    phone = coalesce(nullif(public.contacts.phone, ''), excluded.phone),
    city = coalesce(nullif(public.contacts.city, ''), excluded.city),
    assigned_employee_id = case
      when exists (select 1 from public.employees e where e.id = public.contacts.assigned_employee_id and e.active = true)
        then public.contacts.assigned_employee_id
      else excluded.assigned_employee_id
    end,
    updated_at = now()
  returning * into contact_record;

  insert into public.leads (
    contact_id, assigned_employee_id, source, status, project_type, project_location, desired_timing,
    summary
  ) values (
    contact_record.id, owner_id, 'website', 'new', p_project_type, p_project_location, p_desired_timing,
    'Submitted through the CMAC Container Homes consultation form.'
  ) returning id into lead_id;

  insert into public.activities (
    contact_id, lead_id, employee_id, activity_type, title, description
  ) values (
    contact_record.id, lead_id, owner_id, 'lead_created', 'Website consultation received',
    concat_ws(' · ', p_project_type, p_project_location, p_desired_timing)
  );

  return jsonb_build_object('accepted', true, 'duplicate', false);
end;
$$;
