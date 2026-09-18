-- 0006: the plans the site sells (www.thefutureclips.com, 2026-09-13).
--
-- The site now sells Free / Clipper $16 / Pro $32 / Studio $79 with slide
-- packs that never expire. Internal plan ids stay (solo/grind/agency) so
-- nothing that references them moves; each plan gets the customer-facing
-- `label`. Allowances follow the page. Where the page is silent the safe
-- reading is taken — every one of these is a knob, not a rule:
--   · priority: 10% of the allowance on Pro and Studio (the page lists
--     "priority render queue" as a feature; unlimited priority at 2x COGS
--     would sink Pro's margin)
--   · HD: included on Pro and Studio (the page says so) but an HD slide uses
--     THREE slides of the allowance — an HD frame costs ~4x. hd_per_slide_usd
--     = 0 means "included, 3x"; null means "not offered"
--   · Free: a welcome balance of 5 slides (the engine's minimum set) instead
--     of the page's "2 slides" — two slides cannot make a slideshow. Change
--     the page and the Refund Policy to "one free slideshow", or lower this
--   · packs: 100 for $8, 250 for $18, 600 for $40, credited to a balance that
--     carries across periods; allowance is spent first, then balance
-- COGS: $0.027/slide batch, $0.058 priority (COST.md). At full quota:
-- Clipper $5.40 on $16 (66%), Pro $16.40 on $32 (49%), Studio $49.20 on $79 (38%).

-- ── plans ───────────────────────────────────────────────────────────────────
alter table public.plans add column label text;
alter table public.plans add column welcome_slides integer not null default 0;
update public.plans set label = 'Free',    welcome_slides = 5, price_usd_month = 0,  slides_per_month = 0,    priority_slides_per_month = 0,   hd_per_slide_usd = null, seats = 1, extra_slide_usd = null, extra_priority_slide_usd = null, own_creator = false, can_pin_style = false, can_lock_brand = false where id = 'free';
update public.plans set label = 'Clipper', welcome_slides = 0, price_usd_month = 16, slides_per_month = 200,  priority_slides_per_month = 0,   hd_per_slide_usd = null, seats = 1, extra_slide_usd = null, extra_priority_slide_usd = null, own_creator = true,  can_pin_style = true,  can_lock_brand = false where id = 'solo';
update public.plans set label = 'Pro',     welcome_slides = 0, price_usd_month = 32, slides_per_month = 500,  priority_slides_per_month = 50,  hd_per_slide_usd = 0,    seats = 1, extra_slide_usd = null, extra_priority_slide_usd = null, own_creator = true,  can_pin_style = true,  can_lock_brand = false where id = 'grind';
update public.plans set label = 'Studio',  welcome_slides = 0, price_usd_month = 79, slides_per_month = 1500, priority_slides_per_month = 150, hd_per_slide_usd = 0,    seats = 5, extra_slide_usd = null, extra_priority_slide_usd = null, own_creator = true,  can_pin_style = true,  can_lock_brand = true  where id = 'agency';
alter table public.plans alter column label set not null;
-- spend cap: full quota at the reserve rates ($0.03 batch, $0.06 priority) x 1.5; the free cap covers the welcome set
update public.plans set cogs_allowance_usd = round((slides_per_month * 0.03 + priority_slides_per_month * 0.06) * 1.5, 2) where id <> 'free';
update public.plans set cogs_allowance_usd = 0.30 where id = 'free';

-- ── packs: bought once, never expire ────────────────────────────────────────
create table public.packs (
  id text primary key,
  slides integer not null check (slides > 0),
  price_usd numeric(8,2) not null check (price_usd >= 0),
  active boolean not null default true
);
insert into public.packs (id, slides, price_usd) values ('p100', 100, 8), ('p250', 250, 18), ('p600', 600, 40);
alter table public.packs enable row level security;
create policy packs_read on public.packs for select to authenticated using (true);

-- the carried balance: purchased slides plus the welcome slides, spent after the period allowance
alter table public.orgs add column slide_balance integer not null default 0 check (slide_balance >= 0);
alter table public.sets add column from_balance integer not null default 0;

-- a member may still flip only cancel_requested; from_balance is the gate's
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid = 'public.spend_ledger'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%reserve%';
  if c is not null then execute format('alter table public.spend_ledger drop constraint %I', c); end if;
end $$;
alter table public.spend_ledger add constraint spend_ledger_type_check check (type in ('reserve', 'commit', 'release', 'credit'));
create or replace function public.sets_member_update_guard()
returns trigger language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    if row(new.org_id, new.user_id, new.campaign_id, new.style, new.ask, new.slides_min, new.slides_max, new.reserved_slides, new.quality, new.lane, new.hd,
           new.status, new.stage, new.reserve_usd, new.cost_usd, new.state_json, new.files_json, new.slides, new.slides_used, new.from_balance)
       is distinct from
       row(old.org_id, old.user_id, old.campaign_id, old.style, old.ask, old.slides_min, old.slides_max, old.reserved_slides, old.quality, old.lane, old.hd,
           old.status, old.stage, old.reserve_usd, old.cost_usd, old.state_json, old.files_json, old.slides, old.slides_used, old.from_balance) then
      raise exception 'FC_READ_ONLY' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- existing free workspaces get the welcome balance once
update public.orgs o set slide_balance = p.welcome_slides from public.plans p where p.id = o.plan and o.slide_balance = 0 and p.welcome_slides > 0;

-- new workspaces are born with the free plan's welcome balance
create or replace function public.orgs_welcome_balance()
returns trigger language plpgsql as $$
begin
  if new.slide_balance = 0 then
    select welcome_slides into new.slide_balance from public.plans where id = new.plan;
    new.slide_balance := coalesce(new.slide_balance, 0);
  end if;
  return new;
end $$;
create trigger orgs_welcome_balance before insert on public.orgs
  for each row execute function public.orgs_welcome_balance();

-- credit a pack (the billing webhook in phase 5; the admin by hand until then). Service role only.
create or replace function public.fc_credit_pack(p_org uuid, p_pack text, p_note text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_slides integer; v_bal integer;
begin
  if coalesce(auth.role(), current_user::text) not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'FC_FORBIDDEN' using errcode = '42501';
  end if;
  select slides into v_slides from public.packs where id = p_pack and active;
  if v_slides is null then raise exception 'FC_NO_PACK'; end if;
  update public.orgs set slide_balance = slide_balance + v_slides where id = p_org returning slide_balance into v_bal;
  insert into public.spend_ledger (org_id, set_id, type, usd, note) values (p_org, null, 'credit', 0, format('pack %s: +%s slides (%s)', p_pack, v_slides, coalesce(p_note, 'credited')));
  return v_bal;
end $$;
revoke all on function public.fc_credit_pack(uuid, text, text) from public;

-- the balance is set by the gate and the webhook only
create or replace function public.orgs_protect_billing()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), current_user::text) not in ('service_role', 'postgres', 'supabase_admin') then
    if new.plan is distinct from old.plan
       or new.seat_limit is distinct from old.seat_limit
       or new.is_platform is distinct from old.is_platform
       or new.billing_provider is distinct from old.billing_provider
       or new.billing_customer_id is distinct from old.billing_customer_id
       or new.billing_subscription_id is distinct from old.billing_subscription_id
       or new.billing_status is distinct from old.billing_status
       or new.current_period_start is distinct from old.current_period_start
       or new.current_period_end is distinct from old.current_period_end
       or new.spend_cap_usd is distinct from old.spend_cap_usd
       or new.referral_code is distinct from old.referral_code
       or new.referred_by is distinct from old.referred_by
       or new.referred_at is distinct from old.referred_at
       or new.slide_balance is distinct from old.slide_balance then
      raise exception 'plan, billing, balance and referral fields are set by the billing webhook only';
    end if;
  end if;
  return new;
end $$;

-- ── the gate: allowance first, then balance; HD draws three slides each ─────
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
  v_need integer;        -- slides this set draws: p_max, x3 for HD
  v_from_allow integer;
  v_from_bal integer;
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
  if p_hd and v_plan.hd_per_slide_usd is null then raise exception 'FC_NO_HD'; end if;
  v_need := p_max * (case when p_hd then 3 else 1 end);

  v_period := public.fc_period_start(p_org);
  insert into public.usage (org_id, period_start) values (p_org, v_period) on conflict do nothing;

  if p_lane = 'priority' then
    select priority_slides_used, v_plan.priority_slides_per_month + extra_priority_slides_purchased, reserved_usd, cogs_usd
      into v_used, v_cap, v_reserved, v_cogs from public.usage where org_id = p_org and period_start = v_period for update;
    -- priority is an allowance only; the balance is standard slides
    if v_cap = 0 then raise exception 'FC_NO_PLAN' using detail = 'priority rendering is on Pro and Studio'; end if;
    v_from_allow := v_need; v_from_bal := 0;
    if v_used + v_need > v_cap then
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
                           status, stage, creator_id, look, reserve_usd, state_json, from_balance)
  values (p_org, auth.uid(), p_campaign, p_style, p_ask, p_min, p_max, v_need, case when p_hd then 'high' else 'medium' end, p_lane, p_hd,
          'queued', 'copy:submit', p_creator, p_look, v_reserve, null, v_from_bal)
  returning id into v_id;

  if p_lane = 'priority' then
    update public.usage set priority_slides_used = priority_slides_used + v_from_allow, reserved_usd = reserved_usd + v_reserve, updated_at = now()
      where org_id = p_org and period_start = v_period;
  else
    update public.usage set slides_used = slides_used + v_from_allow, reserved_usd = reserved_usd + v_reserve, updated_at = now()
      where org_id = p_org and period_start = v_period;
    if v_from_bal > 0 then update public.orgs set slide_balance = slide_balance - v_from_bal where id = p_org; end if;
  end if;
  insert into public.spend_ledger (org_id, set_id, type, usd, note)
    values (p_org, v_id, 'reserve', v_reserve, format('%s slides, %s%s%s', v_need, p_lane, case when p_hd then ' HD' else '' end, case when v_from_bal > 0 then format(' (%s from balance)', v_from_bal) else '' end));
  return v_id;
end $$;

-- Commit: charge what was made (x3 for HD). Unused slides go back to the
-- balance first (up to what was drawn from it), then to the allowance.
create or replace function public.fc_commit_set(
  p_set uuid, p_made integer, p_cost numeric, p_caption text, p_files jsonb, p_content jsonb, p_compliance jsonb, p_cost_json jsonb, p_storage_prefix text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.sets%rowtype;
  v_period date;
  v_charge integer;
  v_delta integer;
  v_back_bal integer;
  v_back_allow integer;
begin
  select * into v from public.sets where id = p_set for update;
  if v.id is null then raise exception 'FC_NO_SET'; end if;
  if v.status in ('done','failed') then return; end if;
  v_period := public.fc_period_start(v.org_id);
  v_charge := least(p_made * (case when v.hd then 3 else 1 end), v.reserved_slides);
  v_delta := v.reserved_slides - v_charge;
  v_back_bal := least(v_delta, v.from_balance);
  v_back_allow := v_delta - v_back_bal;
  if v.lane = 'priority' then
    update public.usage set priority_slides_used = greatest(0, priority_slides_used - v_back_allow),
      hd_slides_used = hd_slides_used + case when v.hd then p_made else 0 end,
      reserved_usd = greatest(0, reserved_usd - coalesce(v.reserve_usd, 0)), cogs_usd = cogs_usd + p_cost, updated_at = now()
      where org_id = v.org_id and period_start = v_period;
  else
    update public.usage set slides_used = greatest(0, slides_used - v_back_allow),
      hd_slides_used = hd_slides_used + case when v.hd then p_made else 0 end,
      reserved_usd = greatest(0, reserved_usd - coalesce(v.reserve_usd, 0)), cogs_usd = cogs_usd + p_cost, updated_at = now()
      where org_id = v.org_id and period_start = v_period;
    if v_back_bal > 0 then update public.orgs set slide_balance = slide_balance + v_back_bal where id = v.org_id; end if;
  end if;
  update public.sets set status = 'done', stage = 'done', slides = p_made, slides_used = v_charge,
    cost_usd = p_cost, cost_json = p_cost_json, caption = p_caption, files_json = p_files, content_json = p_content,
    compliance_json = p_compliance, storage_prefix = p_storage_prefix, finished_at = now(), updated_at = now()
    where id = p_set;
  insert into public.spend_ledger (org_id, set_id, type, usd, note) values (v.org_id, p_set, 'commit', p_cost, format('%s slides made', p_made));
end $$;

-- Release: everything reserved goes back where it came from.
create or replace function public.fc_release_set(p_set uuid, p_error text, p_cost numeric default 0)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v public.sets%rowtype;
  v_period date;
  v_back_allow integer;
begin
  select * into v from public.sets where id = p_set for update;
  if v.id is null then raise exception 'FC_NO_SET'; end if;
  if v.status in ('done','failed') then return; end if;
  v_period := public.fc_period_start(v.org_id);
  v_back_allow := v.reserved_slides - v.from_balance;
  if v.lane = 'priority' then
    update public.usage set priority_slides_used = greatest(0, priority_slides_used - v_back_allow),
      reserved_usd = greatest(0, reserved_usd - coalesce(v.reserve_usd, 0)), cogs_usd = cogs_usd + coalesce(p_cost, 0), updated_at = now()
      where org_id = v.org_id and period_start = v_period;
  else
    update public.usage set slides_used = greatest(0, slides_used - v_back_allow),
      reserved_usd = greatest(0, reserved_usd - coalesce(v.reserve_usd, 0)), cogs_usd = cogs_usd + coalesce(p_cost, 0), updated_at = now()
      where org_id = v.org_id and period_start = v_period;
    if v.from_balance > 0 then update public.orgs set slide_balance = slide_balance + v.from_balance where id = v.org_id; end if;
  end if;
  update public.sets set status = 'failed', stage = 'failed', error = p_error, slides_used = 0, cost_usd = coalesce(p_cost, 0),
    finished_at = now(), updated_at = now() where id = p_set;
  insert into public.spend_ledger (org_id, set_id, type, usd, note) values (v.org_id, p_set, 'release', coalesce(v.reserve_usd, 0), left(p_error, 200));
end $$;

-- grants are unchanged from 0004: reserve for authenticated, commit/release for the service role
