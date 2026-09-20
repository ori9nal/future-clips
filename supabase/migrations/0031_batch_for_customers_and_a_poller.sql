-- 0031: customers' sets go through the batch APIs; a poller runs every five minutes.
--
-- The owner's rule is 50% margin at full use. Rendering everything on the
-- realtime path (0030) could not reach it: 24% at the best measured cost. The
-- providers' batch APIs run the same words and frames at half the price, so
-- every customer's set now takes the batch lane and only the demo — the shop
-- window, capped at a handful of carousels — renders in two minutes. A batch
-- comes back within the day and usually much sooner; the customer's set says
-- "In the queue" and then "Writing the slides, in the batch queue" while it
-- waits, and lands in the library when it is collected.
--
-- Somebody has to collect it. Vercel's cron on the Hobby plan is daily, so
-- pg_cron here calls /api/cron/lanes every five minutes with a bearer held in
-- Vault (`cron_bearer`); the route reads the same secret through
-- fc_cron_bearer() with the service role and compares. One place for the key,
-- no Vercel secret involved, rotation is one Vault update. The poller also
-- rewrites the Dodo product descriptions from the plans table once a day.
--
-- Spend caps are sized for the batch reserve rate (0.03 a slide): $6 / $12 /
-- $30, so the whole allowance can be used.
--
-- Applied as `pg_cron_and_pg_net` and by hand (the schedule and the secret):
--   create extension pg_cron; create extension pg_net;
--   select vault.create_secret('<bearer>', 'cron_bearer', '...');
--   select cron.schedule('fc-lanes-poller', '*/5 * * * *', $$ select net.http_get(
--     url := 'https://app.thefutureclips.com/api/cron/lanes',
--     headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_bearer' limit 1)),
--     timeout_milliseconds := 120000) $$);

create or replace function public.fc_cron_bearer()
returns text language sql security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cron_bearer' limit 1;
$$;
revoke all on function public.fc_cron_bearer() from public, anon, authenticated;
grant execute on function public.fc_cron_bearer() to service_role;

update public.plans set cogs_allowance_usd = round(slides_per_month * 0.03, 2) where id in ('solo', 'grind', 'agency');
