-- 0004: the two lanes on the set row, a slide range, and the quota gate as
-- SQL functions so the reserve-then-commit ledger cannot be skipped by any
-- client. Applied 2026-09-12.
--
-- Lane names follow the customer-facing words (owner decision 2026-09-12):
-- "batch" is the included allowance, "priority" is the realtime allowance.
-- Nothing says queued or instant any more, including the schema.

-- ── sets: lane, range, state ───────────────────────────────────────────────
alter table public.sets rename column mode to lane;
alter table public.sets drop constraint sets_mode_check;
update public.sets set lane = case lane when 'queued' then 'batch' when 'instant' then 'priority' else lane end;
alter table public.sets add constraint sets_lane_check check (lane in ('batch','priority'));

-- `slides` becomes the count actually made (null until the copy lands);
-- the ask is a range the model picks inside, charged for what is produced
alter table public.sets alter column slides drop not null;
alter table public.sets drop constraint sets_slides_check;
alter table public.sets add column slides_min integer not null default 7 check (slides_min between 5 and 10);
alter table public.sets add column slides_max integer not null default 7 check (slides_max between 5 and 10);
alter table public.sets add constraint sets_slides_range check (slides_min <= slides_max and (slides is null or slides between 1 and 12));
alter table public.sets add column reserved_slides integer not null default 0;
alter table public.sets add column state_json jsonb;        -- engine/lanes.mjs state, resumed each worker tick
alter table public.sets add column files_json jsonb;        -- storage paths of the rendered slides, in order
alter table public.sets add column caption text;
alter table public.sets add column slides_used integer;     -- what was finally charged (= slides on success)
alter table public.sets add column updated_at timestamptz not null default now();

create index sets_open_idx on public.sets (updated_at) where status in ('queued','rendering');
create index sets_org_recent_idx on public.sets (org_id, created_at desc);

-- ── orgs: a per-account spend cap ──────────────────────────────────────────
-- null = the plan's cogs_allowance_usd (what a month at full quota costs).
-- Set lower on an account that looks like abuse; set higher for an agency
-- that has paid for extras. Protected by the billing trigger: service role only.
alter table public.orgs add column spend_cap_usd numeric(8,2);

-- ── quota gate ─────────────────────────────────────────────────────────────
-- Per-slide provider cost used for the RESERVATION only (the commit uses the
-- providers' usage numbers). Measured 2026-09-12, engine/lanes.mjs:
--   batch    ~$0.03/slide  (copy $0.023 + frames $0.18 per 7-slide set)
--   priority ~$0.06/slide
--   HD       output is 4x medium; reserve 3x the lane rate
create or replace function public.fc_reserve_rate(p_lane text, p_hd boolean)
returns numeric language sql immutable as $$
  select (case p_lane when 'priority' then 0.06 else 0.03 end) * (case when p_hd then 3 else 1 end);
$$;

-- The period a set counts against: the billing period when there is one,
-- the calendar month otherwise.
create or replace function public.fc_period_start(p_org uuid)
returns date language sql stable security definer set search_path = public as $$
  select coalesce(
    (select current_period_start::date from public.orgs where id = p_org and current_period_start is not null and current_period_end > now()),
    date_trunc('month', now())::date);
$$;

-- Reserve slides for a new set. Called by the signed-in user; everything it
-- checks is checked here, not in the app:
--   membership → plan has the lane → allowance left (incl. purchased extras)
--   → HD offered on the plan → spend cap not breached.
-- Raises FC_* errors the app maps to messages. Returns the new set id.
create or replace function public.fc_reserve_set(
  p_org uuid, p_campaign text, p_ask text, p_style text,
  p_min integer, p_max integer, p_lane text,
  p_hd boolean default false, p_creator uuid default null, p_look text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_plan public.plans%rowtype;
  v_org public.orgs%rowtype;
  v_period date;
  v_cap integer;
  v_used integer;
  v_reserve numeric;
  v_spend_cap numeric;
  v_cogs numeric;
  v_reserved numeric;
  v_id uuid;
begin
  if p_org is null or not (p_org in (select public.my_org_ids())) then
    raise exception 'FC_NOT_MEMBER' using errcode = '42501';
  end if;
  if p_lane not in ('batch','priority') then raise exception 'FC_BAD_LANE'; end if;
  if p_min is null or p_max is null or p_min < 5 or p_max > 10 or p_min > p_max then raise exception 'FC_BAD_RANGE'; end if;
  if not exists (select 1 from public.campaigns c where c.id = p_campaign and (c.org_id is null or c.org_id = p_org) and c.status = 'live') then
    raise exception 'FC_NO_CAMPAIGN';
  end if;

  select * into v_org from public.orgs where id = p_org for update;
  select * into v_plan from public.plans where id = v_org.plan;
  if v_plan.slides_per_month = 0 then raise exception 'FC_NO_PLAN'; end if;
  if p_hd and v_plan.hd_per_slide_usd is null then raise exception 'FC_NO_HD'; end if;

  v_period := public.fc_period_start(p_org);
  insert into public.usage (org_id, period_start) values (p_org, v_period) on conflict do nothing;

  if p_lane = 'priority' then
    select priority_slides_used, v_plan.priority_slides_per_month + extra_priority_slides_purchased, reserved_usd, cogs_usd
      into v_used, v_cap, v_reserved, v_cogs from public.usage where org_id = p_org and period_start = v_period for update;
  else
    select slides_used, v_plan.slides_per_month + extra_slides_purchased, reserved_usd, cogs_usd
      into v_used, v_cap, v_reserved, v_cogs from public.usage where org_id = p_org and period_start = v_period for update;
  end if;
  if v_used + p_max > v_cap then
    raise exception 'FC_QUOTA' using detail = format('%s of %s %s slides used this period; this set needs up to %s', v_used, v_cap, p_lane, p_max);
  end if;

  v_reserve := p_max * public.fc_reserve_rate(p_lane, p_hd);
  v_spend_cap := coalesce(v_org.spend_cap_usd, v_plan.cogs_allowance_usd);
  if v_cogs + v_reserved + v_reserve > v_spend_cap then
    raise exception 'FC_SPEND_CAP' using detail = format('spend cap $%s reached (spent $%s, reserved $%s)', v_spend_cap, v_cogs, v_reserved);
  end if;

  insert into public.sets (org_id, user_id, campaign_id, style, ask, slides_min, slides_max, reserved_slides, quality, lane, hd,
                           status, stage, creator_id, look, reserve_usd, state_json)
  values (p_org, auth.uid(), p_campaign, p_style, p_ask, p_min, p_max, p_max, case when p_hd then 'high' else 'medium' end, p_lane, p_hd,
          'queued', 'copy:submit', p_creator, p_look, v_reserve, null)
  returning id into v_id;

  if p_lane = 'priority' then
    update public.usage set priority_slides_used = priority_slides_used + p_max, reserved_usd = reserved_usd + v_reserve, updated_at = now()
      where org_id = p_org and period_start = v_period;
  else
    update public.usage set slides_used = slides_used + p_max, reserved_usd = reserved_usd + v_reserve, updated_at = now()
      where org_id = p_org and period_start = v_period;
  end if;
  insert into public.spend_ledger (org_id, set_id, type, usd, note) values (p_org, v_id, 'reserve', v_reserve, format('%s slides, %s', p_max, p_lane));
  return v_id;
end $$;

-- Commit: the set finished. Charge what was made, not what was reserved
-- (the ToS promises this), and record the providers' real cost. Worker only.
create or replace function public.fc_commit_set(
  p_set uuid, p_made integer, p_cost numeric, p_caption text, p_files jsonb, p_content jsonb, p_compliance jsonb, p_cost_json jsonb, p_storage_prefix text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.sets%rowtype;
  v_period date;
  v_delta integer;
begin
  select * into v from public.sets where id = p_set for update;
  if v.id is null then raise exception 'FC_NO_SET'; end if;
  if v.status in ('done','failed') then return; end if;
  v_period := public.fc_period_start(v.org_id);
  v_delta := v.reserved_slides - least(p_made, v.reserved_slides);   -- give back the slides not made
  if v.lane = 'priority' then
    update public.usage set priority_slides_used = greatest(0, priority_slides_used - v_delta),
      hd_slides_used = hd_slides_used + case when v.hd then p_made else 0 end,
      reserved_usd = greatest(0, reserved_usd - coalesce(v.reserve_usd, 0)), cogs_usd = cogs_usd + p_cost, updated_at = now()
      where org_id = v.org_id and period_start = v_period;
  else
    update public.usage set slides_used = greatest(0, slides_used - v_delta),
      hd_slides_used = hd_slides_used + case when v.hd then p_made else 0 end,
      reserved_usd = greatest(0, reserved_usd - coalesce(v.reserve_usd, 0)), cogs_usd = cogs_usd + p_cost, updated_at = now()
      where org_id = v.org_id and period_start = v_period;
  end if;
  update public.sets set status = 'done', stage = 'done', slides = p_made, slides_used = least(p_made, v.reserved_slides),
    cost_usd = p_cost, cost_json = p_cost_json, caption = p_caption, files_json = p_files, content_json = p_content,
    compliance_json = p_compliance, storage_prefix = p_storage_prefix, finished_at = now(), updated_at = now()
    where id = p_set;
  insert into public.spend_ledger (org_id, set_id, type, usd, note) values (v.org_id, p_set, 'commit', p_cost, format('%s slides made', p_made));
end $$;

-- Release: the set failed on our side. Every reserved slide goes back
-- (the Refund Policy §5 promise), and whatever the providers did charge
-- for the partial work is still recorded as cost. Worker only.
create or replace function public.fc_release_set(p_set uuid, p_error text, p_cost numeric default 0)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.sets%rowtype;
  v_period date;
begin
  select * into v from public.sets where id = p_set for update;
  if v.id is null then raise exception 'FC_NO_SET'; end if;
  if v.status in ('done','failed') then return; end if;
  v_period := public.fc_period_start(v.org_id);
  if v.lane = 'priority' then
    update public.usage set priority_slides_used = greatest(0, priority_slides_used - v.reserved_slides),
      reserved_usd = greatest(0, reserved_usd - coalesce(v.reserve_usd, 0)), cogs_usd = cogs_usd + coalesce(p_cost, 0), updated_at = now()
      where org_id = v.org_id and period_start = v_period;
  else
    update public.usage set slides_used = greatest(0, slides_used - v.reserved_slides),
      reserved_usd = greatest(0, reserved_usd - coalesce(v.reserve_usd, 0)), cogs_usd = cogs_usd + coalesce(p_cost, 0), updated_at = now()
      where org_id = v.org_id and period_start = v_period;
  end if;
  update public.sets set status = 'failed', stage = 'failed', error = p_error, slides_used = 0, cost_usd = coalesce(p_cost, 0),
    finished_at = now(), updated_at = now() where id = p_set;
  insert into public.spend_ledger (org_id, set_id, type, usd, note) values (v.org_id, p_set, 'release', coalesce(v.reserve_usd, 0), left(p_error, 200));
end $$;

-- Who may call what. Reserve: any signed-in member (it checks membership
-- itself). Commit/release: the worker's service role only — a browser must
-- never be able to mark its own set done or hand itself slides back.
revoke all on function public.fc_reserve_rate(text, boolean) from public;
revoke all on function public.fc_period_start(uuid) from public;
revoke all on function public.fc_reserve_set(uuid, text, text, text, integer, integer, text, boolean, uuid, text) from public;
revoke all on function public.fc_commit_set(uuid, integer, numeric, text, jsonb, jsonb, jsonb, jsonb, text) from public;
revoke all on function public.fc_release_set(uuid, text, numeric) from public;
grant execute on function public.fc_reserve_rate(text, boolean) to authenticated, service_role;
grant execute on function public.fc_period_start(uuid) to authenticated, service_role;
grant execute on function public.fc_reserve_set(uuid, text, text, text, integer, integer, text, boolean, uuid, text) to authenticated;
grant execute on function public.fc_commit_set(uuid, integer, numeric, text, jsonb, jsonb, jsonb, jsonb, text) to service_role;
grant execute on function public.fc_release_set(uuid, text, numeric) to service_role;

-- A member may cancel their own set while it is still queued (before any
-- provider call has been made): the worker sees the flag and releases it.
alter table public.sets add column cancel_requested boolean not null default false;
create policy sets_cancel on public.sets for update to authenticated
  using (org_id in (select public.my_org_ids()) and status = 'queued')
  with check (org_id in (select public.my_org_ids()) and status = 'queued');
-- ...but only that one column: everything else on the row is the worker's
create or replace function public.sets_member_update_guard()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if row(new.org_id, new.user_id, new.campaign_id, new.style, new.ask, new.slides_min, new.slides_max, new.reserved_slides, new.quality, new.lane, new.hd,
           new.status, new.stage, new.reserve_usd, new.cost_usd, new.state_json, new.files_json, new.slides, new.slides_used)
       is distinct from
       row(old.org_id, old.user_id, old.campaign_id, old.style, old.ask, old.slides_min, old.slides_max, old.reserved_slides, old.quality, old.lane, old.hd,
           old.status, old.stage, old.reserve_usd, old.cost_usd, old.state_json, old.files_json, old.slides, old.slides_used) then
      raise exception 'FC_READ_ONLY' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.sets_member_update_guard() from public;
create trigger sets_member_update_guard before update on public.sets for each row execute function public.sets_member_update_guard();

-- A member may read the slides of their own org's sets (bucket sets, path
-- <org>/<set>/slide-N.png) — that is what a signed URL is minted from. Read
-- only: the worker (service role) is the only writer.
create policy sets_member_read on storage.objects for select to authenticated
  using (bucket_id = 'sets' and (storage.foldername(name))[1] in (select id::text from public.orgs where id in (select public.my_org_ids())));

-- Supabase's default privileges hand EXECUTE on every new public function to
-- anon and authenticated explicitly; "revoke ... from public" leaves those
-- grants in place. Take them back by name. (Verified with
-- has_function_privilege after applying: commit/release are service_role only.)
revoke execute on function public.fc_commit_set(uuid, integer, numeric, text, jsonb, jsonb, jsonb, jsonb, text) from anon, authenticated;
revoke execute on function public.fc_release_set(uuid, text, numeric) from anon, authenticated;
revoke execute on function public.fc_reserve_set(uuid, text, text, text, integer, integer, text, boolean, uuid, text) from anon;
revoke execute on function public.fc_reserve_rate(text, boolean) from anon;
revoke execute on function public.fc_period_start(uuid) from anon;
revoke execute on function public.sets_member_update_guard() from anon, authenticated;

-- The per-plan spend cap = a month at full quota at the reserve rates
-- ($0.03 batch, $0.06 priority per slide), times 1.5 for HD and retries.
-- The old values were built on $0.175/set and sat BELOW the allowance.
update public.plans set cogs_allowance_usd = round((slides_per_month * 0.03 + priority_slides_per_month * 0.06) * 1.5, 2) where id <> 'free';
alter function public.fc_reserve_rate(text, boolean) set search_path = public;
alter function public.sets_member_update_guard() set search_path = public;
-- fc_period_start / fc_reserve_rate are only needed inside the gate functions
revoke execute on function public.fc_period_start(uuid) from authenticated;
revoke execute on function public.fc_reserve_rate(text, boolean) from authenticated;
