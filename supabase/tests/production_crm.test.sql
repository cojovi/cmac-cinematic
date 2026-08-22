begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

select has_table('public', 'employees', 'employees table exists');
select has_table('public', 'contacts', 'contacts table exists');
select has_table('public', 'leads', 'leads table exists');
select has_table('public', 'deals', 'deals table exists');
select has_table('public', 'unit_sales', 'unit attribution table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.contacts'::regclass), 'contacts RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.deals'::regclass), 'deals RLS is enabled');
select ok(not has_function_privilege('authenticated', 'public.admin_manage_employee(uuid,text,jsonb,uuid)', 'EXECUTE'), 'browser users cannot call admin service RPC');
select ok(not has_function_privilege('anon', 'public.submit_public_lead(text,text,text,citext,text,text,text,text,text,text)', 'EXECUTE'), 'anonymous clients cannot bypass the lead Edge Function');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@cmaccontainers.com', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'repa@cmaccontainers.com', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'repb@cmaccontainers.com', '', now(), '{"provider":"google","providers":["google"]}', '{}', now(), now());

insert into public.employees (id, auth_user_id, email, first_name, last_name, display_name, role, rep_code)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'admin@cmaccontainers.com', 'Ada', 'Admin', 'Ada Admin', 'admin', 'CMAC-T001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'repa@cmaccontainers.com', 'Riley', 'Rep', 'Riley Rep', 'sales_rep', 'CMAC-T002'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'repb@cmaccontainers.com', 'Reese', 'Rep', 'Reese Rep', 'sales_rep', 'CMAC-T003');

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

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.contacts), 1, 'Rep A sees only owned contacts');
select is((select private.current_employee_id()), '20000000-0000-0000-0000-000000000002'::uuid, 'Rep A resolves to live employee identity');
select is((select private.current_employee_is_admin()), false, 'Rep A is not admin');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.contacts), 1, 'Rep B sees only owned contacts');

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select is((select count(*)::integer from public.contacts), 2, 'Admin sees company-wide contacts');
select is((select private.current_employee_is_admin()), true, 'Admin helper recognizes active admin');
reset role;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok($$select count(*) from public.contacts$$, '42501', 'permission denied for table contacts', 'Anonymous user has no direct CRM table grant');
reset role;

update public.employees set active = false where id = '20000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.contacts), 0, 'Deactivated rep immediately loses data access');
reset role;
update public.employees set active = true where id = '20000000-0000-0000-0000-000000000002';

update private.lead_assignment_state set last_employee_id = null where singleton;
select is((select private.assign_next_sales_rep()), '20000000-0000-0000-0000-000000000002'::uuid, 'round-robin begins with first active rep code');
select is((select private.assign_next_sales_rep()), '20000000-0000-0000-0000-000000000003'::uuid, 'round-robin advances transaction-safely');

insert into public.deals (id, contact_id, sales_rep_id, base_amount)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 50000);
insert into public.deal_units (deal_id, source, external_unit_id, external_product_type)
values ('40000000-0000-0000-0000-000000000001', 'mock', 'MODEL-LIVING-40', 'CMAC Living 40');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.complete_deal_sale('40000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Every unit must have a confirmed non-mock reference', 'mock units cannot be marked sold'
);
reset role;

delete from public.deal_units where deal_id = '40000000-0000-0000-0000-000000000001';
insert into public.deal_units (deal_id, source, external_unit_id, external_product_type, confirmed_by, confirmed_at)
values ('40000000-0000-0000-0000-000000000001', 'manual', 'REAL-UNIT-001', 'Mini Home', '20000000-0000-0000-0000-000000000002', now());
insert into public.document_templates (id, title, slug, category, provider, provider_template_id, is_active)
values ('50000000-0000-0000-0000-000000000001', 'Test agreement', 'test-agreement', 'legal', 'docusign', 'test-template', true);
insert into public.contracts (deal_id, contact_id, employee_id, template_id, status, provider_envelope_id, completed_at)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'completed', 'test-envelope', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select lives_ok($$select public.complete_deal_sale('40000000-0000-0000-0000-000000000001')$$, 'confirmed unit with completed contract can be sold');
select lives_ok($$select public.complete_deal_sale('40000000-0000-0000-0000-000000000001')$$, 'sale completion is idempotent on retry');
select is((select count(*)::integer from public.unit_sales where deal_id = '40000000-0000-0000-0000-000000000001'), 1, 'one idempotent unit sale exists');
select is((select lifecycle_stage from public.contacts where id = '30000000-0000-0000-0000-000000000001'), 'customer', 'completed sale promotes contact lifecycle');
reset role;

insert into public.quotes (id, contact_id, employee_id, subtotal, tax, delivery_amount)
values ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 50000, 4125, 3500);
select is((select total from public.quotes where id = '60000000-0000-0000-0000-000000000001'), 57625.00::numeric, 'quote total is generated from subtotal tax and delivery');

select * from finish();
rollback;
