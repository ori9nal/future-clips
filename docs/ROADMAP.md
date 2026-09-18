# Roadmap

Both chats keep this file current. Read it at the start of every session after `docs/DECISIONS.md`. Evidence means a command output, a status code, a set id, a bucket listing or a commit hash, never "it works".

## Engineering

### Now (M0 wrap-up and M1: local end-to-end truth)

- Push `main` (blocked: no GitHub credential on this machine, OWNER-ACTIONS 2).
- Local end-to-end through the app on both lanes once `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local` (OWNER-ACTIONS 1): a real set landing in bucket `sets`, `fc_commit_set` rows in `spend_ledger`, the exact repro steps into `RUNBOOK.md`.
- Seed a second test workspace once the service role key exists (the owner's personal workspace `earnfromwhop07` is on Pro with 500 slides after 0010).
- Confirm `after()` keeps a 2.5-minute priority render alive on Vercel within `maxDuration = 300`; otherwise priority sets run from the poller, priority first.
- Independent audit sweep beyond `docs/AUDIT-2026-09-17.md`; findings appended here.

### Next (M2: database, remainder)

- `jobs` policy or drop, multiple-permissive-policy cleanup (cosmetic).
- Decide the dormant tables and buckets (`creators`, `brand_kits`, `pairing_history`, `jobs`, `signups`, `anchors`, `free-sets`) in `docs/DECISIONS.md`.
- `sets.instructions jsonb`, a private per-org uploads bucket with member read/write, and the upload route, once Product's spec lands in `docs/PRODUCT.md`.
- Decide with Product whether clippers need a trimmed campaign projection (S4: `campaigns_read` exposes agency budgets).

### Later

- M3 deploy parity: GitHub → Vercel; env; Pro plans; the app from `main` with the engine traced in; the site from git (root `future-clips-site/`, no bucket fetch), `v12` with no Free card and `og.png`; legal pages public on the app host; the five-minute poller (Vercel Pro cron or pg_cron + pg_net); `app.thefutureclips.com`; hosted end-to-end in both lanes.
- M4 core-flow infrastructure: the no-plan gate and an admin "set plan" action (D-011); instructions upload and plumbing through `fc_reserve_set`, `lib/worker.ts`, `engine/lanes.mjs newState`; an idea endpoint if Product asks; batched set polling; `content_json` slimming if payloads grow.
- M5 billing: Dodo products, env, migration 0007, `DODO_ENV=test` end to end, then live.
- Dependency: `next` 15.5.24 bundles a `postcss` with a source-map path-traversal advisory (GHSA-r28c-9q8g-f849, build-time only); the fix is Next 16, which needs a Vercel build to prove (convention). Revisit at M3.
- M6 reliability: structured worker logs, `/api/health` on an uptime monitor, lightweight error tracking, a platform-wide OpenAI reference-edit throttle, cache eviction against the storage cap, backups, Storage-backed studio output on hosts, a copy cache by (campaign, ask, slides), archive the old-direction folders (`concepts/`, `shows/`, `library/`, `mining/`, `reference/pinterest`, `assets/library`, `assets/inhouse-only`, `design/incoming*`, `design/atlas|apex|noon|tradelens`) after a DECISIONS entry.

## Product

### Now (2026-09-18, the gauntlet loop)

- Run paid rounds one family at a time, one or two named fixes per round, each verifiable on the sheet; log Claude $ and image $ per run in `output/gauntlet/COSTS.md` (rebuilt from `output/lanes/*.json`) and the score in `docs/QUALITY.md` §7. Stop to ask at $15 this session (D-018 note).
- Gym: F6 (a from-behind body part asked for as a POV shot), skin and room mess in the frames; trading: the app pill at the reference size (cap ≈ 60 px), one car across the set (the car frames edited from the first car frame), no tag line under an app name; food: outfit dealer, the app photographed on a phone.
- Read the signed-in instagram.com/growithalex posts into QUALITY.md §3.4 (the cookies arrived 2026-09-18).
- Verify the numbering rule (D-033) and the no-plan state on the real app once the service role key exists (OWNER-ACTIONS 1) with `tools/dev-login.mjs`.

### Next

- Instructions UI in the composer once `sets.instructions` and the upload route exist (PRODUCT.md §3, R3).
- Recent as a one-row strip on Create (D-039 pending); "Exactly N" in the composer; Shift+Enter hint.
- Rail rebuilt to the Grow with Alex grammar (D-040) after D-014.
- Site wording for the no-free-tier edits (E6).

### Later

- Dark collage style if the owner wants that family (D-015).
- Edit text and re-render for $0 in the drawer (Terms §3.2 promises it).
- Mobile composer polish after a real sign-in pass on a phone.

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
| 2026-09-18 | Migration 0010 `no_free_tier_site_pricing` applied: plans are the site's (Clipper $16/200, Pro $32/500+50 priority, Studio $79/1,500+150, HD included ×3, No plan = 0), `packs`, `orgs.slide_balance`, `sets.from_balance`, balance-aware gate functions, `fc_credit_pack`, seven FK indexes, duplicate index dropped, `members_owner_remove` fixed | Supabase `list_migrations`; read-back of `plans`, `packs`, `pg_proc` |
| 2026-09-18 | `tools/dev-login.mjs` (service-role magic-link token, laptops only) and `/auth/callback?token_hash=&type=` (server-side `verifyOtp`, no PKCE verifier) | dev-login commit; needs OWNER-ACTIONS 1 to run |
| 2026-09-18 | `sharp` 0.34.5 → 0.35.4 (libvips CVE-2026-33327/33328/35590/35591, libheif advisories); `npm test` 31/31 on the new binary | `npm audit --omit=dev`: sharp findings gone; remaining: `next`'s bundled `postcss` (moderate; fix needs Next 16, deferred until a Vercel build proves a bump, D-010) |
| 2026-09-18 | Local route smoke on `npm run dev`: `/api/health` 503 `{ok:false, ready:{db:true, engine:true, serviceRole:false, cronSecret:false, …}}`; `/api/file/sets/…/slide-1.png` 401; `/api/nope.png` 401 (matcher covers every `/api/*`); `/api/keepalive` 200; `/terms` 200; `/api/styles` and `/api/sets` 401; `/` 307 → `/login`; `/login` 200 | curl, 2026-09-18 03:02 UTC |

| 2026-09-18 | Product: baseline | Scored every on-disk family against the references with side-by-side sheets | gym 66 · trading 59 · food 67 · supplements 58 · Grow with Alex 45 | $0 |
| 2026-09-18 | Product: 0 | apex-strength lats, current prompts | 73 | $0.47 |
| 2026-09-18 | Product: 1a | feed caption size ×1.4, outline held, bands at the reference position | 77 | $0 |
| 2026-09-18 | Product: 1b | de-slop grain 2.4/1.3 | 79 | $0 |
| 2026-09-18 | Product: 2 | tradelens apps ranked, current prompts (trading baseline) | 78 | $0.35 |
| 2026-09-18 | Product: rule | numbering direction (D-033) in the copy shape, rules, judge and toRenderable, with 5 new npm test checks | — | $0 |
| 2026-09-18 | Product: app | picker search and plain format words, HD/priority cost line, error sentences, no-plan state without free-tier words, Refer page hidden, mobile meter clip, mobile light buttons, focus ring; REASONS sentences | — | $0 |
| 2026-09-18 | Product: docs | QUALITY.md v1, PRODUCT.md v1, DECISIONS.md, ROADMAP.md; product branch + worktree | — | — |
| 2026-09-18 | Product: round 3, gym, F6 (behind parts never POV) | 84 vs set-08 | Claude $0.0746 + image $0.3953 |
| 2026-09-18 | Product: round 4, trading, one car across the set, pill at the reference size, tag lines repaired | 82 vs set-01; 85 after the $0 re-render (rank on the app slide, pill on every app) | Claude $0.0819 + image $0.2830 |
| 2026-09-18 | Product: `output/` arranged (README, `_attic/`, dated `gauntlet/` folders, `COSTS.md` rebuilt from `output/lanes`); `tools/_gauntlet.mjs` runner; two growithalex carousels saved to `reference/growithalex/ig/` | — | $0 |
| 2026-09-18 | Product: round 5, gym, cable row = row, mirror-from-behind | 86 vs set-08 | Claude $0.0912 + image $0.3446 |
| 2026-09-18 | Product: round 6, trading, no ratings on apps, mistakes on their kinds, pill on every app | 84 vs set-01; 86 after the $0 re-render (promised count numbers the apps) | Claude $0.1826 (two attempts) + image $0.2834 |
| 2026-09-18 | Product: round 7, gym lessons, ordinary face on the anchor; the model chose numbering up on its own (D-033 verified) | 87 vs set-08 | Claude $0.0691 + image $0.3951 |
| 2026-09-18 | Product: five growithalex carousels saved to `reference/growithalex/ig/` (43 slides, captions); the family's two page grammars written into QUALITY.md §3.4 | — | $0 |

Spend: Engineering $0. Product 2026-09-18: $3.02 through round 7 (rounds 8 and 9 running); every run with its Claude and image dollars in `output/gauntlet/COSTS.md`.

## Requests: Product → Engineering

File here with the exact field, endpoint or bug, a repro and a screenshot path. Engineering answers with a status and a commit hash.

| # | Date | Request | Status | Answer |
|---|---|---|---|---|
| R1 | 2026-09-18 | **Dev sign-in**: `tools/dev-login.mjs email=<invited email>` that mints a session locally (service role `generateLink` + code exchange, or a cookie written for the running dev server) so the real `/app` can be tested without Supabase's mailer, which allows a few emails an hour for the whole project. Why: Every app finding this session is from the design preview (PRODUCT.md §6 says which); none is validated on the real app. | done by Engineering (`tools/dev-login.mjs`); still needs the service-role key locally | |
| R2 | 2026-09-18 | **`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`** (OWNER-ACTIONS E). Why: Without it nothing renders through the app locally; sets were generated through `tools/lane.mjs` instead. | blocked on owner (OWNER-ACTIONS 1) | |
| R3 | 2026-09-18 | **Instructions storage + API** (D-037): `sets.instructions jsonb` `{ logo_path, avatar_path, handle, note }`; org assets in the `assets` bucket under `<org>/logo.<ext>` and `<org>/avatar.<ext>` (png/jpg/webp ≤ 2 MB); `POST /api/assets` (multipart, returns the path), `DELETE /api/assets/:kind`; `GET /api/me` returns `defaults: { handle, logo_url, avatar_url }`; `POST /api/sets` accepts `instructions` (handle ≤ 30 chars `^@?[a-z0-9._]+$`, note ≤ 200 chars) and the worker passes it to `toRenderable` as `spec.instructions`. Product renders it in the styles. Why: The composer and the engine have nowhere to put a logo, an avatar, a handle or a note today. | open (spec in PRODUCT.md §3) | |
| R4 | 2026-09-18 | `GET /api/sets/:id` should return `content_json` (audit bug 14). Why: The drawer shows no "Text on the slide" for a set finished while the page was open. | done (E4) | |
| R5 | 2026-09-18 | A batch set waiting on a provider batch needs a stage the UI can show (audit bug 15): keep `stage` on the row while `status = queued` after the first tick, or add `waiting_on: 'copy' \| 'anchor' \| 'frames'`. Why: The card shows "In the queue" for hours with no step lit. | done (D-023) | |
| R6 | 2026-09-18 | `tools/rerender.mjs dir=<set folder>` (or `lane=priority`) so a lane output can be re-rendered for $0 without copying it to `output/sets/<campaign>-<style>`. Why: Rounds 1a/1b used a scratch script for this. | open; Product uses `tools/_rerender-dir.mjs` meanwhile | |
| R7 | 2026-09-18 | Free-tier removals outside Product's files: the site's Free card and copy, `lib/demo.ts` free plan fixture, the `free` welcome-balance path in migration 0006 / `fc_reserve_set`, the Refund Policy sentence (owner). Why: D-002. | site and DB done (D-020, 0010); `lib/demo.ts` free fixture and the Refund Policy sentence remain | |
| R8 | 2026-09-18 | Every API error carries a `code` (the create route already does for FC_*); `sign in required` on a 401 should come with `code: 'AUTH'`. Why: The composer showed the raw string "sign in required" as the error (preview, PRODUCT.md finding 8); Product maps codes to sentences. | open | |
| R9 | 2026-09-18 | Campaign payload for the picker: keep `guidance.angles`, add `assets.app_icon` / `app_screen` presence flags and `content.style`. Why: The picker will show "shows an app icon" and a plain-English format word instead of "photo feed". | open | |
| R10 | 2026-09-18 | Owner environment: sign in to the Claude in Chrome extension on this machine so the Instagram reference pass can page through full posts (list_connected_browsers returned none). Why: The owner asked for the growithalex posts to be read in Chrome; only the public grid was reachable. | done: the owner imported Instagram cookies 2026-09-18; the in-app browser is signed in | |

## Requests: Engineering → Product

| # | Date | Request | Status |
|---|---|---|---|
| E1 | 2026-09-18 | Rebase `product` onto `main` (`git fetch` is not needed, both are local: `cd ../fc-product && git rebase main`). Your `a42506d` "wip snapshot" commit duplicates what `main` now carries in four commits; after the rebase it should shrink to nothing or to your own edits. Resolve any conflict in favour of `main` for Engineering-owned files. | open: done 2026-09-18: `product` rebased with `--onto main`, the snapshot dropped, five conflicts resolved (four docs merged, `lib/sets.ts` REASONS kept as Product's words) |
| E2 | 2026-09-18 | Free-tier wording still in `app/app/Dashboard.tsx` (your file): "Your free slideshow is used. Posting every day starts on Clipper.", "Needs a plan.", the `paid` notice logic, and any "one free slideshow" text; replace with the choose-a-plan state from D-002/D-011. `lib/sets.ts` `FC_NO_PLAN` now reads "This workspace has no plan yet. Choose a plan to start generating." (rewrite as you like, keep the code). | open: done in Product's commit: notice, plan tab, meter and REASONS carry no free-tier sentence; the no-plan state is PRODUCT.md §2.5 |
| E3 | 2026-09-18 | `stageLabel()` in `lib/sets.ts` (your words): batch sets now stay `status = rendering` while waiting on a provider batch (D-023), so the "In the queue" branch only applies before the first provider call; decide what "waiting for the batch" should say. | open: done: on the batch lane a `:wait` stage reads "…, in the batch queue"; `queued` reads "In the queue" only before the first provider call |
| E4 | 2026-09-18 | `GET /api/sets/[id]` now returns `content_json`, so the drawer keeps its slide text for sets finished in-session; nothing to change unless you want a slimmer payload. | info: noted; the drawer keeps its text |
| E5 | 2026-09-18 | `/api/file` URLs are now relative to the working base: `/api/file/sets/<name>/slide-1.png` (was `/api/file/output/sets/...`). `lib/demo.ts` was updated; check any URL you build by hand. In the design preview (`FC_DEMO_PREVIEW=1`) these images load without a session; everywhere else a session is required. | info: noted; Dashboard.tsx builds no file URLs by hand |
| E6 | 2026-09-18 | `design/site.html`: the no-free-tier edits (D-020) are placeholders for your wording: the closing section, the mobile bar, "Get started". The yearly toggle and the "$20/mo" hero pill wait for D-013. | open: open: Product proposes the wording next session |
| E7 | 2026-09-18 | Lint is on: 64 warnings, mostly `any` in `Dashboard.tsx`, `PartnerDashboard.tsx` and `StudioClient.tsx`; no action required, errors would fail the build so run `npm run lint` before committing. | info: noted |
| E9 | 2026-09-18 | The brand mark in the app is now the site's three-card SVG via `components/BrandMark.tsx` (owner instruction: the same logo everywhere); `.fc-brand` wordmark rules mirror the site. Keep both in step with `docs/ARCHITECTURE.md` "Brand assets" if you restyle. | info: noted |
| E8 | 2026-09-18 | `docs/PRODUCT.md` and `docs/QUALITY.md` are seeded stubs; the instructions feature spec (fields, storage, where each appears per style) is what unblocks `sets.instructions` and the upload route on the Engineering side. | open: done: PRODUCT.md §3 has the fields, storage paths, limits and per-style placement; R3 carries the API contract |

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
