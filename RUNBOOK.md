# RUNBOOK.md

How to run, ship, and unbreak Future Clips. Two hosts: the static site
(`www.thefutureclips.com`, Vercel project `the-future-clips`) and the app
(`future-clips-app.vercel.app`, Vercel project `future-clips-app`). One
database: Supabase project `clipcarousel` (`waipwmyncpsgoglmkhdz`).

## Keys, and where they live

| Key | Where | Who may see it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env + `.env.local`; inline in the site | browsers (RLS is the control) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (server only) | the worker, the admin list, Storage writes. **Never** `NEXT_PUBLIC_`, never in a client component (`lib/supabase/admin.ts` is `server-only`) |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | Vercel env + `.env.local` | the engine |
| `CRON_SECRET` | Vercel env | Vercel's cron and anything else allowed to poke `/api/cron/lanes` |

**Rotation:** replace in Vercel → redeploy (env changes need a new deployment) → replace in `.env.local`. Anthropic keys should be workspace-scoped so a leak is bounded by the workspace's spend limit.

## Deploy

**Site** (until the GitHub↔Vercel link exists — OWNER-ACTIONS B):
1. Edit `design/Main.dc.html` (never `future-clips-site/index.html`), run `python design/build_site.py`; legal pages: edit `legal/*.md`, run `node design/build_legal.mjs`.
2. Upload changed files to bucket `site` **under a new name** (anon policy is insert-only): `index-vN.html`, `legal-vN/<slug>.html`. No charset in the content type.
3. Deploy via the Vercel MCP `deploy_to_vercel` with the three files in HANDOFF-SITE.md, bumping the names in `build.js`.
4. Verify: `curl -sI https://www.thefutureclips.com/terms` → 200.

**App** (same caveat): `node scripts/pack-deploy.mjs` lists the tracked source; the MCP deploy carries plain text files only (no engine, no fonts, no binaries), so the hosted app runs without the engine until B. After B, `git push origin main` deploys everything, with `next.config.ts` tracing `engine/**` and `assets/**` into the functions.

**Database:** `supabase/migrations/*.sql` mirrors what was applied through the Supabase MCP (`apply_migration`), in parts when large. Apply new ones the same way; the file is the record.

## Rollback

- Site/app: Vercel → Deployments → promote the previous READY deployment (or redeploy the previous `index-vN` name).
- Schema: migrations are additive; to undo 0004 drop the functions/columns it added (listed at the top of the file). Nothing so far destroys data.
- Engine: `git revert`; the engine is plain files.

## The lanes (how a set is made)

`engine/lanes.mjs` — one state machine: `copy:submit → copy:wait → art:anchor:submit → art:anchor:wait → art:frames:submit → art:frames:wait → render → done|failed`.

- **Priority**: `POST /api/sets` reserves, then runs the machine in the request's background (`after()`); ~2.5 min for 7 slides.
- **Batch**: `POST /api/sets` reserves; `/api/cron/lanes` (every 5 min on Pro; daily on Hobby — see below) advances every open set one transition; a batch set submits, waits, collects.
- State is on the row (`sets.state_json`), so a dead tick resumes. A lock older than 6 min is ignored.
- The worker is the only writer of set state and the only caller of `fc_commit_set` / `fc_release_set` (service role). Members can reserve and flip `cancel_requested`; the trigger `sets_member_update_guard` refuses anything else.

**Hobby cron is daily.** Until Vercel Pro, poke the poller from Supabase every 5 minutes with pg_cron + pg_net:
```sql
select cron.schedule('fc-lanes', '*/5 * * * *', $$
  select net.http_post('https://future-clips-app.vercel.app/api/cron/lanes',
    headers := jsonb_build_object('authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb);
$$);
```
(store `CRON_SECRET` in Vault first: `select vault.create_secret('<value>', 'cron_secret');`). Needs the `pg_cron` and `pg_net` extensions enabled in the dashboard.

## Re-run a set

- From the CLI, same as the host: `node tools/lane.mjs campaign=<id> ask="..." lane=batch|priority slides=6-8 style=feed` (checkpoints to `output/lanes/<id>.json`; `resume=<id>` continues an interrupted batch without paying twice).
- On the host: a failed set has already released its slides; the member creates it again. Frames already generated are cache hits (bucket `cache`, content-addressed), so a copy-only retry costs the copy.
- Stuck (`rendering` for > 10 min): the next poller tick takes it (lock expiry). To force: `update sets set state_json = state_json || '{"lock":0}' where id = ...` as the service role.

## Refund a set

`fc_release_set(set_id, 'refund: <reason>', cost)` as the service role returns the reserved slides and records the note in `spend_ledger`; the customer's balance shows it on the next poll. For a set that already committed, add the slides back with `update usage set slides_used = slides_used - N where org_id = ... and period_start = ...` and a `spend_ledger` row of type `release` so the month reconciles. Money refunds are the payment provider's dashboard (phase 5).

## Keys preflight / spend safety

- `fc_reserve_set` refuses when the org's month would pass its spend cap (`orgs.spend_cap_usd`, default the plan's `cogs_allowance_usd`). Lower it per org for suspected abuse; raise it for an agency that paid for extras.
- Every provider call bills from the usage block; nothing is estimated after the reservation.
- A missing key fails the set at its first provider call with the provider's message in `sets.error`, and the slides are released. Check `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in Vercel before blaming the engine.

## Keepalive

Supabase Free pauses after 7 idle days. `/api/keepalive` runs daily from Vercel cron and does one anon read; Pro removes the pause (OWNER-ACTIONS 2).

## Tests

- `npm test` → `tools/test-engine.mjs`: every rendered slide on disk is pixels-only (no C2PA/EXIF/text chunks), `stripPng` removes the provider manifest without touching pixels, the copy judge enforces slide range and caption emojis, `slideRange` clamps to the brief.
- `npx tsc --noEmit` for the app.
- Quota gate: the transaction in the 2026-09-12 session (rolled back) is reproducible from `supabase/migrations/0004_lanes_and_quota.sql` comments — reserve, priority-on-Solo refused, member commit refused, over-quota refused, commit 6 of 8, release.
