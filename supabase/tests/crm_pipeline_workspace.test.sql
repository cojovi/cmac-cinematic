begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into public.employees(id,email,first_name,last_name,display_name,role,rep_code) values
 ('a1000000-0000-4000-8000-000000000001','pipeline.qa.admin@cmaccontainers.com','QA','Admin','Pipeline QA Admin','admin','PIPE-QA-1'),
 ('a1000000-0000-4000-8000-000000000002','pipeline.qa.repa@cmaccontainers.com','QA','Rep A','Pipeline QA Rep A','sales_rep','PIPE-QA-2'),
 ('a1000000-0000-4000-8000-000000000003','pipeline.qa.repb@cmaccontainers.com','QA','Rep B','Pipeline QA Rep B','sales_rep','PIPE-QA-3');
insert into public.contacts(id,first_name,display_name,email,phone,assigned_employee_id,created_by) values
 ('a3000000-0000-4000-8000-000000000001','QA','Pipeline QA One','pipeline.qa.one@example.com','8175550101','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001'),
 ('a3000000-0000-4000-8000-000000000002','QA','Pipeline QA Two','pipeline.qa.two@example.com','8175550102','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001'),
 ('a3000000-0000-4000-8000-000000000003','QA','Pipeline QA Three','pipeline.qa.three@example.com','8175550103','a1000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001'),
 ('a3000000-0000-4000-8000-000000000004','QA','Pipeline QA Four','pipeline.qa.four@example.com','8175550104','a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001');
insert into public.leads(id,contact_id,assigned_employee_id,status,source,project_type,project_location,desired_timing,lost_reason) values
 ('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002','new','website','Container home','Austin, TX','1–3 months',null),
 ('a4000000-0000-4000-8000-000000000002','a3000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002','lost','phone','Container home','Austin, TX','1–3 months','Budget'),
 ('a4000000-0000-4000-8000-000000000003','a3000000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000003','new','website','Container home','Austin, TX','1–3 months',null),
 ('a4000000-0000-4000-8000-000000000004','a3000000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000002','qualified','referral','Container home','Austin, TX','1–3 months',null);

select ok(not has_function_privilege('authenticated','public.manage_lead(uuid,text,uuid,jsonb)','EXECUTE'),'browser sessions still cannot call the lead workflow directly');
select ok(not has_function_privilege('anon','public.manage_lead(uuid,text,uuid,jsonb)','EXECUTE'),'anonymous callers cannot call the lead workflow');
select ok(not has_table_privilege('authenticated','public.leads','UPDATE'),'lead rows still cannot be patched from the browser');

set local role service_role;

-- An owner can work their own pipeline.
select lives_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','set_status','a4000000-0000-4000-8000-000000000001','{"status":"contacted"}')$$,'a representative can move a lead they own');
select is((select status from public.leads where id='a4000000-0000-4000-8000-000000000001'),'contacted','the new stage is saved');
select is((select count(*)::int from public.activities where lead_id='a4000000-0000-4000-8000-000000000001' and activity_type='status_changed'),1,'the stage move is written to the timeline');
select is((select employee_id::text from public.activities where lead_id='a4000000-0000-4000-8000-000000000001' and activity_type='status_changed'),'a1000000-0000-4000-8000-000000000002','the timeline credits the representative who moved it');
select is((public.manage_lead('a1000000-0000-4000-8000-000000000002','set_status','a4000000-0000-4000-8000-000000000001','{"status":"contacted"}')->>'unchanged')::boolean,true,'repeating the same move is reported as unchanged');
select is((select count(*)::int from public.activities where lead_id='a4000000-0000-4000-8000-000000000001' and activity_type='status_changed'),1,'a repeated move does not add a second timeline entry');

-- Ownership boundary.
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000003','set_status','a4000000-0000-4000-8000-000000000001','{"status":"qualified"}')$$,'42501','You can only change leads assigned to you','a representative cannot move another representative''s lead');
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','convert','a4000000-0000-4000-8000-000000000003','{}')$$,'42501','You can only change leads assigned to you','a representative cannot convert another representative''s lead');
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','update','a4000000-0000-4000-8000-000000000001','{"assigned_employee_id":"a1000000-0000-4000-8000-000000000003"}')$$,'42501','Administrator access is required to edit or reassign leads','a representative still cannot reassign or edit a lead');
select is((select assigned_employee_id::text from public.leads where id='a4000000-0000-4000-8000-000000000001'),'a1000000-0000-4000-8000-000000000002','ownership is unchanged after the refused reassignment');

-- Closing and reopening.
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','set_status','a4000000-0000-4000-8000-000000000001','{"status":"lost"}')$$,'22023','A lost reason is required before closing a lead','a lead cannot be lost without a reason');
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','set_status','a4000000-0000-4000-8000-000000000001','{"status":"archived"}')$$,'42501','Administrator access is required to archive or reopen a lead','a representative cannot archive a lead');
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','set_status','a4000000-0000-4000-8000-000000000001','{"status":"converted"}')$$,'22023','Choose a valid pipeline status','conversion cannot be faked through a status change');
select lives_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','set_status','a4000000-0000-4000-8000-000000000001','{"status":"lost","lost_reason":"  Chose another builder  "}')$$,'a representative can close their own lead as lost with a reason');
select is((select lost_reason from public.leads where id='a4000000-0000-4000-8000-000000000001'),'Chose another builder','the lost reason is stored trimmed');
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','set_status','a4000000-0000-4000-8000-000000000001','{"status":"new"}')$$,'42501','Administrator access is required to archive or reopen a lead','a representative cannot reopen a closed lead');
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','convert','a4000000-0000-4000-8000-000000000002','{}')$$,'42501','Administrator access is required to convert a closed lead','a representative cannot convert a lost lead');
select lives_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000001','set_status','a4000000-0000-4000-8000-000000000001','{"status":"nurturing"}')$$,'an administrator can reopen a lost lead');
select is((select lost_reason from public.leads where id='a4000000-0000-4000-8000-000000000001'),null,'reopening clears the lost reason');
select lives_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000001','set_status','a4000000-0000-4000-8000-000000000002','{"status":"archived"}')$$,'an administrator can archive a lead');

-- Owner conversion.
select lives_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','convert','a4000000-0000-4000-8000-000000000004','{"assigned_employee_id":"a1000000-0000-4000-8000-000000000003"}')$$,'a representative can convert their own qualified lead');
select is((select sales_rep_id::text from public.deals where lead_id='a4000000-0000-4000-8000-000000000004'),'a1000000-0000-4000-8000-000000000002','the deal stays with the converting owner even if the request names someone else');
select is((select status from public.leads where id='a4000000-0000-4000-8000-000000000004'),'converted','the converted lead is locked as converted');
select is((select lifecycle_stage from public.contacts where id='a3000000-0000-4000-8000-000000000004'),'prospect','conversion advances the customer lifecycle');
select is((public.manage_lead('a1000000-0000-4000-8000-000000000002','convert','a4000000-0000-4000-8000-000000000004','{}')->>'message'),'This lead already has a deal.','converting twice returns the existing deal');
select is((select count(*)::int from public.deals where lead_id='a4000000-0000-4000-8000-000000000004'),1,'a repeated conversion does not create a second deal');
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000002','set_status','a4000000-0000-4000-8000-000000000004','{"status":"new"}')$$,'22023','Converted leads are locked; continue from the linked deal','a converted lead cannot be moved back');

-- New source value.
select lives_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000001','create',null,'{"first_name":"QA","last_name":"Scan","email":"pipeline.qa.scan@example.com","phone":"8175550199","source":"qr_code","project_type":"Container home","project_location":"Burleson, TX","desired_timing":"As soon as possible","assigned_employee_id":"a1000000-0000-4000-8000-000000000002"}')$$,'an on-site QR inquiry can be recorded as its own lead source');
select is((select l.source from public.leads l join public.contacts c on c.id=l.contact_id where c.email='pipeline.qa.scan@example.com'),'qr_code','the QR source is stored');
select throws_ok($$select public.manage_lead('a1000000-0000-4000-8000-000000000001','create',null,'{"first_name":"QA","last_name":"Bad","email":"pipeline.qa.bad@example.com","phone":"8175550198","source":"billboard","project_type":"Container home","project_location":"Burleson, TX","desired_timing":"As soon as possible"}')$$,'22023','Complete all required lead fields with valid information','unknown sources are still rejected');
reset role;
select is((select count(*)::int from private.audit_log where action='lead_status_changed' and entity_id in ('a4000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000002')),4,'every stage change is in the audit log');

select * from finish();
rollback;
