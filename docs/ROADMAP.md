# Roadmap

Both chats keep this file current. Read it at the start of every session after `docs/DECISIONS.md`. Evidence means a command output, a status code, a set id, a bucket listing or a commit hash, never "it works".

## Engineering

### Now (M0 wrap-up and M1: local end-to-end truth)

- Push `main` (blocked: no GitHub credential on this machine, OWNER-ACTIONS 2).
- Local end-to-end through the app on both lanes once `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local` (OWNER-ACTIONS 1): a real set landing in bucket `sets`, `fc_commit_set` rows in `spend_ledger`, the exact repro steps into `RUNBOOK.md`.
- `tools/dev-login.mjs`: mint a magic link with the service role for an allow-listed email (dev only, refuses on a host).
- Seed a test workspace on Pro with slides for both chats.
- Confirm `after()` keeps a 2.5-minute priority render alive on Vercel within `maxDuration = 300`; otherwise priority sets run from the poller, priority first.
- Independent audit sweep beyond `docs/AUDIT-2026-09-17.md`; findings appended here.

### Next (M2: database)

- Migration `0010_no_free_tier_site_pricing`: prices 16/32/79, allowances 200/500/1,500, packs and balance (`orgs.slide_balance`, `sets.from_balance`, `packs`), `plans.label`, `welcome_slides = 0`, the `free` row as "No plan", priority 50/150 and HD ×3 per D-012, the balance-aware `fc_reserve_set` / `fc_commit_set` / `fc_release_set`, `orgs_protect_billing` without referral columns unless D-017 applies 0005 first.
- Advisor fixes: drop the duplicate `sets` index, seven FK indexes, `members_owner_remove` with `(select auth.uid())`, `jobs` policy or drop, multiple-permissive-policy cleanup.
- Decide the dormant tables and buckets (`creators`, `brand_kits`, `pairing_history`, `jobs`, `signups`, `anchors`, `free-sets`) in `docs/DECISIONS.md`.
- `sets.instructions jsonb`, a private per-org uploads bucket with member read/write, and the upload route, once Product's spec lands in `docs/PRODUCT.md`.
- Decide with Product whether clippers need a trimmed campaign projection (S4: `campaigns_read` exposes agency budgets).

### Later

- M3 deploy parity: GitHub → Vercel; env; Pro plans; the app from `main` with the engine traced in; the site from git (root `future-clips-site/`, no bucket fetch), `v12` with no Free card and `og.png`; legal pages public on the app host; the five-minute poller (Vercel Pro cron or pg_cron + pg_net); `app.thefutureclips.com`; hosted end-to-end in both lanes.
- M4 core-flow infrastructure: the no-plan gate and an admin "set plan" action (D-011); instructions upload and plumbing through `fc_reserve_set`, `lib/worker.ts`, `engine/lanes.mjs newState`; an idea endpoint if Product asks; batched set polling; `content_json` slimming if payloads grow.
- M5 billing: Dodo products, env, migration 0007, `DODO_ENV=test` end to end, then live.
- M6 reliability: structured worker logs, `/api/health` on an uptime monitor, lightweight error tracking, a platform-wide OpenAI reference-edit throttle, cache eviction against the storage cap, backups, Storage-backed studio output on hosts, a copy cache by (campaign, ask, slides), archive the old-direction folders (`concepts/`, `shows/`, `library/`, `mining/`, `reference/pinterest`, `assets/library`, `assets/inhouse-only`, `design/incoming*`, `design/atlas|apex|noon|tradelens`) after a DECISIONS entry.

## Product

### Now

- First session per the Product prompt: read the audit and `ANALYSIS.md`, look at every reference, write the taxonomy and rubric into `docs/QUALITY.md`, baseline the current output for $0, walk the app in the browser, write `docs/PRODUCT.md`, file the requests below that are still open, one paid round.
- Rebase `product` onto `main` (see the first request under "Engineering → Product").

### Next / Later

- Product fills these in.

## Done

| Date | What | Evidence |
|---|---|---|
| 2026-09-18 | Working tree committed on `main` in four commits: site `60e06de`, engine `db62652`, app `15d0b14`, db `c7e7c26` | `git log --oneline -5` |
| 2026-09-18 | Bug 1: `engine/providers/claude.mjs` reads `ANTHROPIC_API_KEY` from `process.env` first, `.env.local` second | `db62652` |
| 2026-09-18 | Bug 3: `engine/pairings.mjs` rotation state under `workDirs()`-style base, best effort; `engine/styles/registry.mjs` passes `ctx.cacheDir` and `engine/styles/bedrock.mjs` uses it; `engine/lanes.mjs` passes `cacheDir` to the renderer | `db62652`; `npm test` 31/31 |
| 2026-09-18 | Bug 4: `/api/studio/render` and `/api/character` write under `lib/engine.ts workDirs()`; `/api/file` serves relative to `workDirs().base` | `15d0b14` |
| 2026-09-18 | S1: `/api/file` requires a session (dev preview excepted) and the middleware matcher covers every `/api/*` URL whatever its extension | `15d0b14`; `middleware.ts` matcher `"/api/:path*"` |
| 2026-09-18 | S2, S5, S6, S7 applied live: migration 0009 `m0_security_hardening` (anon site-bucket upload policy and waitlist insert policy dropped; anon grants revoked except SELECT on `plans`; TRUNCATE/REFERENCES/TRIGGER revoked from `authenticated`; generic set-row guard) | Supabase `list_migrations`; `pg_policies` shows neither policy; `role_table_grants` anon = `plans SELECT` only |
| 2026-09-18 | S8: `fc_next` cookie is `Secure` on https | `15d0b14` |
| 2026-09-18 | `/api/health` route (booleans, 200/503); `/api/sets/[id]` returns `content_json`; started sets stay `rendering` between batch ticks | `15d0b14` |
| 2026-09-18 | ESLint (`eslint.config.mjs`), `npm run lint` clean of errors (64 `any` warnings); `<a>` links to app pages replaced by `<Link>` | `db62652`, `15d0b14`; `lint exit=0` |
| 2026-09-18 | Site source without the Free card, Free column and free-trial claims; `future-clips-site/index.html` is the verbatim copy; `future-clips-site/README.txt` rewritten | `60e06de` (not yet deployed: OWNER-ACTIONS 13) |
| 2026-09-18 | `.env.example` complete; `New reference stuff/` ignored; `docs/` created; superseded banners on `HANDOFF-*.md`, `OPEN-DECISIONS.md`, `COST.md`; `README.md`, `RUNBOOK.md`, `OWNER-ACTIONS.md` rewritten | docs commit |
| 2026-09-18 | Checks on the committed tree: `npx tsc --noEmit` 0 errors, `npm test` 31/31, `npm run lint` 0 errors, `npm run build` success | `scratchpad/build2.log` |
| 2026-09-18 | One logo everywhere: `components/BrandMark.tsx` + `app/icon.svg` (the app had no favicon and drew a different lime-shadow mark); legal pages inline the site's SVG instead of a CSS-cropped PNG and drop the 1120×376 PNG favicon; `og.png` regenerated by `design/build_og.mjs` with the same mark and no "Start free"; video title card colour aligned; `deploy/site/build.js` names `index-v12.html`, `og-v2.png`, `legal-v2/*` | brand commit; `docs/ARCHITECTURE.md` "Brand assets" |
| 2026-09-18 | Local route smoke on `npm run dev`: `/api/health` 503 `{ok:false, ready:{db:true, engine:true, serviceRole:false, cronSecret:false, …}}`; `/api/file/sets/…/slide-1.png` 401; `/api/nope.png` 401 (matcher covers every `/api/*`); `/api/keepalive` 200; `/terms` 200; `/api/styles` and `/api/sets` 401; `/` 307 → `/login`; `/login` 200 | curl, 2026-09-18 03:02 UTC |

Spend this session: $0 (no paid generation).

## Requests: Product → Engineering

File here with the exact field, endpoint or bug, a repro and a screenshot path. Engineering answers with a status and a commit hash.

| # | Date | Request | Status | Answer |
|---|---|---|---|---|
| – | – | (none yet) | | |

## Requests: Engineering → Product

| # | Date | Request | Status |
|---|---|---|---|
| E1 | 2026-09-18 | Rebase `product` onto `main` (`git fetch` is not needed, both are local: `cd ../fc-product && git rebase main`). Your `a42506d` "wip snapshot" commit duplicates what `main` now carries in four commits; after the rebase it should shrink to nothing or to your own edits. Resolve any conflict in favour of `main` for Engineering-owned files. | open |
| E2 | 2026-09-18 | Free-tier wording still in `app/app/Dashboard.tsx` (your file): "Your free slideshow is used. Posting every day starts on Clipper.", "Needs a plan.", the `paid` notice logic, and any "one free slideshow" text; replace with the choose-a-plan state from D-002/D-011. `lib/sets.ts` `FC_NO_PLAN` now reads "This workspace has no plan yet. Choose a plan to start generating." (rewrite as you like, keep the code). | open |
| E3 | 2026-09-18 | `stageLabel()` in `lib/sets.ts` (your words): batch sets now stay `status = rendering` while waiting on a provider batch (D-023), so the "In the queue" branch only applies before the first provider call; decide what "waiting for the batch" should say. | open |
| E4 | 2026-09-18 | `GET /api/sets/[id]` now returns `content_json`, so the drawer keeps its slide text for sets finished in-session; nothing to change unless you want a slimmer payload. | info |
| E5 | 2026-09-18 | `/api/file` URLs are now relative to the working base: `/api/file/sets/<name>/slide-1.png` (was `/api/file/output/sets/...`). `lib/demo.ts` was updated; check any URL you build by hand. In the design preview (`FC_DEMO_PREVIEW=1`) these images load without a session; everywhere else a session is required. | info |
| E6 | 2026-09-18 | `design/site.html`: the no-free-tier edits (D-020) are placeholders for your wording: the closing section, the mobile bar, "Get started". The yearly toggle and the "$20/mo" hero pill wait for D-013. | open |
| E7 | 2026-09-18 | Lint is on: 64 warnings, mostly `any` in `Dashboard.tsx`, `PartnerDashboard.tsx` and `StudioClient.tsx`; no action required, errors would fail the build so run `npm run lint` before committing. | info |
| E9 | 2026-09-18 | The brand mark in the app is now the site's three-card SVG via `components/BrandMark.tsx` (owner instruction: the same logo everywhere); `.fc-brand` wordmark rules mirror the site. Keep both in step with `docs/ARCHITECTURE.md` "Brand assets" if you restyle. | info |
| E8 | 2026-09-18 | `docs/PRODUCT.md` and `docs/QUALITY.md` are seeded stubs; the instructions feature spec (fields, storage, where each appears per style) is what unblocks `sets.instructions` and the upload route on the Engineering side. | open |

## Blocked on owner

Mirror of `OWNER-ACTIONS.md`: 1 service-role key locally (M1), 2 GitHub credential (push), 3 GitHub ↔ Vercel (M3), 4 Vercel env (hosted rendering), 5 Supabase Auth URLs (hosted sign-in), 6 SMTP, 7 leaked-password protection, 8 Vercel Pro, 9 Supabase Pro, 10 delete the dead project, 11 app domain, 12 Dodo, 13 interim site upload. Decisions D-011 to D-018.

## Shared file changes

| Date | File (owner) | Change | Commit |
|---|---|---|---|
| 2026-09-18 | `engine/styles/bedrock.mjs` (Product) | line 42: figure cache dir from `ctx.cacheDir`, laptop default unchanged; no prompt text touched | `db62652` |
| 2026-09-18 | `app/login/LoginForm.tsx` (Product) | `fc_next` cookie gets `; secure` on https; nothing else | `15d0b14` |
| 2026-09-18 | `lib/sets.ts` REASONS (Product's words) | `FC_NO_PLAN` sentence no longer promises a free slideshow | `15d0b14` |
| 2026-09-18 | `app/studio/StudioClient.tsx` (grey) | `<a href="/admin/new">` → `<Link>` for lint | `15d0b14` |
| 2026-09-18 | `design/site.html` (site copy) | free-tier removals per D-020 | `60e06de` |
| 2026-09-18 | `app/login/page.tsx` (Product) | `<span class="fc-mark">` → `<BrandMark />`; nothing else | brand commit |
| 2026-09-18 | `app/app.css` (Product) | `.fc-mark` rule replaced by `.fc-brand svg` sizing and the site's wordmark rules (small caps "THE" over "futureclips") | brand commit |
