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
| 2026-09-18 | Migration 0010 `no_free_tier_site_pricing` applied: plans are the site's (Clipper $16/200, Pro $32/500+50 priority, Studio $79/1,500+150, HD included ×3, No plan = 0), `packs`, `orgs.slide_balance`, `sets.from_balance`, balance-aware gate functions, `fc_credit_pack`, seven FK indexes, duplicate index dropped, `members_owner_remove` fixed | Supabase `list_migrations`; read-back of `plans`, `packs`, `pg_proc` |
| 2026-09-18 | `tools/dev-login.mjs` (service-role magic-link token, laptops only) and `/auth/callback?token_hash=&type=` (server-side `verifyOtp`, no PKCE verifier) | dev-login commit; needs OWNER-ACTIONS 1 to run |
| 2026-09-18 | `sharp` 0.34.5 → 0.35.4 (libvips CVE-2026-33327/33328/35590/35591, libheif advisories); `npm test` 31/31 on the new binary | `npm audit --omit=dev`: sharp findings gone; remaining: `next`'s bundled `postcss` (moderate; fix needs Next 16, deferred until a Vercel build proves a bump, D-010) |
| 2026-09-18 | Local route smoke on `npm run dev`: `/api/health` 503 `{ok:false, ready:{db:true, engine:true, serviceRole:false, cronSecret:false, …}}`; `/api/file/sets/…/slide-1.png` 401; `/api/nope.png` 401 (matcher covers every `/api/*`); `/api/keepalive` 200; `/terms` 200; `/api/styles` and `/api/sets` 401; `/` 307 → `/login`; `/login` 200 | curl, 2026-09-18 03:02 UTC |
| 2026-09-18 | Web-quality gauntlet, site (`design/site.html` → `future-clips-site/`): fonts self-hosted under `/fonts` (`tools/fetch-site-fonts.mjs`, `design/fonts.css`; no request leaves the site), footer contrast (`.ftag`, `.fcol a`, `.fbase` → `#6E6B63`), `robots.txt`, `sitemap.xml`, branded `404.html` (main landmark, description), security and cache headers in `vercel.json`, `tools/site-check.mjs` (local refs, share meta, alt text, one h1, free-tier wording). Lighthouse 13.4 (python server, no gzip): home mobile 99/100/100/100 (FCP 1.4 s, LCP 2.1 s, TBT 40 ms, CLS 0), home desktop 100/100/100/100, terms mobile 99/100/100/100, 404 100/100/100 (SEO n/a, noindex). Before: live `index-v10` 83/94/100/100 (FCP 3.3 s). Only site-check failure left: refunds "2 free Slides" (D-016) | gauntlet commit; live after OWNER-ACTIONS 13 |
| 2026-09-18 | Web-quality gauntlet, app: `/api/auth/otp` and `/api/auth/google` (magic link and Google start on the server; the login page ships no Supabase client, about 67 KB gz less JavaScript), `app/not-found.tsx`, `app/error.tsx`, `app/robots.ts` (disallow all), security headers in `next.config.ts`, `metadataBase`, footer links as 24 px targets, muted text tokens raised to 4.5:1 on both grounds. Lighthouse: login mobile 97/100/100 (TBT 180 ms), login desktop 100/100/100, terms mobile 97/100/100, terms desktop 100/100/100; SEO 63 is the intended `noindex`. Browser walk: an uninvited email shows the invite sentence; `/no-such-page` 307 → `/login` (private app) | gauntlet commit |
| 2026-09-18 | Migration 0007 applied as `billing_events` (idempotency table, `billing_status` gains `expired`, anon revoked); advisors unchanged (jobs/signups INFO, the four helper functions by design, leaked-password owner). Webhook hardened: only a duplicate `webhook-id` is a duplicate (any other insert failure is 500 so Dodo retries), `metadata.org_id` must be a uuid, the dormant referral commission call sits behind `FC_REFERRALS=1`; `/api/billing/*` refuse cross-site `Origin` and build return URLs from the forwarded host | dodo-ready commit |
| 2026-09-18 | Deploy path found: the Vercel team `earnfromwhop07-5800's projects` (Hobby) is connected through the Composio MCP and owns `the-future-clips` (`prj_fhayNaCOJChIQQe32KJt5PLemVww`, www.thefutureclips.com) and `future-clips-app` (`prj_W959SiY6FoIcYxL9z9hSyqEILiAD`); neither has a git link. The static site can be deployed as files through the API, so the bucket uploads in OWNER-ACTIONS 13 are no longer needed; the app still wants the GitHub link (B) for a full deploy with the engine | – |
| 2026-09-18 | Backend round after the owner's score of 60: `.github/workflows/ci.yml` (tsc, lint, tests, build on every push), `tests/` for the sign-in helpers and the webhook signature (`node --test` through a `server-only` stub, `npm test` runs engine + app tests), migration 0011 `rate_limits` + `fc_rate_limit` (service role only, hashed keys) behind `/api/auth/otp` (10 per address per 10 min, 5 per email per hour) and `/api/auth/google`, a Content-Security-Policy on the app (`next.config.ts`, dev-aware) and the site (`vercel.json`), verified with no console violations on `/login` and the dashboard preview; advisors unchanged | backend commit |
| 2026-09-18 | Site round after the owner's score of 60 (D-036): hero deck of five real slides, stat row, looks strip of six styles, price-free pill, CSS hero entrance; `tools/site-check.mjs` clean but for D-016. Lighthouse: home mobile 95/100/100/100 (FCP 1.4 s, SI 1.4 s, LCP 2.9 s, TBT 0), home desktop 100/100/100/100 | site round commit |
| 2026-09-18 | Owner's round-two asks: branded auth email templates + README (`supabase/templates/`), `/api/auth/verify` and a code field on the sign-in card (any-device sign-in), migration 0012 `provider_fund` (`fund_ledger`, `fc_record_sale`, `fc_fund_summary`, share 0.35 in `app_settings`) recorded by the webhook on `payment.succeeded` and shown on `/admin`, OWNER-ACTIONS 14–17 (Dodo checklist for the dashboard or the MCP, Google OAuth, templates + SMTP, provider auto-recharge). No Dodo MCP is reachable from this session yet | round-two commit |
| 2026-09-18 | Billing on a laptop: `tools/dodo-sim.mjs` (hosted checkout page, portal, Standard-Webhooks-signed `subscription.active` / `payment.succeeded`), `DODO_API_BASE` (dev only) in `lib/billing/dodo.ts`, `dodo-sim` launch config, RUNBOOK "Billing on a laptop"; the webhook checks the signature before the service-role gate. Exercised: Pro checkout and a 250-pack through the simulator reach the app signed; without `SUPABASE_SERVICE_ROLE_KEY` the app answers 503 "signature ok; nothing applied" (OWNER-ACTIONS 1 unblocks the full apply). The Dodo Payments connector exists in the registry (`mcp.dodopayments.com`) but is not connected to this account; a connect card was shown | dodo-sim commit |
| 2026-09-18 | Dodo set up through the MCP (live business): six products and the webhook endpoint (D-040); `DODO_ENV`, `DODO_PRODUCTS`, `NEXT_PUBLIC_APP_URL`, the public Supabase values and `OPENAI_IMAGE_MODEL` set on the Vercel app project; only the two Dodo secrets, the service-role key, the model keys and `CRON_SECRET` remain for the owner (OWNER-ACTIONS 14, 1, 4). `tools/dodo-products.mjs` recreates the catalogue in test mode. Security pass (D-039, D-041): httpOnly session cookies, pinned public origin, Sec-Fetch-Site, constant-time bearer checks, a per-user limit on generation requests, webhook `subscription.paused` and `refund.succeeded`, COOP, Dependabot, `SECURITY.md`, postcss overridden to a patched release (`npm audit --omit=dev` clean) | dodo-live commit |
| 2026-09-18 | Demo accounts (D-042): migration 0013 `demo_workspace`, `tools/build-demo.mjs` → `public/demo/**` + `lib/demo-manifest.ts` (ten sets, eight campaigns), demo branches in `/app`, `/api/me`, `/api/sets*`, `/api/specs`, checkout; `FC_DEMO`; the admin invite form's Demo access; `/design-preview?view=demo`; `tests/demo.test.mjs` | demo commit |
| 2026-09-19 | Local stack (D-043): `stack` launch config (site at `/` via dev-only rewrites, `/signup` → `/login`), `tools/dev-users.mjs`, `/api/auth/dev` + the Local test accounts box on `/login` (dev only), migration 0014 (test workspace on Pro, invite rows), `docs/prompts/PRODUCT-2026-09-19.md` for the Product chat; Google sign-in steps rewritten (OWNER-ACTIONS 15), `prompt=select_account` on the Google route | stack commit |

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
| E10 | 2026-09-18 | `app/app/Dashboard.tsx` line 368 shows "Your free slideshow is used. Posting every day starts on Clipper." in the no-plan state; there is no free tier (D-002). Suggested: "This workspace has no plan yet. Choose a plan to start generating." (the `FC_NO_PLAN` sentence). Seen in the owner's screenshot set; Engineering did not touch the file | open |
| E11 | 2026-09-18 | The demo workspace (D-042) shows ten example sets picked by Engineering from `output/sets/*-priority` (`tools/build-demo.mjs` DEFAULT list). Product may re-pick against the visual target and re-run the tool; also the Campaigns card for TradeLens App shows the full product paragraph where the others show a line: worth a shorter `product` in `campaigns/tradelens-app-reachify.json` | open |

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
| 2026-09-18 | `app/login/LoginForm.tsx` (Product) | the form posts to `/api/auth/otp` and `/api/auth/google` instead of importing the Supabase browser client; markup, classes and every sentence unchanged | gauntlet commit |
| 2026-09-18 | `app/app.css` (Product) | `.fc-brand small` colour → `var(--fc-body)` (the fixed `#6E6B63` failed 4.5:1 on the dark card); `.fc-legal-nav a` and `.fc-legal-foot nav a` are 24 px targets in the body colour; `--fc-muted` fallback `#707076` | gauntlet commit |
| 2026-09-18 | `app/dashboard.css` (Product) | `--text-3` `#8A8A90` → `#707076` (light) and `#77767A` → `#838286` (dark): the nearest same-hue values that clear WCAG AA 4.5:1 on paper and surface; any other passing pair is fine | gauntlet commit |
| 2026-09-18 | `app/login/LoginForm.tsx` (Product) | the "Check your inbox" card gains a 6-digit code field and a "Sign in with the code" button (same classes: `fc-form`, `fc-btn`); the sentence now mentions the code | round-two commit |
| 2026-09-19 | `app/login/page.tsx` (Product) | mounts `<DevLogin />` under the form in development only (`FC_DEV_LOGIN=1`); nothing else | stack commit |
