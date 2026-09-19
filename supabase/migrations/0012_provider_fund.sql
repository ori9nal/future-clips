-- 0012: the provider fund. A share of every sale is earmarked for the model
-- providers (Anthropic writes, OpenAI draws). Money cannot be pushed to their
-- accounts automatically, so the ledger tells the owner what has come in,
-- what is earmarked, what the engine has consumed (spend_ledger commits), and
-- what the balance is; the owner keeps auto-recharge on at both providers.
create table public.fund_ledger (
  id          bigint generated always as identity primary key,
  org_id      uuid references public.orgs(id) on delete set null,
  source      text not null default 'dodo',
  payment_id  text unique,                 -- one row per provider payment
  sku         text,                        -- plan or pack id, when known
  gross_usd   numeric(10,2) not null,
  reserve_usd numeric(10,2) not null,      -- gross × share at the time
  share       numeric(5,4) not null,
  note        text,
  at          timestamptz not null default now()
);
alter table public.fund_ledger enable row level security;
create policy fund_ledger_admin on public.fund_ledger for select to authenticated using (public.is_platform_owner());
revoke all on public.fund_ledger from anon;

-- the share lives in app_settings so the owner can change it without a deploy
insert into public.app_settings (key, value, updated_at)
values ('provider_reserve', '{"share":0.35,"note":"share of every sale earmarked for Anthropic and OpenAI"}', now())
on conflict (key) do nothing;

-- the webhook records a sale (service role only); a repeat payment id is ignored
create or replace function public.fc_record_sale(p_org uuid, p_payment_id text, p_sku text, p_gross_usd numeric, p_note text default null)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_share numeric; v_reserve numeric;
begin
  select (value->>'share')::numeric into v_share from public.app_settings where key = 'provider_reserve';
  v_share := coalesce(v_share, 0.35);
  v_reserve := round(p_gross_usd * v_share, 2);
  insert into public.fund_ledger (org_id, payment_id, sku, gross_usd, reserve_usd, share, note)
  values (p_org, p_payment_id, p_sku, p_gross_usd, v_reserve, v_share, p_note)
  on conflict (payment_id) do nothing;
  return v_reserve;
end $$;
revoke all on function public.fc_record_sale(uuid, text, text, numeric, text) from public, anon, authenticated;
grant execute on function public.fc_record_sale(uuid, text, text, numeric, text) to service_role;

-- the admin page's summary: platform owner only, checked inside
create or replace function public.fc_fund_summary()
returns table (gross_usd numeric, reserve_usd numeric, spent_usd numeric, balance_usd numeric, sales integer, share numeric, since timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_spent numeric; v_share numeric;
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN'; end if;
  select coalesce(sum(usd), 0) into v_spent from public.spend_ledger where type = 'commit';
  select coalesce((value->>'share')::numeric, 0.35) into v_share from public.app_settings where key = 'provider_reserve';
  return query
    select coalesce(sum(f.gross_usd), 0)::numeric, coalesce(sum(f.reserve_usd), 0)::numeric, v_spent,
           (coalesce(sum(f.reserve_usd), 0) - v_spent)::numeric, count(*)::integer, coalesce(v_share, 0.35), min(f.at)
    from public.fund_ledger f;
end $$;
revoke all on function public.fc_fund_summary() from public, anon;
grant execute on function public.fc_fund_summary() to authenticated;
