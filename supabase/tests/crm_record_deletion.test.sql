begin;
create extension if not exists pgtap with schema extensions;
select no_plan();
insert into public.employees(id,email,first_name,last_name,display_name,role,rep_code) values
 ('b1000000-0000-4000-8000-000000000001','delete.qa.admin@cmaccontainers.com','QA','Admin','Delete QA Admin','admin','DEL-QA-1'),
 ('b1000000-0000-4000-8000-000000000002','delete.qa.repa@cmaccontainers.com','QA','Rep A','Delete QA Rep A','sales_rep','DEL-QA-2'),
 ('b1000000-0000-4000-8000-000000000003','delete.qa.repb@cmaccontainers.com','QA','Rep B','Delete QA Rep B','sales_rep','DEL-QA-3');
insert into public.employees(id,email,first_name,last_name,display_name,role,rep_code,active) values
 ('b1000000-0000-4000-8000-000000000004','delete.qa.gone@cmaccontainers.com','QA','Gone','Delete QA Gone','sales_rep','DEL-QA-4',false);
insert into public.contacts(id,first_name,display_name,email,assigned_employee_id,created_by) values
 ('b3000000-0000-4000-8000-000000000001','QA','Delete QA One','delete.qa.one@example.com','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001'),
 ('b3000000-0000-4000-8000-000000000002','QA','Delete QA Two','delete.qa.two@example.com','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001'),
 ('b3000000-0000-4000-8000-000000000003','QA','Delete QA Three','delete.qa.three@example.com','b1000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000001'),
 ('b3000000-0000-4000-8000-000000000004','QA','Delete QA Four','delete.qa.four@example.com','b1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000001'),
 ('b3000000-0000-4000-8000-000000000005','QA','Delete QA Five','delete.qa.five@example.com',null,'b1000000-0000-4000-8000-000000000001');
insert into public.leads(id,contact_id,assigned_employee_id,status,project_type,project_location) values
 ('b4000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','new','Container home','Austin, TX'),
 ('b4000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','contacted','Office or studio','Austin, TX'),
 ('b4000000-0000-4000-8000-000000000003','b3000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','converted','Container home','Austin, TX'),
 ('b4000000-0000-4000-8000-000000000004','b3000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000003','new','Container home','Austin, TX'),
 ('b4000000-0000-4000-8000-000000000005','b3000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000002','new','Container home','Austin, TX'),
 ('b4000000-0000-4000-8000-000000000006','b3000000-0000-4000-8000-000000000004','b1000000-0000-4000-8000-000000000003','new','Container home','Austin, TX');
insert into public.deals(id,contact_id,lead_id,sales_rep_id,status) values
 ('b5000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000003','b1000000-0000-4000-8000-000000000002','open');
insert into public.tasks(id,contact_id,lead_id,employee_id,title,due_at) values
 ('b6000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','QA follow-up on lead one',now()),
 ('b6000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001',null,'b1000000-0000-4000-8000-000000000002','QA follow-up on the customer',now());
insert into public.activities(contact_id,lead_id,employee_id,activity_type,title) values
 ('b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','note_added','QA note on lead one');

select ok(not has_function_privilege('authenticated','public.delete_crm_record(uuid,text,uuid)','EXECUTE'),'browser sessions cannot call the delete workflow directly');
select ok(not has_function_privilege('anon','public.delete_crm_record(uuid,text,uuid)','EXECUTE'),'anonymous callers cannot call the delete workflow');
select ok(not has_table_privilege('authenticated','public.leads','DELETE'),'lead rows cannot be deleted from the browser');
select ok(not has_table_privilege('authenticated','public.contacts','DELETE'),'customer rows cannot be deleted from the browser');

set local role service_role;

-- Who may delete.
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000004','lead','b4000000-0000-4000-8000-000000000001')$$,'42501','An active employee account is required','a deactivated employee cannot delete');
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000003','lead','b4000000-0000-4000-8000-000000000001')$$,'42501','You can only delete leads assigned to you','a representative cannot delete another representative''s lead');
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000003','contact','b3000000-0000-4000-8000-000000000001')$$,'42501','You can only delete customers assigned to you','a representative cannot delete another representative''s customer');
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000002','contact','b3000000-0000-4000-8000-000000000005')$$,'42501','You can only delete customers assigned to you','a representative cannot delete an unassigned customer');
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000002','contact','b3000000-0000-4000-8000-000000000004')$$,'42501','You can only delete customers assigned to you','a representative cannot delete a customer that carries a colleague''s lead');
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000001','deal','b5000000-0000-4000-8000-000000000001')$$,'22023','Choose a lead or customer to delete','only leads and customers can be deleted here');
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000001','lead','b4999999-0000-4000-8000-000000000009')$$,'P0002','Lead not found','a missing lead is reported, not ignored');

-- Sales history is protected, even from administrators.
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000001','lead','b4000000-0000-4000-8000-000000000003')$$,'22023','This lead became a deal and is part of its history. It cannot be deleted.','a converted lead cannot be deleted');
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000001','contact','b3000000-0000-4000-8000-000000000002')$$,'22023','This customer has deals, quotes, contracts, or sent marketing on record and cannot be deleted. Mark them inactive instead.','a customer with a deal cannot be deleted');
select is((select count(*)::int from public.deals where id='b5000000-0000-4000-8000-000000000001'),1,'the protected deal is untouched');

-- A representative deletes their own lead.
select is((public.delete_crm_record('b1000000-0000-4000-8000-000000000002','lead','b4000000-0000-4000-8000-000000000001')->>'deleted')::boolean,true,'a representative can delete a lead they own');
select is((select count(*)::int from public.leads where id='b4000000-0000-4000-8000-000000000001'),0,'the lead is gone');
select is((select count(*)::int from public.tasks where id='b6000000-0000-4000-8000-000000000001'),0,'the lead''s follow-up went with it');
select is((select count(*)::int from public.tasks where id='b6000000-0000-4000-8000-000000000002'),1,'the customer''s own follow-up is kept');
select is((select count(*)::int from public.contacts where id='b3000000-0000-4000-8000-000000000001'),1,'deleting a lead keeps the customer');
select is((select count(*)::int from public.leads where id='b4000000-0000-4000-8000-000000000002'),1,'the customer''s other lead is kept');
select is((select title from public.activities where contact_id='b3000000-0000-4000-8000-000000000001' and title='Lead deleted'),'Lead deleted','the customer timeline records the deletion');
select throws_ok($$select public.delete_crm_record('b1000000-0000-4000-8000-000000000002','lead','b4000000-0000-4000-8000-000000000001')$$,'P0002','Lead not found','deleting twice is reported, not silently repeated');

-- A representative deletes their own customer; an administrator deletes anyone's.
select is((public.delete_crm_record('b1000000-0000-4000-8000-000000000002','contact','b3000000-0000-4000-8000-000000000001')->>'leads_removed')::int,1,'a representative can delete a customer they own, with its remaining lead');
select is((select count(*)::int from public.contacts where id='b3000000-0000-4000-8000-000000000001'),0,'the customer is gone');
select is((select count(*)::int from public.leads where contact_id='b3000000-0000-4000-8000-000000000001'),0,'the customer''s leads are gone');
select is((select count(*)::int from public.tasks where id='b6000000-0000-4000-8000-000000000002'),0,'the customer''s follow-ups are gone');
select is((public.delete_crm_record('b1000000-0000-4000-8000-000000000001','contact','b3000000-0000-4000-8000-000000000004')->>'leads_removed')::int,2,'an administrator can delete a customer that spans two representatives');
select is((public.delete_crm_record('b1000000-0000-4000-8000-000000000001','contact','b3000000-0000-4000-8000-000000000005')->>'deleted')::boolean,true,'an administrator can delete an unassigned customer');
select is((select count(*)::int from public.contacts where id='b3000000-0000-4000-8000-000000000003'),1,'unrelated customers are untouched');
reset role;

-- Everything removed is recoverable from the audit log.
select is((select count(*)::int from private.audit_log where action='lead_deleted' and entity_id='b4000000-0000-4000-8000-000000000001'),1,'the deleted lead is in the audit log');
select is((select metadata->'lead'->>'project_type' from private.audit_log where action='lead_deleted' and entity_id='b4000000-0000-4000-8000-000000000001'),'Container home','the audit entry holds the full lead');
select is((select jsonb_array_length(metadata->'tasks') from private.audit_log where action='lead_deleted' and entity_id='b4000000-0000-4000-8000-000000000001'),1,'the audit entry holds the lead''s follow-ups');
-- Two entries: the note above, and the "Follow-up scheduled" entry the task trigger wrote.
select is((select jsonb_array_length(metadata->'activities') from private.audit_log where action='lead_deleted' and entity_id='b4000000-0000-4000-8000-000000000001'),2,'the audit entry holds the lead''s timeline');
select is((select metadata->'contact'->>'email' from private.audit_log where action='contact_deleted' and entity_id='b3000000-0000-4000-8000-000000000001'),'delete.qa.one@example.com','the audit entry holds the full customer');
select is((select jsonb_array_length(metadata->'leads') from private.audit_log where action='contact_deleted' and entity_id='b3000000-0000-4000-8000-000000000004'),2,'the audit entry holds every lead removed with a customer');
select is((select actor_employee_id::text from private.audit_log where action='contact_deleted' and entity_id='b3000000-0000-4000-8000-000000000001'),'b1000000-0000-4000-8000-000000000002','the audit entry names who deleted it');

select * from finish();
rollback;
