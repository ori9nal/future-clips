-- Future Clips product schema. Applied through the Supabase MCP as
-- migration `product_schema` on 2026-09-11; kept here so the shape is in git.
--
-- Everything is RLS-on. Users read their own org's rows through
-- my_org_ids(); nothing here lets one org see another. Writes that move money
-- or quota (sets, usage, spend_ledger, jobs) have NO user policies: they go
-- through the service role in API routes and the worker, after the quota gate.
-- `signups` and bucket `site` are untouched.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ── plans: the pricing table, one row per tier ──────────────────────────────
create table public.plans (
  id                   text primary key,
  price_usd_month      numeric(8,2)  not null,
  queued_per_month     integer       not null,
  instant_per_month    integer       not null,
  hd_price_usd         numeric(6,2),           -- null = HD not offered
  seats                integer       not null,
  can_pin_style        boolean       not null,
  can_lock_brand       boolean       not null,
  own_creator          boolean       not null,
  extra_queued_usd     numeric(6,2),
  extra_instant_usd    numeric(6,2),
  -- the hard spend cap for a month at full quota: queued × $0.175 + instant × $0.35
  cogs_allowance_usd   numeric(8,2)  not null
);
insert into public.plans values
  ('free',     0,   0,   0, null, 1, false, false, false, null, null,   0.00),
  ('solo',    19,  50,   0, null, 1, true,  false, true,  0.40, 0.70,   8.75),
  ('grind',   59, 120,  12, 2.50, 1, true,  false, true,  0.40, 0.70,  25.20),
  ('agency', 249, 600,  50, 2.00, 10, true, true,  true,  0.40, 0.70, 122.50);

-- ── orgs / members ──────────────────────────────────────────────────────────
create table public.orgs (
  id                       uuid primary key default gen_random_uuid(),
  name                     text not null,
  plan                     text not null default 'free' references public.plans(id),
  seat_limit               integer not null default 1,
  is_platform              boolean not null default false,  -- the one org whose owners run the platform
  billing_provider         text check (billing_provider in ('dodo','stripe')),
  billing_customer_id      text,
  billing_subscription_id  text,
  billing_status           text not null default 'none'
                             check (billing_status in ('none','active','trialing','past_due','canceled','paused')),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now()
);
create unique index orgs_one_platform on public.orgs (is_platform) where is_platform;

create table public.members (
  org_id      uuid not null references public.orgs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner','member')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index members_user on public.members (user_id);

-- ── sign-up gate ────────────────────────────────────────────────────────────
-- signup_mode 'invite': only emails on allowed_emails can create an account.
-- 'open': anyone; the allowlist then only decides extra memberships.
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
insert into public.app_settings values
  ('signup',    '{"mode":"invite"}', now()),
  ('keepalive', '{"at":null}',       now());

create table public.allowed_emails (
  email       citext primary key,
  org_id      uuid references public.orgs(id) on delete set null,  -- join this org on first login
  role        text not null default 'member' check (role in ('owner','member')),
  note        text,
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ── campaigns: the campaigns/*.json files, schema partition preserved ───────
create table public.campaigns (
  id                    text primary key,              -- the slug the file was named
  org_id                uuid references public.orgs(id) on delete cascade,  -- null = platform campaign, visible to all
  kind                  text not null check (kind in ('campaign','spec')),
  data                  jsonb not null,
  status                text not null default 'live' check (status in ('live','paused','closed')),
  art_mode              text not null default 'ai' check (art_mode in ('ai','photos')),
  photo_dir_available   boolean not null default false,  -- photo dirs live in untracked output/; only art=ai runs are reproducible
  brief_hash            text,                            -- sha of the brief-relevant fields; the free-set cron re-renders when it changes
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index campaigns_org on public.campaigns (org_id);

-- ── your own creator / brand lock ───────────────────────────────────────────
create table public.creators (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.orgs(id) on delete cascade,
  name               text not null,
  subject            text,                    -- the locked one-sentence description the copy model is given
  anchor_image_path  text,                    -- bucket anchors: <org>/<creator>.png
  created_at         timestamptz not null default now()
);
create index creators_org on public.creators (org_id);

create table public.brand_kits (
  org_id      uuid primary key references public.orgs(id) on delete cascade,
  pairing_id  text,
  look        text,
  handle      text,
  stroke      text check (stroke in ('thin','heavy')),
  locked      boolean not null default false,  -- agency: brand-locked, members cannot override
  updated_at  timestamptz not null default now()
);

-- ── sets ────────────────────────────────────────────────────────────────────
create table public.sets (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.orgs(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete set null,
  campaign_id      text not null references public.campaigns(id),
  style            text not null,
  ask              text not null,
  slides           integer not null check (slides between 5 and 10),
  quality          text not null default 'medium' check (quality in ('medium','high')),
  mode             text not null check (mode in ('queued','instant')),
  status           text not null default 'queued' check (status in ('queued','rendering','done','failed')),
  stage            text,                      -- queued path: copy | anchor | frames | composite
  creator_id       uuid references public.creators(id) on delete set null,
  pairing_id       text,
  look             text,
  is_extra         boolean not null default false,
  hd               boolean not null default false,
  reserve_usd      numeric(8,4),
  cost_usd         numeric(8,4),              -- from the providers' usage numbers, never an estimate
  cost_json        jsonb,
  storage_prefix   text,                      -- bucket sets: <org>/<set_id>
  content_json     jsonb,
  compliance_json  jsonb,
  batch_ids        jsonb,                     -- {anthropic_batch_id, openai_batch_id, ...}
  error            text,
  created_at       timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz
);
create index sets_org_created on public.sets (org_id, created_at desc);
create index sets_status on public.sets (status) where status in ('queued','rendering');

-- ── usage: the counters the quota gate reads ────────────────────────────────
create table public.usage (
  org_id                    uuid not null references public.orgs(id) on delete cascade,
  period_start              date not null,
  queued_used               integer not null default 0,
  instant_used              integer not null default 0,
  hd_used                   integer not null default 0,
  extras_purchased_queued   integer not null default 0,
  extras_purchased_instant  integer not null default 0,
  extras_purchased_hd       integer not null default 0,
  reserved_usd              numeric(10,4) not null default 0,
  cogs_usd                  numeric(10,4) not null default 0,
  updated_at                timestamptz not null default now(),
  primary key (org_id, period_start)
);

-- durable reserve/commit rows, so a crash mid-render never loses a spend
create table public.spend_ledger (
  id       bigint generated always as identity primary key,
  org_id   uuid not null references public.orgs(id) on delete cascade,
  set_id   uuid references public.sets(id) on delete set null,
  type     text not null check (type in ('reserve','commit','release')),
  usd      numeric(8,4) not null,
  note     text,
  at       timestamptz not null default now()
);
create index spend_ledger_org on public.spend_ledger (org_id, at desc);

-- ── jobs: the queue (plain table + SKIP LOCKED) ─────────────────────────────
create table public.jobs (
  id            bigint generated always as identity primary key,
  kind          text not null,
  payload       jsonb not null,
  status        text not null default 'queued' check (status in ('queued','running','done','failed')),
  run_after     timestamptz not null default now(),
  attempts      integer not null default 0,
  max_attempts  integer not null default 5,
  locked_at     timestamptz,
  locked_by     text,
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index jobs_ready on public.jobs (run_after) where status = 'queued';

-- ── pairing history (was output/gen/pairing-history.json) ───────────────────
create table public.pairing_history (
  org_id            uuid primary key references public.orgs(id) on delete cascade,
  last_pairing_ids  text[] not null default '{}',
  updated_at        timestamptz not null default now()
);

-- ── helpers used by the policies ────────────────────────────────────────────
create or replace function public.my_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.members where user_id = auth.uid()
$$;

create or replace function public.is_platform_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members m join public.orgs o on o.id = m.org_id
    where m.user_id = auth.uid() and m.role = 'owner' and o.is_platform
  )
$$;

create or replace function public.is_org_owner(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where user_id = auth.uid() and org_id = p_org and role = 'owner')
$$;

revoke all on function public.my_org_ids() from public;
revoke all on function public.is_platform_owner() from public;
revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.my_org_ids() to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.plans            enable row level security;
alter table public.orgs             enable row level security;
alter table public.members          enable row level security;
alter table public.app_settings     enable row level security;
alter table public.allowed_emails   enable row level security;
alter table public.campaigns        enable row level security;
alter table public.creators         enable row level security;
alter table public.brand_kits       enable row level security;
alter table public.sets             enable row level security;
alter table public.usage            enable row level security;
alter table public.spend_ledger     enable row level security;
alter table public.jobs             enable row level security;
alter table public.pairing_history  enable row level security;

create policy plans_read on public.plans for select to authenticated using (true);

create policy orgs_read   on public.orgs for select to authenticated using (id in (select public.my_org_ids()));
create policy orgs_rename on public.orgs for update to authenticated
  using (public.is_org_owner(id)) with check (public.is_org_owner(id));
-- plan/billing columns are protected by a trigger below, not by the policy

create policy members_read on public.members for select to authenticated using (org_id in (select public.my_org_ids()));
create policy members_owner_remove on public.members for delete to authenticated
  using (public.is_org_owner(org_id) and user_id <> auth.uid());

-- allowed_emails: an org owner sees and manages invites into their own org;
-- platform owners see all. Inserts must respect the seat limit (trigger).
create policy invites_read on public.allowed_emails for select to authenticated
  using (public.is_platform_owner() or (org_id is not null and public.is_org_owner(org_id)));
create policy invites_write on public.allowed_emails for insert to authenticated
  with check (public.is_platform_owner() or (org_id is not null and public.is_org_owner(org_id)));
create policy invites_delete on public.allowed_emails for delete to authenticated
  using (public.is_platform_owner() or (org_id is not null and public.is_org_owner(org_id)));

create policy settings_read on public.app_settings for select to authenticated using (public.is_platform_owner());
create policy settings_write on public.app_settings for update to authenticated
  using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy campaigns_read on public.campaigns for select to authenticated
  using (org_id is null or org_id in (select public.my_org_ids()));
create policy campaigns_platform_write on public.campaigns for all to authenticated
  using (org_id is null and public.is_platform_owner())
  with check (org_id is null and public.is_platform_owner());
create policy campaigns_org_write on public.campaigns for all to authenticated
  using (org_id is not null and public.is_org_owner(org_id))
  with check (org_id is not null and public.is_org_owner(org_id));

create policy creators_rw on public.creators for all to authenticated
  using (org_id in (select public.my_org_ids())) with check (org_id in (select public.my_org_ids()));

create policy brand_kits_read on public.brand_kits for select to authenticated using (org_id in (select public.my_org_ids()));
create policy brand_kits_write on public.brand_kits for all to authenticated
  using (public.is_org_owner(org_id)) with check (public.is_org_owner(org_id));

create policy sets_read on public.sets for select to authenticated using (org_id in (select public.my_org_ids()));
create policy usage_read on public.usage for select to authenticated using (org_id in (select public.my_org_ids()));
create policy ledger_read on public.spend_ledger for select to authenticated using (org_id in (select public.my_org_ids()));
create policy pairing_read on public.pairing_history for select to authenticated using (org_id in (select public.my_org_ids()));
-- jobs: no user policies at all — worker only.

-- ── guards ──────────────────────────────────────────────────────────────────
-- Only the billing webhook (service role) may change plan or billing fields.
create or replace function public.orgs_protect_billing()
returns trigger language plpgsql as $$
begin
  -- auth.role() is the JWT role through PostgREST; direct connections (migrations,
  -- the MCP) have no JWT and fall through to current_user.
  if coalesce(auth.role(), current_user::text) not in ('service_role', 'postgres', 'supabase_admin') then
    if new.plan is distinct from old.plan
       or new.seat_limit is distinct from old.seat_limit
       or new.is_platform is distinct from old.is_platform
       or new.billing_provider is distinct from old.billing_provider
       or new.billing_customer_id is distinct from old.billing_customer_id
       or new.billing_subscription_id is distinct from old.billing_subscription_id
       or new.billing_status is distinct from old.billing_status
       or new.current_period_start is distinct from old.current_period_start
       or new.current_period_end is distinct from old.current_period_end then
      raise exception 'plan and billing fields are set by the billing webhook only';
    end if;
  end if;
  return new;
end $$;
create trigger orgs_protect_billing before update on public.orgs
  for each row execute function public.orgs_protect_billing();

-- Invites into an org cannot exceed its seat limit.
create or replace function public.invites_respect_seats()
returns trigger language plpgsql security definer set search_path = public as $$
declare seats int; used int;
begin
  if new.org_id is null then return new; end if;
  select seat_limit into seats from public.orgs where id = new.org_id;
  select count(*) into used from public.members where org_id = new.org_id;
  used := used + (select count(*) from public.allowed_emails a
                  where a.org_id = new.org_id and a.email <> new.email
                    and not exists (select 1 from auth.users u where lower(u.email) = a.email::text));
  if used + 1 > seats then
    raise exception 'seat limit reached (% of %)', used, seats;
  end if;
  return new;
end $$;
create trigger invites_respect_seats before insert on public.allowed_emails
  for each row execute function public.invites_respect_seats();

-- ── auth hooks ──────────────────────────────────────────────────────────────
-- 1. the gate: in invite mode an email that is not on the list cannot sign up
create or replace function public.gate_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare mode text;
begin
  select coalesce(value->>'mode', 'invite') into mode from public.app_settings where key = 'signup';
  if mode = 'invite' and not exists (select 1 from public.allowed_emails where email = lower(new.email)::citext) then
    raise exception 'FC_INVITE_ONLY: this email is not on the invite list' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger fc_gate_new_user before insert on auth.users
  for each row execute function public.gate_new_user();

-- 2. bootstrap: every new user gets a personal org (free, owner) and, if the
--    allowlist names an org for them, that membership too
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; personal uuid;
begin
  insert into public.orgs (name) values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My workspace'))
    returning id into personal;
  insert into public.members (org_id, user_id, role) values (personal, new.id, 'owner');
  select * into a from public.allowed_emails where email = lower(new.email)::citext;
  if found and a.org_id is not null then
    insert into public.members (org_id, user_id, role) values (a.org_id, new.id, a.role)
      on conflict (org_id, user_id) do update set role = excluded.role;
  end if;
  return new;
end $$;
create trigger fc_handle_new_user after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── seed: the platform org and its first owner ──────────────────────────────
insert into public.orgs (name, plan, seat_limit, is_platform) values ('Future Clips', 'agency', 10, true);
insert into public.allowed_emails (email, org_id, role, note)
  select 'earnfromwhop07@gmail.com', id, 'owner', 'platform owner (seeded by migration)' from public.orgs where is_platform;

-- ── storage buckets ─────────────────────────────────────────────────────────
-- private: sets, cache, anchors — signed URLs only, worker writes.
-- public read: free-sets (the one ready-made set per campaign), assets (fonts,
-- the bedrock reference figure, app screens — what the hosted build fetches).
insert into storage.buckets (id, name, public) values
  ('sets',      'sets',      false),
  ('cache',     'cache',     false),
  ('anchors',   'anchors',   false),
  ('free-sets', 'free-sets', true),
  ('assets',    'assets',    true);
create policy free_sets_public_read on storage.objects for select to public using (bucket_id = 'free-sets');
create policy assets_public_read    on storage.objects for select to public using (bucket_id = 'assets');
-- no user policies on sets / cache / anchors: the service role bypasses RLS.
