-- 0021: the provider fund, split by who is owed.
--
-- 0012 earmarked a share of every sale for "the model providers" as one pot,
-- and the commit ledger recorded one pooled cost. But the two bills arrive
-- separately: Anthropic writes the copy, OpenAI draws the frames, and each
-- console is topped up on its own. The engine has always measured them apart
-- (state.copy.usd / state.art.usd, already handed over in fc_commit_set's
-- p_cost_json), so nothing new has to be measured — only recorded.
alter table public.spend_ledger add column if not exists copy_usd numeric(8,4);
alter table public.spend_ledger add column if not exists art_usd  numeric(8,4);
comment on column public.spend_ledger.copy_usd is 'Anthropic: what this set spent writing copy';
comment on column public.spend_ledger.art_usd  is 'OpenAI: what this set spent drawing frames';

-- what to keep loaded at each console, in days of measured burn
insert into public.app_settings (key, value, updated_at)
values ('provider_float', '{"days":30,"floor_usd":20,"note":"keep this many days of measured burn at each provider"}', now())
on conflict (key) do nothing;

-- Same signature as 0010; the split is read out of p_cost_json, which the
-- worker already sends, so no caller changes.
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
  insert into public.spend_ledger (org_id, set_id, type, usd, copy_usd, art_usd, note)
  values (v.org_id, p_set, 'commit', p_cost,
          nullif((p_cost_json->>'copy'), '')::numeric,
          nullif((p_cost_json->>'art'), '')::numeric,
          format('%s slides made', p_made));
end $$;

-- the summary gains the split: what each provider has consumed, what it is
-- burning a day, and what the owner should keep loaded in that console
drop function if exists public.fc_fund_summary();
create or replace function public.fc_fund_summary()
returns table (
  gross_usd numeric, reserve_usd numeric, spent_usd numeric, balance_usd numeric,
  sales integer, share numeric, since timestamptz,
  anthropic_usd numeric, openai_usd numeric, unsplit_usd numeric,
  anthropic_day numeric, openai_day numeric,
  anthropic_float numeric, openai_float numeric, float_days integer
)
language plpgsql security definer set search_path = public as $$
declare
  v_spent numeric; v_share numeric; v_days integer; v_floor numeric; v_window numeric;
  v_copy numeric; v_art numeric; v_unsplit numeric;
  v_copy_recent numeric; v_art_recent numeric;
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN'; end if;
  select coalesce((value->>'share')::numeric, 0.35) into v_share from public.app_settings where key = 'provider_reserve';
  select coalesce((value->>'days')::integer, 30), coalesce((value->>'floor_usd')::numeric, 20)
    into v_days, v_floor from public.app_settings where key = 'provider_float';
  v_share := coalesce(v_share, 0.35); v_days := coalesce(v_days, 30); v_floor := coalesce(v_floor, 20);

  select coalesce(sum(usd), 0), coalesce(sum(copy_usd), 0), coalesce(sum(art_usd), 0),
         coalesce(sum(usd), 0) - coalesce(sum(copy_usd), 0) - coalesce(sum(art_usd), 0)
    into v_spent, v_copy, v_art, v_unsplit
    from public.spend_ledger where type = 'commit';

  -- a day of burn, measured over the last 30 days of actual commits
  select coalesce(sum(copy_usd), 0) / 30, coalesce(sum(art_usd), 0) / 30
    into v_copy_recent, v_art_recent
    from public.spend_ledger where type = 'commit' and at > now() - interval '30 days';

  return query select
    (select coalesce(sum(f.gross_usd), 0) from public.fund_ledger f)::numeric,
    (select coalesce(sum(f.reserve_usd), 0) from public.fund_ledger f)::numeric,
    v_spent,
    ((select coalesce(sum(f.reserve_usd), 0) from public.fund_ledger f) - v_spent)::numeric,
    (select count(*) from public.fund_ledger f)::integer,
    v_share,
    (select min(f.at) from public.fund_ledger f),
    v_copy, v_art, greatest(v_unsplit, 0),
    round(v_copy_recent, 4), round(v_art_recent, 4),
    greatest(round(v_copy_recent * v_days, 2), v_floor),
    greatest(round(v_art_recent * v_days, 2), v_floor),
    v_days;
end $$;
revoke all on function public.fc_fund_summary() from public, anon;
grant execute on function public.fc_fund_summary() to authenticated;
