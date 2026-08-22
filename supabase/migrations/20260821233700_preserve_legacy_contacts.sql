create schema if not exists private;

do $$
begin
  if to_regclass('public.contacts') is not null
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'contacts'
        and column_name = 'assigned_employee_id'
    ) then
    if to_regclass('private.legacy_contacts_20260822') is not null then
      raise exception 'Legacy contacts archive already exists; refusing to overwrite it';
    end if;

    alter table public.contacts set schema private;
    alter table private.contacts rename to legacy_contacts_20260822;
  end if;
end;
$$;

do $$
begin
  if to_regclass('private.legacy_contacts_20260822') is not null then
    alter table private.legacy_contacts_20260822 enable row level security;
    revoke all on table private.legacy_contacts_20260822 from public, anon, authenticated;
    grant select on table private.legacy_contacts_20260822 to service_role;
    drop policy if exists "Allow full access to contacts" on private.legacy_contacts_20260822;
  end if;
end;
$$;
