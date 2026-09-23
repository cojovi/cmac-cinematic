-- QR intake is independent of team-management rollout. No existing CRM policies change.
create table public.qr_visits (
  id uuid primary key,
  created_at timestamptz not null default now()
);
create index qr_visits_created_at_idx on public.qr_visits(created_at);
create table public.qr_submissions (
  id uuid primary key,
  visit_id uuid references public.qr_visits(id) on delete set null,
  name text not null check (length(name) between 2 and 120),
  email extensions.citext not null check (length(email::text) <= 254 and email::text ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  phone text not null check (length(phone) <= 40 and length(regexp_replace(phone,'[^0-9]','','g')) between 7 and 15),
  location text not null check (location in ('Burleson, Texas','Weatherford, Texas')),
  timing text not null check (timing in ('Immediately','In 30 days or less','In the next 30-90 days','Not sure, just curious to learn more')),
  units text not null check (units in ('1-4 units','5-9 units','10+ units')),
  use text not null check (use in ('Short-term rental','Mother-in-law suite','Hunting or fishing cabin','Workforce housing')),
  payment text not null check (payment in ('Cash','Financing')),
  credit text not null default '',
  email_status text not null default 'pending' check (email_status in ('pending','sending','sent','failed','not_configured','unknown')),
  email_error text,
  provider_message_id text,
  attempts integer not null default 0 check (attempts between 0 and 5),
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint qr_credit_answer check ((payment = 'Cash' and credit = '') or (payment = 'Financing' and credit in ('Yes','No')))
);
create index qr_submissions_created_at_idx on public.qr_submissions(created_at desc);
create index qr_submissions_visit_idx on public.qr_submissions(visit_id);
create index qr_submissions_email_status_idx on public.qr_submissions(email_status);
create table private.qr_submission_keys (
  submission_id uuid primary key references public.qr_submissions(id) on delete cascade,
  fingerprint text not null check (length(fingerprint) = 64)
);
create table private.qr_rate_windows (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 1,
  primary key(key,window_start)
);
alter table public.qr_visits enable row level security;
alter table public.qr_submissions enable row level security;
alter table private.qr_submission_keys enable row level security;
alter table private.qr_rate_windows enable row level security;
revoke all on public.qr_visits, public.qr_submissions from public, anon, authenticated;
revoke all on private.qr_submission_keys, private.qr_rate_windows from public, anon, authenticated;
grant select on public.qr_visits, public.qr_submissions to authenticated;
grant select, insert, update, delete on public.qr_visits, public.qr_submissions, private.qr_submission_keys, private.qr_rate_windows to service_role;
grant usage on schema private to service_role;
create policy qr_visits_admin_read on public.qr_visits for select to authenticated using ((select private.current_employee_is_admin()));
create policy qr_submissions_admin_read on public.qr_submissions for select to authenticated using ((select private.current_employee_is_admin()));

create function private.qr_take_rate_limit(p_key text, p_limit integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare hit_count integer;
begin
  insert into private.qr_rate_windows(key,window_start) values(p_key,date_trunc('hour',now()))
  on conflict(key,window_start) do update set hits = private.qr_rate_windows.hits + 1 returning hits into hit_count;
  if hit_count > p_limit then raise exception 'Too many requests. Please try again later.' using errcode='P0001'; end if;
  delete from private.qr_rate_windows where window_start < now() - interval '2 days';
end; $$;
revoke all on function private.qr_take_rate_limit(text,integer) from public, anon, authenticated;
grant execute on function private.qr_take_rate_limit(text,integer) to service_role;

create function public.record_qr_visit(p_visit_id uuid, p_ip_hash text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if p_visit_id is null or p_ip_hash is null or length(p_ip_hash) <> 64 then raise exception 'Invalid visit.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('qr-visit:' || p_visit_id::text,0));
  if exists(select 1 from public.qr_visits where id=p_visit_id) then return; end if;
  perform private.qr_take_rate_limit('visit:' || p_ip_hash,60);
  insert into public.qr_visits(id) values(p_visit_id);
end; $$;
revoke all on function public.record_qr_visit(uuid,text) from public, anon, authenticated;
grant execute on function public.record_qr_visit(uuid,text) to service_role;

create function public.submit_qr_inquiry(p_id uuid,p_visit_id uuid,p_answers jsonb,p_fingerprint text,p_ip_hash text,p_email_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare existing_fingerprint text; actual_visit uuid;
begin
  if p_id is null or p_fingerprint is null or length(p_fingerprint) <> 64 or p_ip_hash is null or length(p_ip_hash) <> 64 or p_email_hash is null or length(p_email_hash) <> 64 then raise exception 'Invalid inquiry.' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('qr-submission:' || p_id::text,0));
  select fingerprint into existing_fingerprint from private.qr_submission_keys where submission_id=p_id;
  if found then
    if existing_fingerprint <> p_fingerprint then raise exception 'This request was already submitted with different answers. Reload to start a new inquiry.' using errcode='22023'; end if;
    return jsonb_build_object('created',false,'email_status',(select email_status from public.qr_submissions where id=p_id));
  end if;
  perform private.qr_take_rate_limit('submit:' || p_ip_hash,10);
  perform private.qr_take_rate_limit('email:' || p_email_hash,3);
  -- Tracking is best effort. Never invent a visit when analytics was blocked.
  select id into actual_visit from public.qr_visits where id=p_visit_id;
  insert into public.qr_submissions(id,visit_id,name,email,phone,location,timing,units,use,payment,credit)
  values(p_id,actual_visit,p_answers->>'name',lower(p_answers->>'email'),p_answers->>'phone',p_answers->>'location',p_answers->>'timing',p_answers->>'units',p_answers->>'use',p_answers->>'payment',case when p_answers->>'payment'='Cash' then '' else p_answers->>'credit' end);
  insert into private.qr_submission_keys(submission_id,fingerprint) values(p_id,p_fingerprint);
  return jsonb_build_object('created',true,'email_status','pending');
end; $$;
revoke all on function public.submit_qr_inquiry(uuid,uuid,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_qr_inquiry(uuid,uuid,jsonb,text,text,text) to service_role;

-- An atomic claim prevents concurrent public retries or admin clicks sending twice.
create function public.claim_qr_notification(p_id uuid) returns setof public.qr_submissions
language sql security invoker set search_path = '' as $$
  update public.qr_submissions set email_status='sending',email_error=null,attempts=attempts+1,last_attempt_at=now()
  where id=p_id and email_status in ('pending','failed','not_configured') and attempts < 5
    and (last_attempt_at is null or last_attempt_at < now() - interval '1 minute')
  returning *;
$$;
revoke all on function public.claim_qr_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_qr_notification(uuid) to service_role;

create function public.qr_admin_report(p_days integer default 30,p_offset integer default 0) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare since_at timestamptz;
begin
  if not private.current_employee_is_admin() then raise exception 'Administrator access is required.' using errcode='42501'; end if;
  if p_days is null or p_days not in (0,7,30,90) or p_offset is null or p_offset < 0 or p_offset > 100000 then raise exception 'Invalid reporting range.' using errcode='22023'; end if;
  since_at := case when p_days=0 then '-infinity'::timestamptz else now() - make_interval(days=>p_days) end;
  return jsonb_build_object(
    'visits',(select count(*) from public.qr_visits where created_at>=since_at),
    'submissions',(select count(*) from public.qr_submissions where created_at>=since_at),
    'sent',(select count(*) from public.qr_submissions where created_at>=since_at and email_status='sent'),
    'attention',(select count(*) from public.qr_submissions where created_at>=since_at and email_status<>'sent'),
    'converted_visits',(select count(*) from public.qr_visits v where v.created_at>=since_at and exists(select 1 from public.qr_submissions s where s.visit_id=v.id)),
    'generated_at',now(),
    'rows',coalesce((select jsonb_agg(to_jsonb(r)) from (select id,name,email,phone,location,timing,units,use,payment,credit,email_status,email_error,attempts,created_at,sent_at from public.qr_submissions where created_at>=since_at order by created_at desc,id limit 25 offset p_offset) r),'[]'::jsonb)
  );
end; $$;
revoke all on function public.qr_admin_report(integer,integer) from public, anon, authenticated;
grant execute on function public.qr_admin_report(integer,integer) to authenticated;
