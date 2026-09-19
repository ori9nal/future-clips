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

### Now (2026-09-18, second session: the owner's instructions)

- No gauntlet loop until the owner asks again: one set per niche (rounds 12–17: design/rail, nutrition, supplements, personal finance, skincare, mindset), the owner scores them (current owner score 7/10 on the gym and trading sets).
- Every set from round 12 carries `costs.json` (Claude and image dollars per slide); R11 asks Engineering to persist the same in the checkpoint.
- The rail style renders the Grow with Alex grammar (P-08 in effect); first paid rail set is round 12. Next on that style: the cover photograph's subject (the model draws a phone for "carousel"), the pairing's quiet face on covers, real cards for app slides.
- Still to verify on a paid gym and trading round when the owner wants: F24 (grip regex) and F25 (apps-count rule).
- Verify the numbering rule (P-01) and the no-plan state on the real app once the service role key exists (OWNER-ACTIONS 1) with `tools/dev-login.mjs`.

- **2026-09-18 (third pass, the owner's second reference batch):** four scene families with their own subjects and camera lines (sport, fashion, life, everyday), the soft-shadow centred caption look at 9:16, the App Store card, the campaign's language honoured, and the numbers rule scoped to the families that use numbers — QUALITY.md §3.12–3.14, P-16…P-19, rounds 26–29.

### Next

- Instructions UI in the composer once `sets.instructions` and the upload route exist (PRODUCT.md §3, R3).
- Recent as a one-row strip on Create (P-07 pending); "Exactly N" in the composer; Shift+Enter hint.
- Rail: second pass after the owner's score on round 12 (cover subject, app cards, a light page for the closer).
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
| 2026-09-19 | The hidden demo host and 4-slide demo sets (D-045): `/api/auth/demo` (server-minted token on a host), `FC_DEMO_HOSTNAME` + `FC_DEMO_GENERATE` on the app project, hostname `fc-demo-7byf1w5k97u.vercel.app` attached, migration 0015 (gate accepts 4 for demo orgs, $15 cap), `/api/sets` forces 4 slides / priority / 3 per visitor per day for demo members, the lane honours a range below the brief, `compliance_json.clean` records what the metadata gate stripped and that slides are pixels only. Pricing: `docs/PRICING-MODEL.md`, `tools/pricing.mjs` (D-044). Inventory: `docs/CAMPAIGNS.md`, `tools/inventory.mjs`. Publishing from git (D-046): site project root set to `future-clips-site/` with its own `build.js`. Product prompt v2 in `docs/prompts/PRODUCT-2026-09-19.md` | publish commit |
| 2026-09-19 | Published from git: the site project deployed from `main` (the first build from the repo, not the bucket). The app's first attempt was refused because a Hobby account may only schedule daily crons, so `/api/cron/lanes` moved from every five minutes to daily; priority sets (and the demo) render in-request, batch sets wait for the tick until Vercel Pro or pg_cron (RUNBOOK "The poller on Hobby") | publish commit |
| 2026-09-19 | **Published.** Site live from git at www.thefutureclips.com (hero deck, fonts, headers, 404 all verified). App live at future-clips-app.vercel.app from the same repo, `/api/health` 503 with `db/engine/supabase: true` and every secret false (the engine now travels with the functions). Demo host `fc-demo-7byf1w5k97u.vercel.app` redirects to `/api/auth/demo`, which asks for the service-role key; the route 404s on the main host and `/api/auth/dev` 404s in production. Fixed on the way: the app project's install command still unpacked the retired tarball | `93decdc`, `400560a` |

| 2026-09-18 | Product: baseline | Scored every on-disk family against the references with side-by-side sheets | gym 66 · trading 59 · food 67 · supplements 58 · Grow with Alex 45 | $0 |
| 2026-09-18 | Product: 0 | apex-strength lats, current prompts | 73 | $0.47 |
| 2026-09-18 | Product: 1a | feed caption size ×1.4, outline held, bands at the reference position | 77 | $0 |
| 2026-09-18 | Product: 1b | de-slop grain 2.4/1.3 | 79 | $0 |
| 2026-09-18 | Product: 2 | tradelens apps ranked, current prompts (trading baseline) | 78 | $0.35 |
| 2026-09-18 | Product: rule | numbering direction (P-01) in the copy shape, rules, judge and toRenderable, with 5 new npm test checks | — | $0 |
| 2026-09-18 | Product: app | picker search and plain format words, HD/priority cost line, error sentences, no-plan state without free-tier words, Refer page hidden, mobile meter clip, mobile light buttons, focus ring; REASONS sentences | — | $0 |
| 2026-09-18 | Product: docs | QUALITY.md v1, PRODUCT.md v1, DECISIONS.md, ROADMAP.md; product branch + worktree | — | — |
| 2026-09-18 | Product: round 3, gym, F6 (behind parts never POV) | 84 vs set-08 | Claude $0.0746 + image $0.3953 |
| 2026-09-18 | Product: round 4, trading, one car across the set, pill at the reference size, tag lines repaired | 82 vs set-01; 85 after the $0 re-render (rank on the app slide, pill on every app) | Claude $0.0819 + image $0.2830 |
| 2026-09-18 | Product: `output/` arranged (README, `_attic/`, dated `gauntlet/` folders, `COSTS.md` rebuilt from `output/lanes`); `tools/_gauntlet.mjs` runner; two growithalex carousels saved to `reference/growithalex/ig/` | — | $0 |
| 2026-09-18 | Product: round 5, gym, cable row = row, mirror-from-behind | 86 vs set-08 | Claude $0.0912 + image $0.3446 |
| 2026-09-18 | Product: round 6, trading, no ratings on apps, mistakes on their kinds, pill on every app | 84 vs set-01; 86 after the $0 re-render (promised count numbers the apps) | Claude $0.1826 (two attempts) + image $0.2834 |
| 2026-09-18 | Product: round 7, gym lessons, ordinary face on the anchor; the model chose numbering up on its own (P-01 verified) | 87 vs set-08 | Claude $0.0691 + image $0.3951 |
| 2026-09-18 | Product: five growithalex carousels saved to `reference/growithalex/ig/` (43 slides, captions); the family's two page grammars written into QUALITY.md §3.4 | — | $0 |
| 2026-09-18 | Product: round 8, gym mistakes, object frames without the person, bedroom-mirror closer | 89 vs set-08 | Claude $0.0562 + image $0.3324 |
| 2026-09-18 | Product: round 9, trading, promised count numbers the apps, extras unnumbered, countdown repaired without a retry | 87 vs set-01 | Claude $0.1074 + image $0.2833 |
| 2026-09-18 | Product: round 10, gym rated back list, behind parts never in a mirror | 88 vs set-08 | Claude $0.0782 + image $0.3449 |
| 2026-09-18 | Product: round 11, trading, lifted reference lines rejected | 87 vs set-01 | Claude $0.0613 + image $0.2831 |
| 2026-09-18 | Product: rounds 12–25, one set per campaign (16 niches) on the owner's instruction; the all-niches sheet with per-slide costs | Product 3–7/10 per set, owner to score | Claude $1.323 + image $4.952 = $6.275 |
| 2026-09-18 | Product: rail rebuilt to the Grow with Alex grammar (P-08); editorial, pastel and clinical styles accept generated frames; `tools/_lane-costs.mjs` writes per-slide costs | rounds 12, 16, 17, 18 | $0 beyond the runs |

Spend: Engineering $0. Product 2026-09-18: $10.85 over 25 paid rounds (Claude $2.27 + image $8.58): $4.57 on the gauntlet under the $5 default, then $6.28 on one set per campaign at the owner's instruction; every run with its Claude and image dollars in `output/gauntlet/COSTS.md`.

## Requests: Product → Engineering

File here with the exact field, endpoint or bug, a repro and a screenshot path. Engineering answers with a status and a commit hash.

| # | Date | Request | Status | Answer |
|---|---|---|---|---|
| R1 | 2026-09-18 | **Dev sign-in**: `tools/dev-login.mjs email=<invited email>` that mints a session locally (service role `generateLink` + code exchange, or a cookie written for the running dev server) so the real `/app` can be tested without Supabase's mailer, which allows a few emails an hour for the whole project. Why: Every app finding this session is from the design preview (PRODUCT.md §6 says which); none is validated on the real app. | done by Engineering (`tools/dev-login.mjs`); still needs the service-role key locally | |
| R2 | 2026-09-18 | **`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`** (OWNER-ACTIONS E). Why: Without it nothing renders through the app locally; sets were generated through `tools/lane.mjs` instead. | blocked on owner (OWNER-ACTIONS 1) | |
| R3 | 2026-09-18 | **Instructions storage + API** (P-05): `sets.instructions jsonb` `{ logo_path, avatar_path, handle, note }`; org assets in the `assets` bucket under `<org>/logo.<ext>` and `<org>/avatar.<ext>` (png/jpg/webp ≤ 2 MB); `POST /api/assets` (multipart, returns the path), `DELETE /api/assets/:kind`; `GET /api/me` returns `defaults: { handle, logo_url, avatar_url }`; `POST /api/sets` accepts `instructions` (handle ≤ 30 chars `^@?[a-z0-9._]+$`, note ≤ 200 chars) and the worker passes it to `toRenderable` as `spec.instructions`. Product renders it in the styles. Why: The composer and the engine have nowhere to put a logo, an avatar, a handle or a note today. | open (spec in PRODUCT.md §3) | |
| R4 | 2026-09-18 | `GET /api/sets/:id` should return `content_json` (audit bug 14). Why: The drawer shows no "Text on the slide" for a set finished while the page was open. | done (E4) | |
| R5 | 2026-09-18 | A batch set waiting on a provider batch needs a stage the UI can show (audit bug 15): keep `stage` on the row while `status = queued` after the first tick, or add `waiting_on: 'copy' \| 'anchor' \| 'frames'`. Why: The card shows "In the queue" for hours with no step lit. | done (D-023) | |
| R6 | 2026-09-18 | `tools/rerender.mjs dir=<set folder>` (or `lane=priority`) so a lane output can be re-rendered for $0 without copying it to `output/sets/<campaign>-<style>`. Why: Rounds 1a/1b used a scratch script for this. | open; Product uses `tools/_rerender-dir.mjs` meanwhile | |
| R7 | 2026-09-18 | Free-tier removals outside Product's files: the site's Free card and copy, `lib/demo.ts` free plan fixture, the `free` welcome-balance path in migration 0006 / `fc_reserve_set`, the Refund Policy sentence (owner). Why: D-002. | site and DB done (D-020, 0010); `lib/demo.ts` free fixture and the Refund Policy sentence remain | |
| R8 | 2026-09-18 | Every API error carries a `code` (the create route already does for FC_*); `sign in required` on a 401 should come with `code: 'AUTH'`. Why: The composer showed the raw string "sign in required" as the error (preview, PRODUCT.md finding 8); Product maps codes to sentences. | open | |
| R9 | 2026-09-18 | Campaign payload for the picker: keep `guidance.angles`, add `assets.app_icon` / `app_screen` presence flags and `content.style`. Why: The picker will show "shows an app icon" and a plain-English format word instead of "photo feed". | open | |
| R10 | 2026-09-18 | Owner environment: sign in to the Claude in Chrome extension on this machine so the Instagram reference pass can page through full posts (list_connected_browsers returned none). Why: The owner asked for the growithalex posts to be read in Chrome; only the public grid was reachable. | done: the owner imported Instagram cookies 2026-09-18; the in-app browser is signed in | |
| R11 | 2026-09-18 | Persist per-call provider cost in the lane checkpoint: `s.copy.entries` (label, in, out, usd) from `engine/providers/claude.mjs` and `s.art.entries` (label, out, usd) from `engine/providers/image.mjs`, in both lanes (the batch collectors know the per-line usage too). Why: the owner wants the Claude and image cost per slide for every set; today `tools/_lane-costs.mjs` (scratch, priority only) reads the in-process ledgers after the run. | open | |
| R13 | 2026-09-18 | **App Store card fields on the campaign** (P-17): `assets.app_store { title, subtitle, developer, rating, ratings, age, category, theme }` in the ingest shape and the admin campaign form, plus `assets.app_icon` (png/jpg ≤ 1 MB, square) uploaded to the assets bucket and passed to the engine as a path. Why: the feed style draws the App Store card from these; without them it falls back to the brand name, the product line and a monogram tile. | open | |
| R12 | 2026-09-18 | The single-image format (P-12, PRODUCT.md §2.7): `sets.format text default 'slideshow'` (`slideshow` \| `single`), `fc_reserve_set` accepts `p_min = p_max = 1` when the format is `single`, the worker passes `format` to `engine/lanes.mjs newState`, the download zip is `image.png` + `post.txt`. Product writes the copy shape and the frame. | open | |

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
| 2026-09-19 | `app/app/Dashboard.tsx` (Product) | the demo composer: one preset "Demo · 4 slides", priority locked on, the demo's cost line, and `<CleanSeal />` under the caption on every finished set; `ViewerLite` gains `demoSlides?` | demo commit |
| 2026-09-19 | `app/layout.tsx` (grey) | imports `app/clean-seal.css` | demo commit |
