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
| `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_ENV`, `DODO_PRODUCTS` | Vercel env (server only) | the checkout (`/api/billing/checkout`), the portal, and the webhook (`/api/webhooks/dodo`). `DODO_PRODUCTS` maps plan/pack ids to Dodo product ids: `solo=pdt_…,grind=pdt_…,agency=pdt_…,p100=pdt_…,p250=pdt_…,p600=pdt_…` (yearly: `solo_year=…`). Nothing lights up until `DODO_API_KEY` is set; the buttons email us meanwhile. |
| `OPENAI_INPUT_IMAGES_PER_MIN` | Vercel env + `.env.local` | the org's "input-images per min" limit for reference-image edits (5 on a fresh org). The provider paces edits to it; raise it with the OpenAI tier. |

**Rotation:** replace in Vercel → redeploy (env changes need a new deployment) → replace in `.env.local`. Anthropic keys should be workspace-scoped so a leak is bounded by the workspace's spend limit.

## Deploy

**Site** (until the GitHub↔Vercel link exists — OWNER-ACTIONS B):
1. Edit `design/site.html` (never `future-clips-site/index.html`), then `cp design/site.html future-clips-site/index.html`; legal pages: edit `legal/*.md`, run `node design/build_legal.mjs`. Fonts are self-hosted from `future-clips-site/fonts/` (`node tools/fetch-site-fonts.mjs` refreshes them and `design/fonts.css`). Before every site commit: `node tools/site-check.mjs` (links, share meta, alt text, one h1, no free-tier wording) and a Lighthouse pass on the folder served locally, e.g. `CHROME_PATH=/usr/bin/chromium npx lighthouse http://127.0.0.1:3323/ --chrome-flags="--headless=new --no-sandbox" --output=json --output-path=/tmp/lh.json` (the bar: 95+ in every category on mobile and desktop; the local server sends no gzip, Vercel does).
2. Upload changed files to bucket `site` **under a new name** through the Supabase dashboard (Storage → `site` → Upload) or with the service role: `index-vN.html`, `legal-vN/<slug>.html`, `404-vN.html`, `fonts-vN/<file>.woff2` (the list `deploy/site/build.js` expects is in OWNER-ACTIONS 13). Anonymous uploads were removed on 2026-09-18 (migration 0009). No charset in the content type.
3. Deploy via the Vercel MCP `deploy_to_vercel` with the three files in HANDOFF-SITE.md, bumping the names in `build.js`.
4. Verify: `curl -sI https://www.thefutureclips.com/terms` → 200.

**App** (same caveat): `node scripts/pack-deploy.mjs` lists the tracked source; the MCP deploy carries plain text files only (no engine, no fonts, no binaries), so the hosted app runs without the engine until B. After B, `git push origin main` deploys everything, with `next.config.ts` tracing `engine/**` and `assets/**` into the functions.

**Database:** `supabase/migrations/*.sql` mirrors what was applied through the Supabase MCP (`apply_migration`), in parts when large. Apply new ones the same way; the file is the record. **Pending as of 2026-09-13: 0005 (agency referrals) and 0006 (plans match the site)** — see OWNER-ACTIONS D.

**Site deploy files** now live in `deploy/site/` (`package.json`, `build.js`, `vercel.json`) — they were Vercel-only before. `build.js` names the object versions to pull from bucket `site`; bump them there. The homepage source is `design/site.html`, copied verbatim to `future-clips-site/index.html` (`design/build_site.py` refuses to run unless `FC_OLD_SITE=1`).

## Rollback

- Site/app: Vercel → Deployments → promote the previous READY deployment (or redeploy the previous `index-vN` name).
- Schema: migrations are additive; to undo 0004 drop the functions/columns it added (listed at the top of the file). Nothing so far destroys data.
- Engine: `git revert`; the engine is plain files.

## The lanes (how a set is made)

`engine/lanes.mjs` — one state machine: `copy:submit → copy:wait → art:anchor:submit → art:anchor:wait → art:frames:submit → art:frames:wait → render → done|failed`.

- **Priority**: `POST /api/sets` reserves, then runs the machine in the request's background (`after()`); ~2.5 min for 7 slides.
- **Batch**: `POST /api/sets` reserves; `/api/cron/lanes` (every 5 min on Pro; daily on Hobby — see below) advances every open set one transition; a batch set submits, waits, collects.
- State is on the row (`sets.state_json`), so a dead tick resumes. A lock older than 6 min is ignored.
- `status = queued` means nothing has been spent and the member may cancel; from the first provider call to the commit the row is `rendering`, including while it waits on a provider batch (2026-09-18).
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

## Billing (Dodo Payments, merchant of record)

`lib/billing/dodo.ts` is the whole integration; the app never sees a card.
A member clicks Upgrade / a pack in Settings → Plan → `POST /api/billing/checkout`
creates a hosted checkout with `metadata.org_id` + `metadata.plan|pack` →
Dodo sends signed events to `POST /api/webhooks/dodo` (Standard Webhooks
headers; idempotent on `webhook-id` via `billing_events`, migration 0007):

| event | effect |
|---|---|
| `subscription.active` / `renewed` / `plan_changed` | `orgs.plan`, `billing_status='active'`, ids, period; `fc_record_commission` for a referred org |
| `subscription.cancelled` | `billing_status='cancelled'` (plan stays until the period ends) |
| `subscription.on_hold` / `failed` | `billing_status='past_due'` |
| `subscription.expired` | plan `free`, `billing_status='expired'` |
| `payment.succeeded` with `metadata.pack` | `fc_credit_pack` |

Set the webhook URL in Dodo to `https://<app host>/api/webhooks/dodo` with all
subscription and payment events. A non-2xx makes Dodo retry; the row in
`billing_events.outcome` says what happened to each delivery.

## Rate limits

OpenAI's image edits with a reference count against a separate "input-images
per minute" limit (5 on a fresh org). Two sets rendering at once on 2026-09-13
hit it and one failed. Now: `engine/providers/image.mjs` paces edits with a
per-process bucket (`OPENAI_INPUT_IMAGES_PER_MIN`) and honours the API's
"try again in Ns" on 429 for up to 8 tries. Raise the limit at
platform.openai.com/account/rate-limits before more than one customer is
rendering at a time.

## Re-run a set

- From the CLI, same as the host: `node tools/lane.mjs campaign=<id> ask="..." lane=batch|priority slides=6-8 style=feed` (checkpoints to `output/lanes/<id>.json`; `resume=<id>` continues an interrupted batch without paying twice — a checkpoint that failed on a provider error is rewound to its last completed step automatically).
- On the host: a failed set has already released its slides; the member creates it again. Frames already generated are cache hits (bucket `cache`, content-addressed), so a copy-only retry costs the copy.
- Stuck (`rendering` for > 10 min): the next poller tick takes it (lock expiry). To force: `update sets set state_json = state_json || '{"lock":0}' where id = ...` as the service role.

## Refund a set

`fc_release_set(set_id, 'refund: <reason>', cost)` as the service role returns the reserved slides and records the note in `spend_ledger`; the customer's balance shows it on the next poll. For a set that already committed, add the slides back with `update usage set slides_used = slides_used - N where org_id = ... and period_start = ...` and a `spend_ledger` row of type `release` so the month reconciles. Money refunds are the payment provider's dashboard (phase 5).

## Keys preflight / spend safety

- `fc_reserve_set` refuses when the org's month would pass its spend cap (`orgs.spend_cap_usd`, default the plan's `cogs_allowance_usd`). Lower it per org for suspected abuse; raise it for an agency that paid for extras.
- Every provider call bills from the usage block; nothing is estimated after the reservation.
- A missing key fails the set at its first provider call with the provider's message in `sets.error`, and the slides are released. Check `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` in Vercel before blaming the engine.

## Keepalive and health

Supabase Free pauses after 7 idle days. `/api/keepalive` runs daily from Vercel cron and does one anon read; Pro removes the pause (OWNER-ACTIONS).

`GET /api/health` (public) says whether a host can render: `{ ok, ready: { db, engine, supabase, serviceRole, anthropic, openai, cronSecret, dodo }, host, commit }`, 200 only when everything a rendering host needs is present, 503 otherwise. Booleans only. Check it after every deploy and point an uptime monitor at it.

## Tests

- `npm test` → `tools/test-engine.mjs`: every rendered slide on disk is pixels-only (no C2PA/EXIF/text chunks), `stripPng` removes the provider manifest without touching pixels, the copy judge enforces slide range and caption emojis, `slideRange` clamps to the brief.
- `npx tsc --noEmit` and `npm run lint` for the app (`eslint.config.mjs`; `any` at the database seams is a warning, everything else an error); `npm run build` before a commit that touches routes or config.
- Quota gate: the transaction in the 2026-09-12 session (rolled back) is reproducible from `supabase/migrations/0004_lanes_and_quota.sql` comments — reserve, priority-on-Solo refused, member commit refused, over-quota refused, commit 6 of 8, release.

## The de-slop pass

`engine/deslop.mjs` runs on every feed photo frame after the grade and before
the caption (`engine/styles/feed.mjs` → `frame()`): off-centre crop, flat
exposure/saturation, shadow-weighted grain, a JPEG q42 pass. Knobs are the
owner's `deslop.py` numbers (`KNOBS`); strength per look in `strengthFor`;
`assets.deslop` on a campaign pins it (0 = off). Seeded from the set, so
`tools/rerender.mjs` reproduces a set byte-for-byte. `npm test` covers it.

## A sign-in link for a tester (laptops only)

`node tools/dev-login.mjs email=<invited email> [next=/app] [app=http://localhost:3000]` mints a magic-link token with the service role (`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, OWNER-ACTIONS 1) and prints `/auth/callback?token_hash=…&type=magiclink` for this machine's app. The callback verifies the token server-side, so no PKCE verifier is needed. A new email must be on `allowed_emails` while sign-up is invite-only; it gets a personal workspace with no plan (set one with SQL or, later, from `/admin`). Never on a host; the script refuses when `VERCEL` or `NODE_ENV=production` is set.

## Files a host may write

`lib/engine.ts workDirs()`: `output/` on a laptop, `/tmp/fc` on Vercel (frame cache, per-set render dirs, studio renders, the pairing rotation state). `/api/file/<path>` serves files relative to that base to signed-in members only (and to the dev design preview when `FC_DEMO_PREVIEW=1`). `/tmp` on Vercel is per function instance, so anything a customer must see goes to Storage and comes back as a signed URL.

## Branches and worktrees

Engineering works on `main` in this checkout. Product works on branch `product` in `../fc-product` (a git worktree: `output/` symlinked here, its own `.env.local`, dev server on :3001 via the `future-clips-product` launch config). Rebase on `main` at the start of every session; Engineering merges `product` at the start of its sessions. Stage by path, never `git add -A`. Pushing needs a GitHub credential on this machine (OWNER-ACTIONS 2).
