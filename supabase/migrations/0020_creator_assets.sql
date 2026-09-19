-- 0020: a customer's own logo, avatar and handle (R3 / P-05).
-- `orgs.assets` holds what the workspace uploaded once; `sets.instructions`
-- records what a particular set was told to use, so a set stays reproducible
-- after the workspace changes its logo. Files live in a private bucket the
-- workspace owner writes and its members read.
alter table public.orgs add column if not exists assets jsonb not null default '{}'::jsonb;
alter table public.sets add column if not exists instructions jsonb;

insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false)
on conflict (id) do nothing;

drop policy if exists uploads_member_read on storage.objects;
drop policy if exists uploads_owner_write on storage.objects;
drop policy if exists uploads_owner_update on storage.objects;
drop policy if exists uploads_owner_delete on storage.objects;

-- every object sits under <org_id>/…, so the first folder is the tenant
create policy uploads_member_read on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and ((storage.foldername(name))[1])::uuid in (select public.my_org_ids()));
create policy uploads_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and public.is_org_owner(((storage.foldername(name))[1])::uuid));
create policy uploads_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'uploads' and public.is_org_owner(((storage.foldername(name))[1])::uuid));
create policy uploads_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and public.is_org_owner(((storage.foldername(name))[1])::uuid));

-- the gate carries the instructions onto the row it creates (members cannot
-- write a set themselves: sets_member_update_guard allows only cancel_requested)
create or replace function public.fc_reserve_set(
  p_org uuid, p_campaign text, p_ask text, p_style text,
  p_min integer, p_max integer, p_lane text,
  p_hd boolean default false, p_creator uuid default null, p_look text default null,
  p_instructions jsonb default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_plan public.plans%rowtype;
  v_org public.orgs%rowtype;
  v_period date;
  v_cap integer;
  v_used integer;
  v_need integer;
  v_from_allow integer;
  v_from_bal integer;
  v_reserve numeric;
  v_spend_cap numeric;
  v_cogs numeric;
  v_reserved numeric;
  v_id uuid;
  v_floor integer;
begin
  if p_org is null or not (p_org in (select public.my_org_ids())) then
    raise exception 'FC_NOT_MEMBER' using errcode = '42501';
  end if;
  if p_lane not in ('batch','priority') then raise exception 'FC_BAD_LANE'; end if;

  select * into v_org from public.orgs where id = p_org for update;
  v_floor := case when v_org.is_demo then 4 else 5 end;
  if p_min is null or p_max is null or p_min < v_floor or p_max > 10 or p_min > p_max then raise exception 'FC_BAD_RANGE'; end if;
  if not exists (select 1 from public.campaigns c where c.id = p_campaign and (c.org_id is null or c.org_id = p_org) and c.status = 'live') then
    raise exception 'FC_NO_CAMPAIGN';
  end if;

  select * into v_plan from public.plans where id = v_org.plan;
  if p_hd and v_plan.hd_per_slide_usd is null then raise exception 'FC_NO_HD'; end if;
  v_need := p_max * (case when p_hd then 3 else 1 end);

  v_period := public.fc_period_start(p_org);
  insert into public.usage (org_id, period_start) values (p_org, v_period) on conflict do nothing;

  if p_lane = 'priority' then
    select priority_slides_used, v_plan.priority_slides_per_month + extra_priority_slides_purchased, reserved_usd, cogs_usd
      into v_used, v_cap, v_reserved, v_cogs from public.usage where org_id = p_org and period_start = v_period for update;
    if v_cap = 0 and not v_org.is_demo then raise exception 'FC_NO_PLAN' using detail = 'priority rendering is on Pro and Studio'; end if;
    v_from_allow := v_need; v_from_bal := 0;
    if not v_org.is_demo and v_used + v_need > v_cap then
      raise exception 'FC_QUOTA' using detail = format('%s of %s priority slides used this period; this set needs up to %s', v_used, v_cap, v_need);
    end if;
  else
    select slides_used, v_plan.slides_per_month + extra_slides_purchased, reserved_usd, cogs_usd
      into v_used, v_cap, v_reserved, v_cogs from public.usage where org_id = p_org and period_start = v_period for update;
    v_from_allow := least(v_need, greatest(0, v_cap - v_used));
    v_from_bal := v_need - v_from_allow;
    if v_from_bal > v_org.slide_balance then
      if v_cap = 0 and v_org.slide_balance = 0 then raise exception 'FC_NO_PLAN'; end if;
      raise exception 'FC_QUOTA' using detail = format('%s of %s slides used this period and %s in your balance; this set needs up to %s', v_used, v_cap, v_org.slide_balance, v_need);
    end if;
  end if;

  v_reserve := p_max * public.fc_reserve_rate(p_lane, p_hd);
  v_spend_cap := coalesce(v_org.spend_cap_usd, v_plan.cogs_allowance_usd);
  if v_cogs + v_reserved + v_reserve > v_spend_cap then
    raise exception 'FC_SPEND_CAP' using detail = format('spend cap $%s reached (spent $%s, reserved $%s)', v_spend_cap, v_cogs, v_reserved);
  end if;

  insert into public.sets (org_id, user_id, campaign_id, style, ask, slides_min, slides_max, reserved_slides, quality, lane, hd,
                           status, stage, creator_id, look, reserve_usd, state_json, from_balance, instructions)
  values (p_org, auth.uid(), p_campaign, p_style, p_ask, p_min, p_max, v_need, case when p_hd then 'high' else 'medium' end, p_lane, p_hd,
          'queued', 'copy:submit', p_creator, p_look, v_reserve, null, v_from_bal,
          case when p_instructions is null or p_instructions = 'null'::jsonb then null else p_instructions end)
  returning id into v_id;

  if p_lane = 'priority' then
    update public.usage set priority_slides_used = priority_slides_used + v_from_allow, reserved_usd = reserved_usd + v_reserve, updated_at = now()
      where org_id = p_org and period_start = v_period;
  else
    update public.usage set slides_used = slides_used + v_from_allow, reserved_usd = reserved_usd + v_reserve, updated_at = now()
      where org_id = p_org and period_start = v_period;
    if v_from_bal > 0 then
      update public.orgs set slide_balance = slide_balance - v_from_bal where id = p_org;
    end if;
  end if;
  insert into public.spend_ledger (org_id, set_id, type, usd, note) values (p_org, v_id, 'reserve', v_reserve, p_lane);
  return v_id;
end $$;
