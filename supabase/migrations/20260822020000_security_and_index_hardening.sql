alter table private.lead_assignment_state enable row level security;
alter table private.lead_submission_attempts enable row level security;
alter table private.contract_events enable row level security;
alter table private.audit_log enable row level security;

create index if not exists lead_assignment_state_last_employee_idx on private.lead_assignment_state(last_employee_id);
create index if not exists contract_events_contract_idx on private.contract_events(contract_id);
create index if not exists audit_log_actor_employee_idx on private.audit_log(actor_employee_id);
create index if not exists activities_employee_idx on public.activities(employee_id);
create index if not exists contacts_created_by_idx on public.contacts(created_by);
create index if not exists contracts_contact_idx on public.contracts(contact_id);
create index if not exists contracts_template_idx on public.contracts(template_id);
create index if not exists deal_units_confirmed_by_idx on public.deal_units(confirmed_by);
create index if not exists deals_lead_idx on public.deals(lead_id);
create index if not exists document_templates_created_by_idx on public.document_templates(created_by);
create index if not exists marketing_materials_created_by_idx on public.marketing_materials(created_by);
create index if not exists marketing_send_items_material_idx on public.marketing_send_items(marketing_material_id);
create index if not exists marketing_sends_lead_idx on public.marketing_sends(lead_id);
create index if not exists quotes_deal_idx on public.quotes(deal_id);
create index if not exists quotes_lead_idx on public.quotes(lead_id);
create index if not exists tasks_contact_idx on public.tasks(contact_id);
create index if not exists tasks_deal_idx on public.tasks(deal_id);
create index if not exists tasks_lead_idx on public.tasks(lead_id);

drop policy if exists marketing_material_admin_all on public.marketing_materials;
create policy marketing_material_admin_insert on public.marketing_materials for insert to authenticated
with check ((select private.current_employee_is_admin()));
create policy marketing_material_admin_update on public.marketing_materials for update to authenticated
using ((select private.current_employee_is_admin())) with check ((select private.current_employee_is_admin()));
create policy marketing_material_admin_delete on public.marketing_materials for delete to authenticated
using ((select private.current_employee_is_admin()));

drop policy if exists document_template_admin_all on public.document_templates;
create policy document_template_admin_insert on public.document_templates for insert to authenticated
with check ((select private.current_employee_is_admin()));
create policy document_template_admin_update on public.document_templates for update to authenticated
using ((select private.current_employee_is_admin())) with check ((select private.current_employee_is_admin()));
create policy document_template_admin_delete on public.document_templates for delete to authenticated
using ((select private.current_employee_is_admin()));
