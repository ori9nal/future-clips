-- 0005: the agency referral programme.
--
-- Owner decision 2026-09-13: an agency that brings its clippers onto the
-- platform earns a commission on the subscriptions they generate — 20% while
-- it has fewer than 200 referred accounts, stepping up with volume to a
-- ceiling of 30%. The Future Clips pays it from its own margin, from its own
-- account, after the fact; nothing runs through the payment provider (this is
-- what Dodo was told during merchant review). The tier between 200 and the
-- ceiling is an assumption (25% at 200, 30% at 500) — edit referral_tiers.
--
-- Mechanics: every org has a referral code. A visitor arriving with ?ref=CODE
-- gets a cookie; on first sign-in the app calls fc_claim_referral(code), which
-- stamps referred_by on the caller's personal org once and never again.
-- Revenue is recognised per referred org per billing period by
-- fc_record_commission (service role — the billing webhook, phase 5, or the
-- admin by hand until then), at the agency's rate at that moment.

-- ── orgs: code, attribution ─────────────────────────────────────────────────
alter table public.orgs add column referral_code text unique;
alter table public.orgs add column referred_by uuid references public.orgs(id);
alter table public.orgs add column referred_at timestamptz;
alter table public.orgs add constraint orgs_not_self_referred check (referred_by is null or referred_by <> id);

-- 8 characters from an alphabet without 0/O/1/I; the loop guards the (tiny) collision chance
create or replace function public.fc_new_referral_code()
returns text language plpgsql volatile set search_path = public as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; i int;
begin
  loop
    code := '';
    for i in 1..8 loop code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.orgs where referral_code = code);
  end loop;
  return code;
end $$;

create or replace function public.orgs_assign_referral_code()
returns trigger language plpgsql as $$
begin
  if new.referral_code is null then new.referral_code := public.fc_new_referral_code(); end if;
  return new;
end $$;
create trigger orgs_assign_referral_code before insert on public.orgs
  for each row execute function public.orgs_assign_referral_code();

update public.orgs set referral_code = public.fc_new_referral_code() where referral_code is null;
alter table public.orgs alter column referral_code set not null;

-- members cannot rewrite attribution or their own code; the webhook/admin path (service role) can
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
       or new.referred_at is distinct from old.referred_at then
      raise exception 'plan, billing and referral fields are set by the billing webhook only';
    end if;
  end if;
  return new;
end $$;

-- ── tiers ───────────────────────────────────────────────────────────────────
create table public.referral_tiers (
  min_referred int primary key check (min_referred >= 0),
  rate numeric(4,3) not null check (rate > 0 and rate <= 0.30)
);
insert into public.referral_tiers (min_referred, rate) values (0, 0.20), (200, 0.25), (500, 0.30);

-- how many accounts an org has referred, and the rate that count earns today
create or replace function public.fc_referred_count(p_org uuid)
returns int language sql stable set search_path = public as $$
  select count(*)::int from public.orgs where referred_by = p_org
$$;

create or replace function public.fc_referral_rate(p_org uuid)
returns numeric language sql stable set search_path = public as $$
  select coalesce(
    (select rate from public.referral_tiers where min_referred <= public.fc_referred_count(p_org) order by min_referred desc limit 1),
    (select rate from public.referral_tiers order by min_referred asc limit 1))
$$;

-- ── commissions: one row per referred org per billing period ────────────────
create table public.commissions (
  id bigint generated always as identity primary key,
  agency_org_id uuid not null references public.orgs(id),
  referred_org_id uuid not null references public.orgs(id),
  period_start date not null,
  revenue_usd numeric(10,2) not null check (revenue_usd >= 0),
  rate numeric(4,3) not null,
  commission_usd numeric(10,2) not null check (commission_usd >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'void')),
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique (referred_org_id, period_start)
);
create index commissions_agency on public.commissions (agency_org_id, status);

-- ── claim: the signed-in user's personal org takes the code once ────────────
-- Returns true when attribution was stamped, false when there was nothing to
-- do (bad code, own code, already attributed, platform org). Never raises, so
-- a stale cookie cannot break sign-in.
create or replace function public.fc_claim_referral(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_agency uuid; v_mine uuid;
begin
  if auth.uid() is null or p_code is null then return false; end if;
  select id into v_agency from public.orgs where referral_code = upper(trim(p_code));
  if v_agency is null then return false; end if;
  -- the caller's personal org: the org they own that is not the platform, oldest first
  select o.id into v_mine from public.orgs o join public.members m on m.org_id = o.id
    where m.user_id = auth.uid() and m.role = 'owner' and not o.is_platform
    order by o.created_at asc limit 1;
  if v_mine is null or v_mine = v_agency then return false; end if;
  update public.orgs set referred_by = v_agency, referred_at = now()
    where id = v_mine and referred_by is null;
  return found;
end $$;
revoke all on function public.fc_claim_referral(text) from public;
grant execute on function public.fc_claim_referral(text) to authenticated;

-- ── record: revenue for a referred org's period becomes a commission row ────
-- Service role only (the billing webhook; the admin by hand until phase 5).
create or replace function public.fc_record_commission(p_referred uuid, p_period date, p_revenue numeric, p_note text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_agency uuid; v_rate numeric; v_id bigint;
begin
  if coalesce(auth.role(), current_user::text) not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'FC_FORBIDDEN' using errcode = '42501';
  end if;
  select referred_by into v_agency from public.orgs where id = p_referred;
  if v_agency is null then return null; end if;
  v_rate := public.fc_referral_rate(v_agency);
  insert into public.commissions (agency_org_id, referred_org_id, period_start, revenue_usd, rate, commission_usd, note)
    values (v_agency, p_referred, p_period, p_revenue, v_rate, round(p_revenue * v_rate, 2), p_note)
    on conflict (referred_org_id, period_start) do update
      set revenue_usd = excluded.revenue_usd, rate = excluded.rate, commission_usd = excluded.commission_usd, note = excluded.note
      where public.commissions.status = 'pending'
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.fc_record_commission(uuid, date, numeric, text) from public;

-- ── summary for the agency page ─────────────────────────────────────────────
create or replace function public.fc_agency_summary(p_org uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', (select referral_code from public.orgs where id = p_org),
    'referred', public.fc_referred_count(p_org),
    'paying', (select count(*) from public.orgs where referred_by = p_org and billing_status in ('active', 'trialing', 'past_due')),
    'rate', public.fc_referral_rate(p_org),
    'next_tier', (select jsonb_build_object('min_referred', min_referred, 'rate', rate) from public.referral_tiers
                  where min_referred > public.fc_referred_count(p_org) order by min_referred asc limit 1),
    'pending_usd', coalesce((select sum(commission_usd) from public.commissions where agency_org_id = p_org and status = 'pending'), 0),
    'paid_usd', coalesce((select sum(commission_usd) from public.commissions where agency_org_id = p_org and status = 'paid'), 0)
  )
  where p_org in (select public.my_org_ids()) or public.is_platform_owner()
$$;
revoke all on function public.fc_agency_summary(uuid) from public;
grant execute on function public.fc_agency_summary(uuid) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.referral_tiers enable row level security;
create policy tiers_read on public.referral_tiers for select to authenticated using (true);
create policy tiers_admin on public.referral_tiers for all to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

alter table public.commissions enable row level security;
create policy commissions_read on public.commissions for select to authenticated
  using (agency_org_id in (select public.my_org_ids()) or public.is_platform_owner());
-- the platform owner settles them; inserts come from fc_record_commission (service role)
create policy commissions_settle on public.commissions for update to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

-- the agency may read the names of the orgs it referred (and nothing else about them)
create or replace function public.fc_referred_orgs(p_org uuid)
returns table (id uuid, name text, plan text, billing_status text, referred_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.plan, o.billing_status, o.referred_at from public.orgs o
  where o.referred_by = p_org and (p_org in (select public.my_org_ids()) or public.is_platform_owner())
  order by o.referred_at desc
$$;
revoke all on function public.fc_referred_orgs(uuid) from public;
grant execute on function public.fc_referred_orgs(uuid) to authenticated;
