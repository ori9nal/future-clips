-- 0007: billing webhook idempotency. One row per delivery id; a redelivery
-- is acknowledged and ignored. Service role writes only.
create table public.billing_events (
  id text primary key,                 -- the webhook-id header
  type text not null,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  outcome text
);
alter table public.billing_events enable row level security;
create policy billing_events_admin on public.billing_events for select to authenticated using (public.is_platform_owner());

-- the webhook's vocabulary: 'expired' (subscription.expired → plan free) joins the list
alter table public.orgs drop constraint if exists orgs_billing_status_check;
do $$ declare c text; begin
  select conname into c from pg_constraint where conrelid = 'public.orgs'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%billing_status%';
  if c is not null then execute format('alter table public.orgs drop constraint %I', c); end if;
end $$;
alter table public.orgs add constraint orgs_billing_status_check
  check (billing_status in ('none', 'active', 'trialing', 'past_due', 'canceled', 'paused', 'expired'));
