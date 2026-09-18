# Architecture

Engineering owns this file. Facts were verified on 2026-09-18 unless dated otherwise; `docs/AUDIT-2026-09-17.md` is the long form and `docs/DECISIONS.md` records what was decided.

## The system in one paragraph

A platform admin ingests a brand brief once (Claude turns prose into an enforceable JSON spec in `campaigns`). A clipper signs in with a magic link, picks a live campaign, types an idea, chooses 5 to 10 slides and a lane, and `POST /api/sets` asks Postgres to reserve slides (`fc_reserve_set`: membership, plan, allowance, spend cap, in one transaction). A worker then runs one resumable state machine (`engine/lanes.mjs`): Claude writes the copy inside a compliance loop, gpt-image-2 draws one anchor frame and edits it into the others, the engine composes typography as SVG through resvg, strips every non-pixel PNG chunk, de-slops the photo layer, uploads the slides to Storage and commits the real provider cost (`fc_commit_set`). The priority lane runs that in the request's `after()` hook; the batch lane submits to the providers' batch endpoints and a cron poller advances every open set one step per tick. The clipper polls, sees progress, and downloads a zip.

## Surfaces and hosts

| Surface | Code | Host | State on 2026-09-18 |
|---|---|---|---|
| Marketing site | `design/site.html` copied verbatim to `future-clips-site/index.html`; legal pages from `legal/*.md` via `design/build_legal.mjs` | Vercel project `the-future-clips` (`prj_fhayNaCOJChIQQe32KJt5PLemVww`), www.thefutureclips.com | Live at `index-v10`. Repo has the no-free-tier version (not yet uploaded). `og.png` 404 on the host. `/login`, `/signup` redirect to the app host. |
| App | `app/`, `lib/`, `components/`, `middleware.ts` (Next.js 15.5.24, React 19) | Vercel project `future-clips-app` (`prj_W959SiY6FoIcYxL9z9hSyqEILiAD`), future-clips-app.vercel.app | Stale: the 2026-09-11 tarball, no engine, no server secrets, legal pages behind login. |
| Engine | `engine/`, `tools/`, `campaigns/` (Node ESM, imported at runtime by file URL) | Laptop only so far; the hosted worker is `lib/worker.ts` | Works locally (`npm test` 31 checks). Never run on a host. |
| Database, auth, storage | Supabase `clipcarousel` (`waipwmyncpsgoglmkhdz`, us-east-1, Free tier, Postgres 17) | – | Schema through migration 0004 plus 0009 (security). See `docs/DATABASE.md`. |

A third Vercel project `future-clips` (`prj_j55AR37CEDttehNz3RnTolaSNDNa`) is dead and awaits deletion by the owner. `the-future-clips.vercel.app` no longer resolves to a deployment.

## Runtime layout

- **Auth gate**: `middleware.ts` runs on every `/api/*` route and every page except Next assets. It refreshes the Supabase session cookie, validates it with `getUser()`, answers 401 JSON on API routes and redirects pages to `/login?next=`. Public: `/`, `/login`, `/auth/*`, `/api/keepalive`, `/api/webhooks/*`, `/api/health`, the five legal pages, `/design-preview` (dev only) and, in dev preview mode only, `/api/file/*`.
- **Two Supabase clients**: `lib/supabase/server.ts` (cookie-bound, RLS enforced; every read a page does on a user's behalf) and `lib/supabase/admin.ts` (service role, `server-only`; the worker, `fc_commit_set` / `fc_release_set`, Storage writes, the billing webhook, admin lists).
- **Who is asking**: `lib/auth.ts getViewer()` reads `members` and picks the user's first non-platform org. Platform owners are owners of the single `orgs.is_platform` row.
- **Quota**: `lib/sets.ts reserveSet()` calls `fc_reserve_set`; the `FC_*` error codes it raises are mapped to sentences there (Product owns the sentences, not the codes).
- **Worker**: `lib/worker.ts` loads `engine/lanes.mjs` by absolute file URL (`webpackIgnore`), keeps the lane state on `sets.state_json`, locks a row with `state_json.lock` for at most 6 minutes, uploads finished slides to bucket `sets/<org>/<set>/`, mirrors the frame cache to bucket `cache`, and settles through the two SQL functions. A started set stays `status = rendering` between batch ticks; `queued` means nothing has been spent and a member may still cancel.
- **Engine entry points from the app**: `/api/sets` (priority start), `/api/cron/lanes` (poller), `/api/ingest` (brief → spec), `/api/styles` (ranked styles), `/api/studio/render` and `/api/character` (platform-owner tools).
- **Bundling**: `next.config.ts` traces `engine/**`, `assets/fonts/**`, `assets/campaigns/**` into every `/api/**` function and marks `sharp`, `@resvg/resvg-js`, `opentype.js` as external. `lib/engine.ts engineAvailable()` is checked before any engine import so a host without the engine answers 503 instead of throwing.

## Where a host may write

`lib/engine.ts workDirs()` is the only source of truth:

| Name | Laptop | Vercel | Used by |
|---|---|---|---|
| `base` | `<repo>/output` | `/tmp/fc` | `/api/file` serves relative to it |
| `cacheDir` | `output/gen/cache` | `/tmp/fc/gen/cache` | content-addressed frames (mirrored to bucket `cache`) |
| `setsDir` | `output/hosted-sets` | `/tmp/fc/hosted-sets` | the worker's per-set render dirs |
| `studioDir` | `output/sets` | `/tmp/fc/sets` | studio renders (same folder the CLI uses on a laptop) |

The engine's own state file (`engine/pairings.mjs`) uses the same base. `/tmp` on Vercel is per function instance and not durable, so anything a customer must see goes to Storage; `/api/file` is for laptop and platform-owner use.

## Environment variables

Never printed, never `NEXT_PUBLIC_` unless the browser needs it. Inspect names with `sed -E 's/=.*/=<set>/' .env.local`.

| Name | Read by | Purpose | Required on a rendering host |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | middleware, both clients, keepalive, health | project URL and publishable key (RLS is the control) | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` | worker, settlement, Storage writes, webhook, admin lists | yes |
| `ANTHROPIC_API_KEY` | `engine/providers/claude.mjs`, `claude-batch.mjs` (env first, `.env.local` second) | copy, ingest | yes |
| `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `OPENAI_INPUT_IMAGES_PER_MIN` | `engine/providers/image.mjs`, `openai-batch.mjs` | frames; model override; the org's reference-edit limit (default 5/min) | key yes |
| `CRON_SECRET` | `/api/cron/lanes` (refuses to run without it), `/api/keepalive` (optional bearer) | signs cron calls | yes |
| `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_ENV`, `DODO_PRODUCTS` | `lib/billing/dodo.ts` | billing; inert until set | for billing |
| `NEXT_PUBLIC_GOOGLE_AUTH` | login page | show the Google button | no |
| `FC_DEMO_PREVIEW`, `FC_DEMO_SETS`, `FC_DEMO_PLAN`, `FC_DEMO_PARTNERS`, `FC_DEMO_PARTNER` | `lib/demo.ts`, `/design-preview`, middleware | dev-only fixtures; a no-op in production | never |
| `VERCEL`, `VERCEL_GIT_COMMIT_SHA`, `NODE_ENV` | `workDirs()`, `/api/health`, demo guards | platform-provided | – |

`FC_ADMIN_SECRET`, `NEXT_PUBLIC_ENGINE_HOSTED`, `PEXELS_*`, `UNSPLASH_*` in the local `.env.local` are read by nothing and can be deleted.

## Deployment: today and target

Today both projects were deployed by hand through the Vercel MCP: the site as three files (`deploy/site/`) whose build fetches versioned objects from the public Storage bucket `site`; the app as a tarball (`deploy/src.tgz`, packed by `scripts/pack-deploy.mjs`). There is no GitHub link, no CLI login and no git credential on this machine, so nothing deploys from git yet.

Target (milestone M3 in `docs/ROADMAP.md`): GitHub connected to Vercel, the app deployed from `main` with the engine traced in, the site project pointed at `future-clips-site/` as its root directory with no build step, no bucket fetch, the five-minute poller running (Vercel Pro cron or pg_cron + pg_net), `app.thefutureclips.com` on the app project, Supabase Pro. Every owner-side click is listed in `OWNER-ACTIONS.md`.

## Conventions

Model rules live in the JSON `SHAPE` in `engine/generate.mjs`, never in prose. Every dollar comes from a provider usage block. Prompt text is a cache key (editing it re-pays every frame downstream). Never `git add -A`; stage by path. Never hand-edit `future-clips-site/index.html`; edit `design/site.html` and copy. Upload site objects under new names while the bucket path exists. `next` stays pinned exactly (15.5.24) until a Vercel build proves a bump. `output/` is disposable. The database is campaign truth; `campaigns/*.json` are fixtures. `FC_*` codes are the SQL-to-UI contract. Never weaken `engine/compliance.mjs`. Secrets are never `NEXT_PUBLIC_*`. `engineAvailable()` before any engine import on a host. `workDirs()` for any host write. `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build` before every commit. Schema changes are numbered migration files applied through the Supabase MCP and recorded in `docs/DATABASE.md`.

## Ownership

Engineering: `middleware.ts`, `lib/**`, `app/api/**`, `app/auth/**`, `app/admin/**` data loading and actions, `app/(legal)`, `app/app/page.tsx` data loading, `components/AppShell.tsx`, `next.config.ts`, `vercel.json`, `package.json`, `eslint.config.mjs`, `supabase/migrations/**`, `deploy/**`, `scripts/**`, `engine/providers/**`, `engine/lanes.mjs`, `engine/clean.mjs`, `engine/budget.mjs`, `engine/fonts.mjs`, `engine/fit-text.mjs`, `engine/styles/registry.mjs` mechanics, `engine/pairings.mjs` history mechanics, `tools/lane.mjs`, `tools/test-engine.mjs`, `tools/fetch-fonts.mjs`, the site build and deploy, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/ENGINE.md` (mechanics), `RUNBOOK.md`, `OWNER-ACTIONS.md`.

Product: `app/app/Dashboard.tsx`, `app/app/PartnerDashboard.tsx`, `app/dashboard.css`, `app/app.css`, `app/login/*` presentation and copy, user-facing sentences (the `REASONS` text in `lib/sets.ts`, not the codes), `engine/generate.mjs` prompts and judge rules, `engine/scenes.mjs`, `engine/art.mjs` prompt text, `engine/deslop.mjs`, `engine/styles/*.mjs` rendering and typography, `engine/caption.mjs`, `engine/grade.mjs`, `engine/ingest.mjs` prompt, `docs/PRODUCT.md`, `docs/QUALITY.md`, the "Prompt and style surfaces" section of `docs/ENGINE.md`.

Shared: `engine/compliance.mjs` (never weakened), `docs/DECISIONS.md`, `docs/ROADMAP.md`. A change to the other chat's file is minimal, never touches prompt text, and is logged under "Shared file changes" in `docs/ROADMAP.md`.

## Branches and sessions

Engineering works on `main` in the main checkout. Product works on branch `product` in the worktree `../fc-product` (created 2026-09-18 by Product: `output/` symlinked to the main checkout's cache, `.env.local` copied, launch config `future-clips-product` on port 3001). Both rebase on `main` at session start; Engineering merges `product` at its session start. Small commits, staged by path. `.env*`, `output/`, `node_modules/`, `New reference stuff/` are never committed.
