drop function if exists public.complete_deal_sale(uuid, text);

create or replace function public.complete_deal_sale(
  p_deal_id uuid,
  p_actor_employee_id uuid,
  p_override_reason text default null
)
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
  where e.id = p_actor_employee_id and e.active = true;
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

revoke all on function public.complete_deal_sale(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.complete_deal_sale(uuid, uuid, text) to service_role;
