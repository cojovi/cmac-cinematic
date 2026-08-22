create table private.employee_google_identities (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  google_email extensions.citext unique not null,
  created_at timestamptz not null default now(),
  constraint employee_google_identity_email_format
    check (lower(btrim(google_email::text)) ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$')
);

alter table private.employee_google_identities enable row level security;
revoke all on table private.employee_google_identities from public, anon, authenticated;

comment on table private.employee_google_identities is
  'Server-only mapping from an exceptional Google primary email to an existing CMAC employee record.';

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
  mapped_employee_id uuid;
  mapped_employee_active boolean;
begin
  if provider <> 'google' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'A verified CMAC Google Workspace account is required.'
      )
    );
  end if;

  select e.id, e.active
  into mapped_employee_id, mapped_employee_active
  from private.employee_google_identities identity_map
  join public.employees e on e.id = identity_map.employee_id
  where lower(identity_map.google_email::text) = candidate_email;

  if mapped_employee_id is not null then
    if mapped_employee_active = false then
      return jsonb_build_object(
        'error', jsonb_build_object(
          'http_code', 403,
          'message', 'This CMAC employee account is not active.'
        )
      );
    end if;

    return '{}'::jsonb;
  end if;

  if candidate_email !~ '^[^@[:space:]]+@cmaccontainers[.]com$' then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'A verified CMAC Google Workspace account is required.'
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

create or replace function private.link_google_employee(
  p_auth_user_id uuid,
  p_google_email text,
  p_profile jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_email text := lower(btrim(coalesce(p_google_email, '')));
  mapped_employee_id uuid;
  profile jsonb := coalesce(p_profile, '{}'::jsonb);
  profile_name text;
  given_name text;
  family_name text;
  fallback_name text;
begin
  select identity_map.employee_id
  into mapped_employee_id
  from private.employee_google_identities identity_map
  where lower(identity_map.google_email::text) = candidate_email;

  if mapped_employee_id is not null then
    -- An exceptional Google identity can only link its preselected employee.
    -- Role, active state, and business email remain administrator-controlled.
    update public.employees
    set auth_user_id = p_auth_user_id,
        updated_at = now()
    where id = mapped_employee_id
      and (auth_user_id is null or auth_user_id = p_auth_user_id);

    if not found then
      raise exception 'This employee identity is already linked to another Google account.'
        using errcode = '23505';
    end if;

    return;
  end if;

  if candidate_email !~ '^[^@[:space:]]+@cmaccontainers[.]com$' then
    return;
  end if;

  -- Preserve all administrator-managed fields (especially role and active) on
  -- an existing Container-domain employee record.
  update public.employees
  set auth_user_id = p_auth_user_id,
      updated_at = now()
  where lower(email::text) = candidate_email
    and (auth_user_id is null or auth_user_id = p_auth_user_id);

  if found then
    return;
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
    p_auth_user_id,
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

  return;
end;
$$;

create or replace function private.link_employee_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.raw_app_meta_data->>'provider', '')) = 'google' then
    perform private.link_google_employee(new.id, new.email, new.raw_user_meta_data);
  end if;

  return new;
end;
$$;

create or replace function private.link_employee_google_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(new.provider, '')) = 'google' then
    perform private.link_google_employee(new.user_id, new.identity_data->>'email', new.identity_data);
  end if;

  return new;
end;
$$;

drop trigger if exists link_employee_after_google_identity on auth.identities;
create trigger link_employee_after_google_identity
after insert or update of provider, identity_data on auth.identities
for each row execute function private.link_employee_google_identity();

revoke all on function private.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function private.before_user_created_hook(jsonb) to supabase_auth_admin;

revoke all on function private.link_employee_auth_user() from public, anon, authenticated;
grant execute on function private.link_employee_auth_user() to supabase_auth_admin, service_role;

revoke all on function private.link_google_employee(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function private.link_google_employee(uuid, text, jsonb) to supabase_auth_admin, service_role;

revoke all on function private.link_employee_google_identity() from public, anon, authenticated;
grant execute on function private.link_employee_google_identity() to supabase_auth_admin, service_role;

comment on function private.before_user_created_hook(jsonb) is
  'Allows exact cmaccontainers.com Google identities or a server-managed exceptional identity mapping; inactive employees remain blocked.';

comment on function private.link_employee_auth_user() is
  'Links a Google-created auth user through the server-controlled employee linker.';

comment on function private.link_google_employee(uuid, text, jsonb) is
  'Links server-mapped exceptional Google identities, links existing Container employees, or provisions a new sales_rep without trusting profile metadata for authorization.';

comment on function private.link_employee_google_identity() is
  'Links an actual Google identity added to a pre-existing Supabase auth user.';
