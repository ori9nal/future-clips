-- 0026: the demo gets a fixed number of carousels, not a rate.
--
-- The daily limits (three a visitor, fifteen a day) cap how fast the demo can
-- spend; they do not cap how much. The owner wanted a hard number — five more
-- from a given moment — after which the demo stops making anything and the
-- shipped examples are all it shows. That number lives in app_settings so it
-- can be raised, or the clock restarted, with one update and no deploy:
--
--   update public.app_settings
--      set value = jsonb_build_object('from', now(), 'sets', 10), updated_at = now()
--    where key = 'demo_budget';
--
-- No row means no budget: the daily limits and the org's spend cap are then
-- the only gates, which is how the demo behaved before this migration.

insert into public.app_settings (key, value, updated_at)
values ('demo_budget', jsonb_build_object('from', now(), 'sets', 5), now())
on conflict (key) do nothing;

-- What is left, as one object, so the gate and the admin page agree by
-- construction. SECURITY DEFINER because app_settings is readable by the
-- owner alone and the caller here is a demo visitor.
create or replace function public.fc_demo_budget(p_org uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
stable
as $$
  with b as (
    select coalesce((value->>'sets')::integer, 0) as allowed,
           (value->>'from')::timestamptz          as since
      from public.app_settings
     where key = 'demo_budget'
  ), u as (
    select b.*, (select count(*) from public.sets s
                  where s.org_id = p_org
                    and s.created_at >= b.since
                    and not coalesce(s.is_sample, false))::integer as used
      from b
  )
  select jsonb_build_object('allowed', allowed, 'used', used,
                            'left', greatest(0, allowed - used), 'since', since)
    from u;
$$;
revoke all on function public.fc_demo_budget(uuid) from public, anon;
grant execute on function public.fc_demo_budget(uuid) to authenticated, service_role;


-- The gate, in fc_reserve_set, immediately after `select * into v_org ... for
-- update` so two visitors arriving together cannot both take the last one:
--
--   if v_org.is_demo then
--     v_budget := public.fc_demo_budget(p_org);
--     if v_budget is not null and (v_budget->>'left')::integer <= 0 then
--       raise exception 'FC_DEMO_BUDGET' using detail = format('%s of %s used since %s',
--         v_budget->>'used', v_budget->>'allowed', v_budget->>'since');
--     end if;
--   end if;
--
-- Applied as `demo_budget_gate` (the whole function body, 0015's with those
-- five lines added and `v_budget jsonb` declared).

-- There were two overloads of fc_reserve_set, differing only by the
-- p_instructions the newer one defaults to null. Ten positional arguments
-- matched both, so such a call raised "function is not unique"; nothing made
-- one (lib/sets.ts sends all eleven by name, and no database function calls
-- it at all). The older signature goes, so there is one body to hold the gate
-- rather than two that can drift apart.
drop function if exists public.fc_reserve_set(uuid, text, text, text, integer, integer, text, boolean, uuid, text);
