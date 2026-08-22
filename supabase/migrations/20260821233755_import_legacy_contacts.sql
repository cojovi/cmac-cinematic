do $$
begin
  if to_regclass('private.legacy_contacts_20260822') is not null then
    insert into public.contacts (
      id,
      first_name,
      last_name,
      display_name,
      email,
      phone,
      project_address,
      city,
      state,
      postal_code,
      created_at,
      updated_at
    )
    select
      id,
      coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), 'Legacy'),
      case
        when position(' ' in btrim(full_name)) > 0
          then btrim(substring(btrim(full_name) from position(' ' in btrim(full_name)) + 1))
        else ''
      end,
      coalesce(nullif(btrim(full_name), ''), 'Legacy contact'),
      lower(btrim(email))::extensions.citext,
      nullif(btrim(phone), ''),
      nullif(btrim(street_address), ''),
      nullif(btrim(city), ''),
      nullif(btrim(state), ''),
      nullif(btrim(zip), ''),
      created_at,
      created_at
    from private.legacy_contacts_20260822
    where email is not null
      and btrim(email) <> ''
    on conflict (email) do nothing;
  end if;
end;
$$;

comment on table public.contacts is
  'Production CRM contacts. Legacy rows without an email remain preserved in private.legacy_contacts_20260822 for manual reconciliation.';
