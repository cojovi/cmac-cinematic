alter table public.employees
  drop constraint if exists employee_workspace_email;

alter table public.employees
  add constraint employee_workspace_email
  check (lower(btrim(email::text)) ~ '^[^@[:space:]]+@cmaccontainers[.]com$');

create or replace function private.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate_email text := lower(btrim(coalesce(event->'user'->>'email', '')));
  provider text := lower(coalesce(event->'user'->'app_metadata'->>'provider', ''));
begin
  if candidate_email !~ '^[^@[:space:]]+@cmaccontainers[.]com$'
    or provider <> 'google' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'A verified CMAC Containers Google Workspace account is required.'
      )
    );
  end if;

  -- Domain membership grants access by default, but an administrator's explicit
  -- deactivation remains authoritative for former or suspended employees.
  if exists (
    select 1
    from public.employees e
    where lower(e.email::text) = candidate_email
      and e.active = false
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This CMAC employee account is not active.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

create or replace function private.link_employee_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_email text := lower(btrim(coalesce(new.email, '')));
  provider text := lower(coalesce(new.raw_app_meta_data->>'provider', ''));
  profile jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  profile_name text;
  given_name text;
  family_name text;
  fallback_name text;
begin
  if candidate_email !~ '^[^@[:space:]]+@cmaccontainers[.]com$'
    or provider <> 'google' then
    return new;
  end if;

  -- Preserve all administrator-managed fields (especially role and active). An
  -- existing Cody row therefore remains admin, and a disabled row stays disabled.
  update public.employees
  set auth_user_id = new.id,
      updated_at = now()
  where lower(email::text) = candidate_email
    and (auth_user_id is null or auth_user_id = new.id);

  if found then
    return new;
  end if;

  -- Google profile metadata is used only for display fields. Authorization data
  -- is deliberately hard-coded so browser-controlled metadata cannot elevate a role.
  profile_name := nullif(btrim(coalesce(profile->>'full_name', profile->>'name', '')), '');
  given_name := nullif(btrim(coalesce(profile->>'given_name', '')), '');
  family_name := nullif(btrim(coalesce(profile->>'family_name', '')), '');
  fallback_name := initcap(regexp_replace(split_part(candidate_email, '@', 1), '[._+-]+', ' ', 'g'));

  if given_name is null then
    given_name := coalesce(nullif(split_part(profile_name, ' ', 1), ''), fallback_name);
  end if;

  if family_name is null and profile_name is not null and strpos(profile_name, ' ') > 0 then
    family_name := nullif(btrim(substring(profile_name from strpos(profile_name, ' ') + 1)), '');
  end if;

  family_name := coalesce(family_name, '');
  profile_name := coalesce(profile_name, nullif(btrim(concat_ws(' ', given_name, family_name)), ''), fallback_name);

  insert into public.employees (
    auth_user_id,
    email,
    first_name,
    last_name,
    display_name,
    role,
    active
  )
  values (
    new.id,
    candidate_email,
    given_name,
    family_name,
    profile_name,
    'sales_rep',
    true
  )
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        updated_at = now()
    where public.employees.auth_user_id is null
       or public.employees.auth_user_id = excluded.auth_user_id;

  return new;
end;
$$;

revoke all on function private.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function private.before_user_created_hook(jsonb) to supabase_auth_admin;

revoke all on function private.link_employee_auth_user() from public, anon, authenticated;
grant execute on function private.link_employee_auth_user() to supabase_auth_admin, service_role;

comment on function private.before_user_created_hook(jsonb) is
  'Allows verified Google identities in the exact cmaccontainers.com domain unless an existing employee record is inactive.';

comment on function private.link_employee_auth_user() is
  'Links existing CMAC employees or provisions a new active sales_rep without trusting user metadata for authorization.';
