create schema if not exists private;

create extension if not exists citext with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create sequence public.employee_rep_code_seq start 1;
create sequence public.deal_number_seq start 1;
create sequence public.quote_number_seq start 1;

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email extensions.citext unique not null,
  first_name text not null,
  last_name text not null,
  display_name text not null,
  role text not null check (role in ('admin', 'sales_rep')),
  rep_code text unique not null default ('CMAC-' || lpad(nextval('public.employee_rep_code_seq')::text, 4, '0')),
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_workspace_email check (lower(email::text) like '%@cmaccontainers.com')
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null default '',
  display_name text not null,
  email extensions.citext unique not null,
  phone text,
  company text,
  project_address text,
  billing_address text,
  city text,
  state text,
  postal_code text,
  lifecycle_stage text not null default 'lead' check (lifecycle_stage in ('lead', 'prospect', 'customer', 'inactive')),
  assigned_employee_id uuid references public.employees(id) on delete set null,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  assigned_employee_id uuid references public.employees(id) on delete set null,
  source text not null default 'website',
  status text not null default 'new' check (status in ('new', 'contacted', 'nurturing', 'qualified', 'converted', 'lost', 'archived')),
  project_type text,
  project_location text,
  desired_timing text,
  summary text,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  converted_at timestamptz
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  deal_number text unique not null default ('CM-' || extract(year from now())::int || '-' || lpad(nextval('public.deal_number_seq')::text, 4, '0')),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  sales_rep_id uuid not null references public.employees(id) on delete restrict,
  stage text not null default 'draft' check (stage in ('draft', 'quote', 'negotiation', 'contract', 'signed', 'closed_won', 'closed_lost')),
  status text not null default 'open' check (status in ('open', 'on_hold', 'won', 'lost', 'cancelled')),
  project_name text,
  project_address text,
  notes text,
  base_amount numeric(12,2) not null default 0 check (base_amount >= 0),
  deposit_percent numeric(5,2) not null default 10 check (deposit_percent between 0 and 100),
  delivery_amount numeric(12,2) not null default 0 check (delivery_amount >= 0),
  delivery_estimate text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  signed_at timestamptz,
  closed_at timestamptz
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  activity_type text not null check (activity_type in ('lead_created', 'lead_assigned', 'status_changed', 'note_added', 'marketing_sent', 'follow_up_created', 'quote_created', 'quote_sent', 'deal_created', 'contract_created', 'contract_sent', 'contract_viewed', 'contract_signed', 'contract_declined', 'unit_sold')),
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint activity_has_parent check (contact_id is not null or lead_id is not null or deal_id is not null)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  title text not null,
  description text,
  due_at timestamptz not null,
  completed_at timestamptz,
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  category text not null check (category in ('general', 'residential', 'workforce', 'commercial', 'financing', 'technical', 'delivery', 'warranty', 'other')),
  storage_path text unique not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size >= 0 and file_size <= 18874368),
  default_subject text,
  default_body text,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.marketing_sends (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  subject text not null,
  body text not null,
  recipient_email extensions.citext not null,
  gmail_message_id text,
  gmail_thread_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'unknown')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.marketing_send_items (
  id uuid primary key default gen_random_uuid(),
  marketing_send_id uuid not null references public.marketing_sends(id) on delete cascade,
  marketing_material_id uuid not null references public.marketing_materials(id) on delete restrict,
  unique (marketing_send_id, marketing_material_id)
);

create table public.deal_units (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  source text not null default 'mock' check (source in ('mock', 'manual', 'bolt')),
  external_unit_id text not null,
  external_product_type text not null,
  confirmed_by uuid references public.employees(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deal_id, external_unit_id),
  constraint deal_unit_confirmation_consistent check ((confirmed_by is null and confirmed_at is null) or (confirmed_by is not null and confirmed_at is not null))
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text unique not null default ('Q-' || extract(year from now())::int || '-' || lpad(nextval('public.quote_number_seq')::text, 4, '0')),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  employee_id uuid not null references public.employees(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax numeric(12,2) not null default 0 check (tax >= 0),
  delivery_amount numeric(12,2) not null default 0 check (delivery_amount >= 0),
  total numeric(12,2) generated always as (subtotal + tax + delivery_amount) stored,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,
  expired_at timestamptz
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text unique not null,
  description text,
  category text not null check (category in ('legal', 'transaction', 'closing')),
  provider text check (provider in ('docusign')),
  provider_template_id text,
  is_active boolean not null default false,
  display_order integer not null default 0,
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_template_has_provider_mapping check (not is_active or (provider is not null and provider_template_id is not null))
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  provider text not null default 'docusign' check (provider in ('docusign')),
  template_id uuid not null references public.document_templates(id) on delete restrict,
  provider_envelope_id text unique,
  status text not null default 'draft' check (status in ('draft', 'sent', 'delivered', 'signed', 'completed', 'declined', 'voided', 'error')),
  sent_at timestamptz,
  delivered_at timestamptz,
  signed_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  voided_at timestamptz,
  signed_document_path text,
  completion_certificate_path text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.unit_sales (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete restrict,
  employee_id uuid not null references public.employees(id) on delete restrict,
  external_unit_id text not null,
  external_product_type text not null,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (deal_id, external_unit_id)
);

create table private.lead_assignment_state (
  singleton boolean primary key default true check (singleton),
  last_employee_id uuid references public.employees(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into private.lead_assignment_state (singleton) values (true) on conflict do nothing;

create table private.lead_submission_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  email_hash text not null,
  submitted_at timestamptz not null default now()
);

create table private.contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  provider text not null default 'docusign',
  provider_event_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table private.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_employee_id uuid references public.employees(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index contacts_assigned_employee_idx on public.contacts(assigned_employee_id);
create index leads_assigned_employee_idx on public.leads(assigned_employee_id);
create index leads_contact_idx on public.leads(contact_id);
create index leads_created_idx on public.leads(created_at desc);
create index activities_contact_created_idx on public.activities(contact_id, created_at desc);
create index activities_lead_created_idx on public.activities(lead_id, created_at desc);
create index activities_deal_created_idx on public.activities(deal_id, created_at desc);
create index tasks_employee_due_idx on public.tasks(employee_id, status, due_at);
create index marketing_materials_active_order_idx on public.marketing_materials(is_active, display_order);
create index marketing_sends_employee_created_idx on public.marketing_sends(employee_id, created_at desc);
create index marketing_sends_contact_created_idx on public.marketing_sends(contact_id, created_at desc);
create index deals_sales_rep_updated_idx on public.deals(sales_rep_id, updated_at desc);
create index deals_contact_idx on public.deals(contact_id);
create index deal_units_deal_idx on public.deal_units(deal_id);
create index quotes_employee_updated_idx on public.quotes(employee_id, updated_at desc);
create index quotes_contact_idx on public.quotes(contact_id);
create index quote_items_quote_idx on public.quote_items(quote_id, display_order);
create index contracts_employee_status_idx on public.contracts(employee_id, status);
create index contracts_deal_idx on public.contracts(deal_id);
create index unit_sales_employee_sold_idx on public.unit_sales(employee_id, sold_at desc);
create index lead_submission_ip_idx on private.lead_submission_attempts(ip_hash, submitted_at desc);
create index lead_submission_email_idx on private.lead_submission_attempts(email_hash, submitted_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger employees_set_updated_at before update on public.employees for each row execute function private.set_updated_at();
create trigger contacts_set_updated_at before update on public.contacts for each row execute function private.set_updated_at();
create trigger leads_set_updated_at before update on public.leads for each row execute function private.set_updated_at();
create trigger deals_set_updated_at before update on public.deals for each row execute function private.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function private.set_updated_at();
create trigger marketing_materials_set_updated_at before update on public.marketing_materials for each row execute function private.set_updated_at();
create trigger deal_units_set_updated_at before update on public.deal_units for each row execute function private.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes for each row execute function private.set_updated_at();
create trigger document_templates_set_updated_at before update on public.document_templates for each row execute function private.set_updated_at();
create trigger contracts_set_updated_at before update on public.contracts for each row execute function private.set_updated_at();

create or replace function private.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id
  from public.employees e
  where e.auth_user_id = (select auth.uid())
    and e.active = true
  limit 1
$$;

create or replace function private.current_employee_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e
    where e.auth_user_id = (select auth.uid())
      and e.active = true
      and e.role = 'admin'
  )
$$;

create or replace function private.can_access_contact(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.current_employee_is_admin()) or exists (
    select 1 from public.contacts c
    where c.id = target_id
      and c.assigned_employee_id = (select private.current_employee_id())
  )
$$;

create or replace function private.can_access_lead(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.current_employee_is_admin()) or exists (
    select 1 from public.leads l
    where l.id = target_id
      and l.assigned_employee_id = (select private.current_employee_id())
  )
$$;

create or replace function private.can_access_deal(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.current_employee_is_admin()) or exists (
    select 1 from public.deals d
    where d.id = target_id
      and d.sales_rep_id = (select private.current_employee_id())
  )
$$;

create or replace function private.assign_next_sales_rep()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  last_code text;
  next_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('cmac-lead-round-robin', 0));

  select e.rep_code into last_code
  from private.lead_assignment_state s
  left join public.employees e on e.id = s.last_employee_id
  where s.singleton = true;

  select e.id into next_id
  from public.employees e
  where e.active = true and e.role = 'sales_rep'
    and (last_code is null or e.rep_code > last_code)
  order by e.rep_code
  limit 1;

  if next_id is null then
    select e.id into next_id
    from public.employees e
    where e.active = true and e.role = 'sales_rep'
    order by e.rep_code
    limit 1;
  end if;

  update private.lead_assignment_state
  set last_employee_id = next_id, updated_at = now()
  where singleton = true;

  return next_id;
end;
$$;

create or replace function private.before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate_email text := lower(event->'user'->>'email');
  provider text := coalesce(event->'user'->'app_metadata'->>'provider', '');
begin
  if candidate_email is null
    or candidate_email not like '%@cmaccontainers.com'
    or provider <> 'google'
    or not exists (
      select 1 from public.employees e
      where lower(e.email::text) = candidate_email
        and e.active = true
        and e.role in ('admin', 'sales_rep')
    ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This Google account is not authorized for the CMAC employee portal.'
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
begin
  update public.employees
  set auth_user_id = new.id, updated_at = now()
  where lower(email::text) = lower(new.email)
    and active = true
    and (auth_user_id is null or auth_user_id = new.id);
  return new;
end;
$$;

create trigger link_employee_after_auth_user
after insert or update of email on auth.users
for each row execute function private.link_employee_auth_user();

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
begin
  if (select count(*) from private.lead_submission_attempts a where a.ip_hash = p_ip_hash and a.submitted_at > now() - interval '1 hour') >= 5
    or (select count(*) from private.lead_submission_attempts a where a.email_hash = p_email_hash and a.submitted_at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('accepted', false, 'reason', 'rate_limited');
  end if;

  if exists (
    select 1 from private.lead_submission_attempts a
    where a.email_hash = p_email_hash and a.submitted_at > now() - interval '15 minutes'
  ) then
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

  insert into private.lead_submission_attempts (ip_hash, email_hash) values (p_ip_hash, p_email_hash);

  return jsonb_build_object('accepted', true, 'duplicate', false);
end;
$$;

create or replace function public.complete_deal_sale(p_deal_id uuid, p_override_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor public.employees%rowtype;
  deal_record public.deals%rowtype;
  sale_count integer;
  has_completed_contract boolean;
begin
  select e.* into actor from public.employees e
  where e.auth_user_id = (select auth.uid()) and e.active = true;
  if not found then raise exception 'Unauthorized'; end if;

  select d.* into deal_record from public.deals d where d.id = p_deal_id for update;
  if not found then raise exception 'Deal not found'; end if;

  if actor.role <> 'admin' and deal_record.sales_rep_id <> actor.id then
    raise exception 'Forbidden';
  end if;

  if not exists (select 1 from public.deal_units u where u.deal_id = p_deal_id) then
    raise exception 'At least one unit reference is required';
  end if;

  if exists (
    select 1 from public.deal_units u
    where u.deal_id = p_deal_id
      and (u.source = 'mock' or u.confirmed_by is null or u.confirmed_at is null or btrim(u.external_unit_id) = '')
  ) then
    raise exception 'Every unit must have a confirmed non-mock reference';
  end if;

  select exists (
    select 1 from public.contracts c where c.deal_id = p_deal_id and c.status = 'completed'
  ) into has_completed_contract;

  if not has_completed_contract and not (actor.role = 'admin' and length(btrim(coalesce(p_override_reason, ''))) >= 10) then
    raise exception 'A completed contract is required; admin overrides require a reason';
  end if;

  if deal_record.stage = 'closed_won' then
    select count(*) into sale_count from public.unit_sales s where s.deal_id = p_deal_id;
    return jsonb_build_object('deal_id', p_deal_id, 'unit_sales_created', sale_count, 'already_completed', true);
  end if;

  update public.deals
  set stage = 'closed_won', status = 'won', closed_at = now(), updated_at = now()
  where id = p_deal_id;

  insert into public.unit_sales (deal_id, employee_id, external_unit_id, external_product_type)
  select u.deal_id, deal_record.sales_rep_id, u.external_unit_id, u.external_product_type
  from public.deal_units u
  where u.deal_id = p_deal_id
  on conflict (deal_id, external_unit_id) do nothing;

  get diagnostics sale_count = row_count;

  update public.contacts set lifecycle_stage = 'customer', updated_at = now()
  where id = deal_record.contact_id;

  insert into public.activities (contact_id, lead_id, deal_id, employee_id, activity_type, title, description, metadata)
  values (
    deal_record.contact_id, deal_record.lead_id, deal_record.id, actor.id, 'unit_sold',
    'Deal marked sold', concat(sale_count, ' unit sale record(s) created.'),
    jsonb_build_object('override_reason', nullif(btrim(coalesce(p_override_reason, '')), ''))
  );

  insert into private.audit_log (actor_employee_id, action, entity_type, entity_id, metadata)
  values (
    actor.id, 'deal_marked_sold', 'deal', deal_record.id,
    jsonb_build_object('unit_sales_created', sale_count, 'contract_override', not has_completed_contract, 'override_reason', nullif(btrim(coalesce(p_override_reason, '')), ''))
  );

  return jsonb_build_object('deal_id', p_deal_id, 'unit_sales_created', sale_count, 'already_completed', false);
end;
$$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role, supabase_auth_admin;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_employee_id() to authenticated, service_role;
grant execute on function private.current_employee_is_admin() to authenticated, service_role;
grant execute on function private.can_access_contact(uuid) to authenticated, service_role;
grant execute on function private.can_access_lead(uuid) to authenticated, service_role;
grant execute on function private.can_access_deal(uuid) to authenticated, service_role;
grant execute on function private.before_user_created_hook(jsonb) to supabase_auth_admin;
grant execute on function private.link_employee_auth_user() to supabase_auth_admin, service_role;
grant execute on function private.set_updated_at() to authenticated, service_role;
grant execute on function private.assign_next_sales_rep() to service_role;

revoke all on function public.submit_public_lead(text, text, text, extensions.citext, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_public_lead(text, text, text, extensions.citext, text, text, text, text, text, text) to service_role;
revoke all on function public.complete_deal_sale(uuid, text) from public, anon;
grant execute on function public.complete_deal_sale(uuid, text) to authenticated, service_role;

alter table public.employees enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.deals enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.marketing_materials enable row level security;
alter table public.marketing_sends enable row level security;
alter table public.marketing_send_items enable row level security;
alter table public.deal_units enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.document_templates enable row level security;
alter table public.contracts enable row level security;
alter table public.unit_sales enable row level security;

create policy employee_read_self_or_admin on public.employees for select to authenticated
using (id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));
create policy employee_admin_insert on public.employees for insert to authenticated
with check ((select private.current_employee_is_admin()));
create policy employee_admin_update on public.employees for update to authenticated
using ((select private.current_employee_is_admin())) with check ((select private.current_employee_is_admin()));

create policy contact_read_owner_or_admin on public.contacts for select to authenticated
using (assigned_employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));
create policy contact_insert_owner_or_admin on public.contacts for insert to authenticated
with check (assigned_employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));
create policy contact_update_owner_or_admin on public.contacts for update to authenticated
using (assigned_employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
with check (assigned_employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));

create policy lead_read_owner_or_admin on public.leads for select to authenticated
using (assigned_employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));
create policy lead_insert_owner_or_admin on public.leads for insert to authenticated
with check (assigned_employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));
create policy lead_update_owner_or_admin on public.leads for update to authenticated
using (assigned_employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
with check (assigned_employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));

create policy deal_owner_or_admin_all on public.deals for all to authenticated
using (sales_rep_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
with check (sales_rep_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));

create policy activity_read_related on public.activities for select to authenticated
using (
  (select private.current_employee_is_admin())
  or employee_id = (select private.current_employee_id())
  or (contact_id is not null and (select private.can_access_contact(contact_id)))
  or (lead_id is not null and (select private.can_access_lead(lead_id)))
  or (deal_id is not null and (select private.can_access_deal(deal_id)))
);
create policy activity_insert_related on public.activities for insert to authenticated
with check (
  (select private.current_employee_is_admin())
  or (
    employee_id = (select private.current_employee_id())
    and (contact_id is null or (select private.can_access_contact(contact_id)))
    and (lead_id is null or (select private.can_access_lead(lead_id)))
    and (deal_id is null or (select private.can_access_deal(deal_id)))
  )
);

create policy task_owner_or_admin_all on public.tasks for all to authenticated
using (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
with check (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));

create policy marketing_material_read_active on public.marketing_materials for select to authenticated
using ((is_active and (select private.current_employee_id()) is not null) or (select private.current_employee_is_admin()));
create policy marketing_material_admin_all on public.marketing_materials for all to authenticated
using ((select private.current_employee_is_admin())) with check ((select private.current_employee_is_admin()));

create policy marketing_send_owner_or_admin_all on public.marketing_sends for all to authenticated
using (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
with check (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));
create policy marketing_send_item_related on public.marketing_send_items for all to authenticated
using (exists (select 1 from public.marketing_sends s where s.id = marketing_send_id))
with check (exists (select 1 from public.marketing_sends s where s.id = marketing_send_id));

create policy deal_unit_related on public.deal_units for all to authenticated
using ((select private.can_access_deal(deal_id)))
with check ((select private.can_access_deal(deal_id)));

create policy quote_owner_or_admin_all on public.quotes for all to authenticated
using (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
with check (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));
create policy quote_item_related on public.quote_items for all to authenticated
using (exists (select 1 from public.quotes q where q.id = quote_id))
with check (exists (select 1 from public.quotes q where q.id = quote_id));

create policy document_template_read_active on public.document_templates for select to authenticated
using ((is_active and (select private.current_employee_id()) is not null) or (select private.current_employee_is_admin()));
create policy document_template_admin_all on public.document_templates for all to authenticated
using ((select private.current_employee_is_admin())) with check ((select private.current_employee_is_admin()));

create policy contract_owner_or_admin_all on public.contracts for all to authenticated
using (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
with check (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));

create policy unit_sale_owner_or_admin_read on public.unit_sales for select to authenticated
using (employee_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()));

revoke all on all tables in schema public from anon, authenticated;
grant select, insert, update on public.employees to authenticated;
grant select, insert, update on public.contacts to authenticated;
grant select, insert, update on public.leads to authenticated;
grant select, insert, update on public.deals to authenticated;
grant select, insert on public.activities to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.marketing_materials to authenticated;
grant select, insert, update on public.marketing_sends to authenticated;
grant select, insert, delete on public.marketing_send_items to authenticated;
grant select, insert, update, delete on public.deal_units to authenticated;
grant select, insert, update, delete on public.quotes to authenticated;
grant select, insert, update, delete on public.quote_items to authenticated;
grant select, insert, update, delete on public.document_templates to authenticated;
grant select, insert, update on public.contracts to authenticated;
grant select on public.unit_sales to authenticated;
grant usage, select on all sequences in schema public to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('marketing-materials', 'marketing-materials', false, 18874368),
  ('signed-contracts', 'signed-contracts', false, 52428800)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

create policy marketing_storage_employee_read on storage.objects for select to authenticated
using (bucket_id = 'marketing-materials' and (select private.current_employee_id()) is not null);
create policy marketing_storage_admin_insert on storage.objects for insert to authenticated
with check (bucket_id = 'marketing-materials' and (select private.current_employee_is_admin()));
create policy marketing_storage_admin_update on storage.objects for update to authenticated
using (bucket_id = 'marketing-materials' and (select private.current_employee_is_admin()))
with check (bucket_id = 'marketing-materials' and (select private.current_employee_is_admin()));
create policy marketing_storage_admin_delete on storage.objects for delete to authenticated
using (bucket_id = 'marketing-materials' and (select private.current_employee_is_admin()));

create policy signed_contract_storage_read on storage.objects for select to authenticated
using (
  bucket_id = 'signed-contracts'
  and exists (
    select 1 from public.deals d
    where d.id::text = (storage.foldername(name))[1]
      and (d.sales_rep_id = (select private.current_employee_id()) or (select private.current_employee_is_admin()))
  )
);

insert into public.document_templates (title, slug, description, category, display_order)
values
  ('Purchase Agreement', 'purchase-agreement', 'Unit, parties, price, terms, and signatures.', 'legal', 10),
  ('Invoice & Deposit Schedule', 'invoice-deposit-schedule', 'Deposit, milestone payments, and balance due.', 'transaction', 20),
  ('Configuration & Finish Schedule', 'configuration-finish-schedule', 'Layout, fixtures, finishes, and approved options.', 'transaction', 30),
  ('Site Readiness & Delivery Checklist', 'site-readiness-delivery-checklist', 'Access, foundation, utilities, crane, and placement.', 'transaction', 40),
  ('Limited Warranty', 'limited-warranty', 'Coverage, exclusions, care, and claim process.', 'legal', 50),
  ('Change Order Policy', 'change-order-policy', 'How approved changes affect price and schedule.', 'legal', 60),
  ('Permit & Zoning Acknowledgment', 'permit-zoning-acknowledgment', 'Customer acknowledgment of local permitting responsibilities.', 'legal', 70),
  ('Payment Instructions', 'payment-instructions', 'Approved payment channels and fraud safeguards.', 'closing', 80),
  ('Bill of Sale', 'bill-of-sale', 'Issued when the transaction is complete.', 'closing', 90)
on conflict (slug) do nothing;
