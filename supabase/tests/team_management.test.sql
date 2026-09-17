begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into public.employees(id,email,first_name,last_name,display_name,role,rep_code) values
 ('91000000-0000-4000-8000-000000000001','team.qa.admin@cmaccontainers.com','QA','Admin','QA Admin','admin','TEAM-QA-1'),
 ('91000000-0000-4000-8000-000000000002','team.qa.repa@cmaccontainers.com','QA','Rep A','QA Rep A','sales_rep','TEAM-QA-2'),
 ('91000000-0000-4000-8000-000000000003','team.qa.repb@cmaccontainers.com','QA','Rep B','QA Rep B','sales_rep','TEAM-QA-3');
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
 ('92000000-0000-4000-8000-000000000001','authenticated','authenticated','team.qa.admin@cmaccontainers.com','{"provider":"google","providers":["google"]}','{}',now(),now()),
 ('92000000-0000-4000-8000-000000000002','authenticated','authenticated','team.qa.repa@cmaccontainers.com','{"provider":"google","providers":["google"]}','{}',now(),now()),
 ('92000000-0000-4000-8000-000000000003','authenticated','authenticated','team.qa.repb@cmaccontainers.com','{"provider":"google","providers":["google"]}','{}',now(),now());
insert into public.contacts(id,first_name,display_name,email,assigned_employee_id,created_by) values
 ('93000000-0000-4000-8000-000000000001','QA','QA Customer','team.qa.customer@example.com','91000000-0000-4000-8000-000000000002','91000000-0000-4000-8000-000000000001');
insert into public.leads(id,contact_id,assigned_employee_id,status) values
 ('94000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','new'),
 ('94000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','lost');
insert into public.deals(id,contact_id,sales_rep_id,status) values
 ('95000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','open'),
 ('95000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','lost');
insert into public.tasks(id,contact_id,employee_id,title,due_at,status) values
 ('96000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','QA call',now() - interval '1 day','open'),
 ('96000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','QA finished',now(),'completed');
insert into public.quotes(id,contact_id,deal_id,employee_id,status) values
 ('97000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','draft'),
 ('97000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','95000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','accepted');

select ok(not has_table_privilege('authenticated','public.employees','UPDATE'),'employee changes cannot bypass the admin endpoint');
select ok(not has_column_privilege('authenticated','public.contacts','assigned_employee_id','UPDATE'),'contact ownership cannot bypass the transfer endpoint');
select ok(not has_function_privilege('authenticated','public.admin_reassign_contact(uuid,uuid,uuid,uuid)','EXECUTE'),'browser cannot spoof transfer actor');
select ok(not has_function_privilege('anon','public.admin_team_overview()','EXECUTE'),'anonymous users cannot read team summary');
select throws_ok($$select public.admin_manage_employee('91000000-0000-4000-8000-000000000002','deactivate',null,'91000000-0000-4000-8000-000000000001')$$,'42501','Administrator access is required.','rep cannot manage access');
select throws_ok($$select public.admin_manage_employee('91000000-0000-4000-8000-000000000001','deactivate',null,'91000000-0000-4000-8000-000000000001')$$,'P0001','You cannot remove your own administrator access.','admin self-deactivation blocked');
select throws_ok($$select public.admin_manage_employee('91000000-0000-4000-8000-000000000001','update','{"first_name":"QA","last_name":"Admin","role":"sales_rep"}','91000000-0000-4000-8000-000000000001')$$,'P0001','You cannot remove your own administrator access.','admin self-demotion blocked');

set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.admin_team_overview()$$,'42501','Administrator access is required.','rep cannot query team metrics');
select is((public.portal_dashboard_summary()->>'leads')::int,1,'rep dashboard counts only active assigned leads');
select is((public.portal_dashboard_summary()->>'tasks')::int,1,'rep dashboard excludes completed tasks');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
select is((public.portal_dashboard_summary()->>'leads')::int,0,'other rep cannot count another rep leads');
select throws_ok($$insert into public.tasks(employee_id,contact_id,title,due_at) values ('91000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000001','Unauthorized task',now())$$,'42501',null,'rep cannot attach a task to another employee customer');
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000001',true);
select is((select elem->>'display_name' from jsonb_array_elements(public.admin_team_overview()->'employees') elem where elem->>'id' = '91000000-0000-4000-8000-000000000002'),'QA Rep A','admin resolves employee names');
select is((select (elem->>'overdue')::int from jsonb_array_elements(public.admin_team_overview()->'employees') elem where elem->>'id' = '91000000-0000-4000-8000-000000000002'),1,'team summary counts overdue owned work');
select throws_ok($$insert into public.activities(contact_id,employee_id,activity_type,title) values ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','note_added','Spoofed note')$$,'42501',null,'even admins cannot impersonate another activity author');
reset role;
select set_config('request.jwt.claim.sub','',true);

set local role service_role;
select lives_ok($$select public.manage_lead('91000000-0000-4000-8000-000000000001','create',null,'{"first_name":"QA","last_name":"Lead","email":"team.qa.new@example.com","phone":"8175550100","project_type":"Container home","project_location":"Austin, TX","desired_timing":"1–3 months","assigned_employee_id":"91000000-0000-4000-8000-000000000001"}')$$,'server can create a lead owned by an administrator');
select lives_ok($$select public.admin_manage_employee('91000000-0000-4000-8000-000000000001','update','{"first_name":"QA","last_name":"Rep B","role":"admin"}','91000000-0000-4000-8000-000000000003')$$,'service can promote a rep through verified admin contract');
select lives_ok($$select public.admin_manage_employee('91000000-0000-4000-8000-000000000001','deactivate',null,'91000000-0000-4000-8000-000000000003')$$,'admin can deactivate another employee');
select throws_ok($$select public.admin_reassign_contact('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002')$$,'P0001','Choose an active employee.','inactive transfer target rejected');
select lives_ok($$select public.admin_manage_employee('91000000-0000-4000-8000-000000000001','activate',null,'91000000-0000-4000-8000-000000000003')$$,'reactivation works');
select lives_ok($$select public.admin_manage_employee('91000000-0000-4000-8000-000000000001','update','{"first_name":"QA","last_name":"Rep B","role":"sales_rep"}','91000000-0000-4000-8000-000000000003')$$,'another admin can change roles');
select throws_ok($$select public.admin_reassign_contact('91000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002')$$,'42501','Administrator access is required.','rep cannot reassign customers');
select throws_ok($$select public.admin_reassign_contact('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',null)$$,'P0001','Ownership changed since this page was opened. Refresh and try again.','stale ownership blocks transfer');
select lives_ok($$select public.admin_reassign_contact('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002')$$,'admin transfers contact and open work atomically');
select is(public.admin_reassign_contact('91000000-0000-4000-8000-000000000001','93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','91000000-0000-4000-8000-000000000002')->>'unchanged','true','retrying transfer is idempotent');
reset role;
select is((select assigned_employee_id::text from public.contacts where id='93000000-0000-4000-8000-000000000001'),'91000000-0000-4000-8000-000000000003','customer owner transferred');
select is((select assigned_employee_id::text from public.leads where id='94000000-0000-4000-8000-000000000001'),'91000000-0000-4000-8000-000000000003','active lead transferred');
select is((select assigned_employee_id::text from public.leads where id='94000000-0000-4000-8000-000000000002'),'91000000-0000-4000-8000-000000000002','closed lead history retained');
select is((select sales_rep_id::text from public.deals where id='95000000-0000-4000-8000-000000000001'),'91000000-0000-4000-8000-000000000003','open deal transferred');
select is((select sales_rep_id::text from public.deals where id='95000000-0000-4000-8000-000000000002'),'91000000-0000-4000-8000-000000000002','closed deal history retained');
select is((select employee_id::text from public.tasks where id='96000000-0000-4000-8000-000000000001'),'91000000-0000-4000-8000-000000000003','open follow-up transferred');
select is((select employee_id::text from public.tasks where id='96000000-0000-4000-8000-000000000002'),'91000000-0000-4000-8000-000000000002','completed follow-up history retained');
select is((select employee_id::text from public.quotes where id='97000000-0000-4000-8000-000000000001'),'91000000-0000-4000-8000-000000000003','draft quote transferred');
select is((select employee_id::text from public.quotes where id='97000000-0000-4000-8000-000000000002'),'91000000-0000-4000-8000-000000000002','accepted quote history retained');
select is((select count(*)::int from private.audit_log where entity_id='93000000-0000-4000-8000-000000000001' and action='contact_reassigned'),1,'transfer has one audit entry');
select is((select count(*)::int from public.activities where contact_id='93000000-0000-4000-8000-000000000001' and title='Customer ownership transferred'),1,'transfer has one named timeline event');
set local role authenticated;
select set_config('request.jwt.claim.sub','92000000-0000-4000-8000-000000000003',true);
select lives_ok($$update public.tasks set status='completed' where id='96000000-0000-4000-8000-000000000001'$$,'new owner can complete transferred follow-up');
select is((select count(*)::int from public.activities where contact_id='93000000-0000-4000-8000-000000000001' and title='Follow-up completed' and employee_id='91000000-0000-4000-8000-000000000003'),1,'follow-up completion logs actual employee');
select lives_ok($$insert into public.deals(contact_id,sales_rep_id,project_name) values ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','QA portal draft')$$,'rep can save a new deal with an automatic activity event');
select is((select count(*)::int from public.activities where contact_id='93000000-0000-4000-8000-000000000001' and title='Deal created' and employee_id='91000000-0000-4000-8000-000000000003'),1,'deal save records the actual rep');
select lives_ok($$insert into public.quotes(contact_id,employee_id,subtotal) values ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003',50000)$$,'rep can create a quote with an automatic activity event');
select is((select count(*)::int from public.activities where contact_id='93000000-0000-4000-8000-000000000001' and title='Quote created' and employee_id='91000000-0000-4000-8000-000000000003'),1,'quote save records the actual rep');
reset role;
update public.employees set active=false where id='91000000-0000-4000-8000-000000000003';
set local role authenticated;
select throws_ok($$select public.portal_dashboard_summary()$$,'42501','Active employee access is required.','deactivated employee cannot read dashboard metrics');
reset role;
select * from finish();
rollback;
