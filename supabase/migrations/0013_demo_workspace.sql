-- 0013: the demo workspace. One shared org on the Clipper plan that invited
-- prospects join as members; the app shows it example results and campaigns
-- from shipped fixtures and never generates for it (lib/demo.ts, FC_DEMO).
alter table public.orgs add column if not exists is_demo boolean not null default false;

insert into public.orgs (id, name, plan, seat_limit, is_demo)
values ('0d3e0000-0000-4000-8000-000000000001', 'Demo workspace', 'solo', 500, true)
on conflict (id) do nothing;

-- the admin needs the id to invite into it, without being a member
create or replace function public.fc_demo_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.orgs where is_demo order by created_at limit 1
$$;
revoke all on function public.fc_demo_org_id() from public, anon;
grant execute on function public.fc_demo_org_id() to authenticated;

-- platform owners see demo workspaces without being members
create policy orgs_demo_platform_read on public.orgs for select to authenticated
  using (is_demo and public.is_platform_owner());

-- members cannot flip the flag (same guard as plan, billing, balance, cap)
create or replace function public.orgs_protect_billing()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(auth.role(), current_user::text) not in ('service_role', 'postgres', 'supabase_admin') then
    if new.plan is distinct from old.plan
       or new.seat_limit is distinct from old.seat_limit
       or new.is_platform is distinct from old.is_platform
       or new.is_demo is distinct from old.is_demo
       or new.billing_provider is distinct from old.billing_provider
       or new.billing_customer_id is distinct from old.billing_customer_id
       or new.billing_subscription_id is distinct from old.billing_subscription_id
       or new.billing_status is distinct from old.billing_status
       or new.current_period_start is distinct from old.current_period_start
       or new.current_period_end is distinct from old.current_period_end
       or new.spend_cap_usd is distinct from old.spend_cap_usd
       or new.slide_balance is distinct from old.slide_balance then
      raise exception 'plan, billing, balance and cap fields are set by the billing webhook only';
    end if;
  end if;
  return new;
end $$;
