begin;
create extension if not exists pgtap with schema extensions;
select plan(63);

select has_table('public', 'employees', 'employees table exists');
select has_table('public', 'contacts', 'contacts table exists');
select has_table('public', 'leads', 'leads table exists');
select has_table('public', 'deals', 'deals table exists');
select has_table('public', 'unit_sales', 'unit attribution table exists');
select has_table('private', 'employee_google_identities', 'private Google identity map exists');
select ok((select relrowsecurity from pg_class where oid = 'public.contacts'::regclass), 'contacts RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.deals'::regclass), 'deals RLS is enabled');
select ok(not has_table_privilege('authenticated', 'private.employee_google_identities', 'SELECT'), 'browser users cannot read exceptional identity mappings');
select ok(not has_function_privilege('authenticated', 'public.admin_manage_employee(uuid,text,jsonb,uuid)', 'EXECUTE'), 'browser users cannot call admin service RPC');
select ok(not has_function_privilege('anon', 'public.submit_public_lead(text,text,text,citext,text,text,text,text,text,text)', 'EXECUTE'), 'anonymous clients cannot bypass the lead Edge Function');
select ok(not has_function_privilege('authenticated', 'public.complete_deal_sale(uuid,uuid,text)', 'EXECUTE'), 'browser users cannot bypass the sale-completion Edge Function');
select ok(not has_function_privilege('authenticated', 'public.manage_lead(uuid,text,uuid,jsonb)', 'EXECUTE'), 'browser users cannot bypass role-aware lead management');

insert into public.employees (id, email, first_name, last_name, display_name, role, rep_code)
values
  ('20000000-0000-0000-0000-000000000001', 'admin@cmaccontainers.com', 'Ada', 'Admin', 'Ada Admin', 'admin', 'CMAC-T001'),
  ('20000000-0000-0000-0000-000000000002', 'repa@cmaccontainers.com', 'Riley', 'Rep', 'Riley Rep', 'sales_rep', 'CMAC-T002'),
  ('20000000-0000-0000-0000-000000000003', 'repb@cmaccontainers.com', 'Reese', 'Rep', 'Reese Rep', 'sales_rep', 'CMAC-T003'),
  ('20000000-0000-0000-0000-000000000006', 'owner@cmaccontainers.com', 'Owner', 'Admin', 'Owner Admin', 'admin', 'CMAC-T006'),
  ('20000000-0000-0000-0000-000000000007', 'legacy.owner@cmaccontainers.com', 'Legacy', 'Owner', 'Legacy Owner', 'admin', 'CMAC-T007');

insert into private.employee_google_identities (employee_id, google_email)
values
  ('20000000-0000-0000-0000-000000000006', 'owner.primary@cmacroofing.com'),
  ('20000000-0000-0000-0000-000000000007', 'legacy.primary@cmacroofing.com');

select is(
  private.before_user_created_hook('{"user":{"email":"owner.primary@cmacroofing.com","app_metadata":{"provider":"google"}}}'::jsonb),
  '{}'::jsonb,
  'the explicitly mapped Roofing-domain Google identity is admitted'
);
select is(
  private.before_user_created_hook('{"user":{"email":"another.person@cmacroofing.com","app_metadata":{"provider":"google"}}}'::jsonb)->'error'->>'http_code',
  '403',
  'every other Roofing-domain identity remains blocked'
);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000006',
  'authenticated',
  'authenticated',
  'owner.primary@cmacroofing.com',
  '',
  now(),
  '{"provider":"google","providers":["google"]}',
  '{"full_name":"Different Name","role":"sales_rep"}',
  now(),
  now()
);
select is((select role from public.employees where id = '20000000-0000-0000-0000-000000000006'), 'admin', 'mapped Google identity cannot alter the administrator role');
select is((select auth_user_id from public.employees where id = '20000000-0000-0000-0000-000000000006'), '10000000-0000-0000-0000-000000000006'::uuid, 'mapped Google identity links the selected employee');
select is((select email::text from public.employees where id = '20000000-0000-0000-0000-000000000006'), 'owner@cmaccontainers.com', 'mapped login preserves the employee business email');

update public.employees set active = false where id = '20000000-0000-0000-0000-000000000006';
select is(
  private.before_user_created_hook('{"user":{"email":"owner.primary@cmacroofing.com","app_metadata":{"provider":"google"}}}'::jsonb)->'error'->>'http_code',
  '403',
  'deactivation also blocks an explicitly mapped Google identity'
);
update public.employees set active = true where id = '20000000-0000-0000-0000-000000000006';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'legacy.primary@cmacroofing.com', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());
select is((select auth_user_id from public.employees where id = '20000000-0000-0000-0000-000000000007'), null, 'a pre-existing email-only auth record is not granted employee access');

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values ('google-legacy-owner', '10000000-0000-0000-0000-000000000007', '{"sub":"google-legacy-owner","email":"legacy.primary@cmacroofing.com","email_verified":true}', 'google', now(), now(), now());
select is((select auth_user_id from public.employees where id = '20000000-0000-0000-0000-000000000007'), '10000000-0000-0000-0000-000000000007'::uuid, 'adding an actual Google identity links the pre-existing auth user');

select is(
  private.before_user_created_hook('{"user":{"email":"new.rep@cmaccontainers.com","app_metadata":{"provider":"google"}}}'::jsonb),
  '{}'::jsonb,
  'an unregistered CMAC Google identity is admitted by the signup hook'
);
select is(
  private.before_user_created_hook('{"user":{"email":"rep@cmaccontainers.com.attacker.test","app_metadata":{"provider":"google"}}}'::jsonb)->'error'->>'http_code',
  '403',
  'a lookalike email domain is rejected'
);
select is(
  private.before_user_created_hook('{"user":{"email":"rep@cmaccontainers.com","app_metadata":{"provider":"email"}}}'::jsonb)->'error'->>'http_code',
  '403',
  'a non-Google signup is rejected'
);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@cmaccontainers.com', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'repa@cmaccontainers.com', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'repb@cmaccontainers.com', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now());

select is((select role from public.employees where email = 'admin@cmaccontainers.com'), 'admin', 'Google linking preserves an existing administrator role');
select is((select auth_user_id from public.employees where email = 'admin@cmaccontainers.com'), '10000000-0000-0000-0000-000000000001'::uuid, 'Google linking attaches the existing administrator record');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000004',
  'authenticated',
  'authenticated',
  'new.rep@cmaccontainers.com',
  '',
  now(),
  '{"provider":"google","providers":["google"]}',
  '{"given_name":"Nova","family_name":"Rep","full_name":"Nova Rep","role":"admin"}',
  now(),
  now()
);
select is((select role from public.employees where email = 'new.rep@cmaccontainers.com'), 'sales_rep', 'new domain users are always provisioned as sales reps');
select is((select display_name from public.employees where email = 'new.rep@cmaccontainers.com'), 'Nova Rep', 'Google profile data may populate non-authoritative display fields');
select is((select auth_user_id from public.employees where email = 'new.rep@cmaccontainers.com'), '10000000-0000-0000-0000-000000000004'::uuid, 'a new domain user is linked to the provisioned employee');

delete from public.employees where email = 'new.rep@cmaccontainers.com';
delete from auth.users where id = '10000000-0000-0000-0000-000000000004';

insert into public.employees (id, email, first_name, last_name, display_name, role, rep_code, active)
values ('20000000-0000-0000-0000-000000000004', 'disabled@cmaccontainers.com', 'Disabled', 'Rep', 'Disabled Rep', 'sales_rep', 'CMAC-T004', false);
select is(
  private.before_user_created_hook('{"user":{"email":"disabled@cmaccontainers.com","app_metadata":{"provider":"google"}}}'::jsonb)->'error'->>'http_code',
  '403',
  'an explicitly deactivated employee is rejected by the signup hook'
);
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'disabled@cmaccontainers.com', '', now(), '{"provider":"google","providers":["google"]}', '{"role":"admin"}', now(), now());
select is((select active from public.employees where email = 'disabled@cmaccontainers.com'), false, 'auth linking cannot reactivate a disabled employee');
select is((select role from public.employees where email = 'disabled@cmaccontainers.com'), 'sales_rep', 'auth linking cannot change a managed employee role');

insert into public.contacts (id, first_name, display_name, email, assigned_employee_id, created_by)
values
  ('30000000-0000-0000-0000-000000000001', 'Alpha', 'Alpha Buyer', 'alpha@example.com', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000002', 'Beta', 'Beta Buyer', 'beta@example.com', '20000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003');

select throws_ok(
  $$insert into public.employees (email, first_name, last_name, display_name, role) values ('outside@example.com','Out','Side','Out Side','sales_rep')$$,
  '23514', null, 'non-CMAC employee email is rejected'
);
select throws_ok(
  $$insert into public.contacts (first_name, display_name, email) values ('Duplicate','Duplicate','ALPHA@example.com')$$,
  '23505', null, 'canonical contact email is case-insensitively unique'
);

select is(
  (public.manage_lead(
    '20000000-0000-0000-0000-000000000002',
    'create',
    null,
    '{"first_name":"Manual","last_name":"Lead","display_name":"Manual Lead","email":"manual-lead@example.com","phone":"8175550199","source":"referral","project_type":"Container home","project_location":"Fort Worth, TX","desired_timing":"3–6 months","summary":"Partner referral"}'::jsonb
  )->>'assigned_employee_id')::uuid,
  '20000000-0000-0000-0000-000000000002'::uuid,
  'a sales representative can create a manually assigned lead'
);
select is(
  (select status from public.leads l join public.contacts c on c.id = l.contact_id where c.email = 'manual-lead@example.com'),
  'new',
  'manual leads enter the new stage'
);
select throws_ok(
  $$select public.manage_lead(
    '20000000-0000-0000-0000-000000000002',
    'update',
    (select l.id from public.leads l join public.contacts c on c.id = l.contact_id where c.email = 'manual-lead@example.com'),
    '{"status":"contacted"}'::jsonb
  )$$,
  '42501', 'Administrator access is required to edit or convert leads',
  'sales representatives cannot edit a lead through the server contract'
);
select lives_ok(
  $$select public.manage_lead(
    '20000000-0000-0000-0000-000000000001',
    'update',
    (select l.id from public.leads l join public.contacts c on c.id = l.contact_id where c.email = 'manual-lead@example.com'),
    '{"status":"contacted","assigned_employee_id":"20000000-0000-0000-0000-000000000003"}'::jsonb
  )$$,
  'an administrator can edit status and reassign a lead'
);
select is(
  (select l.status from public.leads l join public.contacts c on c.id = l.contact_id where c.email = 'manual-lead@example.com'),
  'contacted',
  'the administrator status change is persisted'
);
select lives_ok(
  $$select public.manage_lead(
    '20000000-0000-0000-0000-000000000001',
    'convert',
    (select l.id from public.leads l join public.contacts c on c.id = l.contact_id where c.email = 'manual-lead@example.com'),
    '{"assigned_employee_id":"20000000-0000-0000-0000-000000000003"}'::jsonb
  )$$,
  'an administrator can convert a lead to a draft deal'
);
select is(
  (select l.status from public.leads l join public.contacts c on c.id = l.contact_id where c.email = 'manual-lead@example.com'),
  'converted',
  'conversion locks the source lead as converted'
);
select is(
  (select count(*)::integer from public.deals d join public.contacts c on c.id = d.contact_id where c.email = 'manual-lead@example.com'),
  1,
  'conversion creates exactly one linked draft deal'
);
select lives_ok(
  $$select public.manage_lead(
    '20000000-0000-0000-0000-000000000001',
    'convert',
    (select l.id from public.leads l join public.contacts c on c.id = l.contact_id where c.email = 'manual-lead@example.com'),
    '{"assigned_employee_id":"20000000-0000-0000-0000-000000000003"}'::jsonb
  )$$,
  'lead conversion is idempotent on retry'
);
select is(
  (select count(*)::integer from public.deals d join public.contacts c on c.id = d.contact_id where c.email = 'manual-lead@example.com'),
  1,
  'retrying conversion does not duplicate the deal'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.contacts where id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')), 1, 'Rep A sees only the owned contact fixture');
select is((select private.current_employee_id()), '20000000-0000-0000-0000-000000000002'::uuid, 'Rep A resolves to live employee identity');
select is((select private.current_employee_is_admin()), false, 'Rep A is not admin');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.contacts where id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')), 1, 'Rep B sees only the owned contact fixture');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.contacts where id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')), 2, 'Admin sees both company-wide contact fixtures');
select is((select private.current_employee_is_admin()), true, 'Admin helper recognizes active admin');
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select count(*) from public.contacts$$, '42501', 'permission denied for table contacts', 'Anonymous user has no direct CRM table grant');
reset role;

update public.employees set active = false where id = '20000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.contacts where id in ('30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002')), 0, 'Deactivated rep immediately loses fixture data access');
reset role;
update public.employees set active = true where id = '20000000-0000-0000-0000-000000000002';

update private.lead_assignment_state set last_employee_id = null where singleton;
select ok((select private.assign_next_sales_rep()) is not null, 'round-robin selects an active sales representative');
with previous_pick as materialized (
  select last_employee_id as id from private.lead_assignment_state where singleton
), next_pick as materialized (
  select private.assign_next_sales_rep() as id from previous_pick
)
select isnt((select id from previous_pick), (select id from next_pick), 'round-robin advances transaction-safely');

select is(
  (public.submit_public_lead(
    'Rate', 'Limit', 'Rate Limit Test', 'rate-limit-test@example.com', '5555550100',
    'Container Home', 'Test City', 'This year', 'test-ip-hash', 'test-email-hash'
  )->>'duplicate')::boolean,
  false,
  'first public lead submission is accepted as a new inquiry'
);
select is(
  (public.submit_public_lead(
    'Rate', 'Limit', 'Rate Limit Test', 'rate-limit-test@example.com', '5555550100',
    'Container Home', 'Test City', 'This year', 'test-ip-hash', 'test-email-hash'
  )->>'duplicate')::boolean,
  true,
  'rapid repeat submission is acknowledged without creating another lead'
);
select is(
  (select count(*)::integer from private.lead_submission_attempts where email_hash = 'test-email-hash'),
  2,
  'duplicate attempts are recorded so rate limits cannot be bypassed'
);

insert into public.deals (id, contact_id, sales_rep_id, base_amount)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 50000);
insert into public.deal_units (deal_id, source, external_unit_id, external_product_type)
values ('40000000-0000-0000-0000-000000000001', 'mock', 'MODEL-LIVING-40', 'CMAC Living 40');

select throws_ok(
  $$select public.complete_deal_sale('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Every unit must have a confirmed non-mock reference', 'mock units cannot be marked sold'
);

delete from public.deal_units where deal_id = '40000000-0000-0000-0000-000000000001';
insert into public.deal_units (deal_id, source, external_unit_id, external_product_type, confirmed_by, confirmed_at)
values ('40000000-0000-0000-0000-000000000001', 'manual', 'REAL-UNIT-001', 'Mini Home', '20000000-0000-0000-0000-000000000002', now());
insert into public.document_templates (id, title, slug, category, provider, provider_template_id, is_active)
values ('50000000-0000-0000-0000-000000000001', 'Test agreement', 'test-agreement', 'legal', 'docusign', 'test-template', true);
insert into public.contracts (deal_id, contact_id, employee_id, template_id, status, provider_envelope_id, completed_at)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'completed', 'test-envelope', now());

select lives_ok($$select public.complete_deal_sale('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')$$, 'confirmed unit with completed contract can be sold');
select lives_ok($$select public.complete_deal_sale('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')$$, 'sale completion is idempotent on retry');
select is((select count(*)::integer from public.unit_sales where deal_id = '40000000-0000-0000-0000-000000000001'), 1, 'one idempotent unit sale exists');
select is((select lifecycle_stage from public.contacts where id = '30000000-0000-0000-0000-000000000001'), 'customer', 'completed sale promotes contact lifecycle');

insert into public.quotes (id, contact_id, employee_id, subtotal, tax, delivery_amount)
values ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 50000, 4125, 3500);
select is((select total from public.quotes where id = '60000000-0000-0000-0000-000000000001'), 57625.00::numeric, 'quote total is generated from subtotal tax and delivery');

select * from finish();
rollback;
