# API

Engineering owns this file. Every route runs behind `middleware.ts` unless listed as public; a request without a session gets `401 {"error":"sign in required"}` on `/api/*` and a redirect to `/login?next=` on pages. Errors are JSON `{ error, code?, detail? }`.

## Routes

| Route | Method | Who | Does | Needs on the host |
|---|---|---|---|---|
| `/api/health` | GET | public | readiness: `{ ok, ready: { db, engine, supabase, serviceRole, anthropic, openai, cronSecret, dodo }, dbStatus, host, commit, at }`; 200 when a rendering host is fully configured, 503 otherwise; booleans only | – |
| `/api/keepalive` | GET | public (bearer `CRON_SECRET` if set) | one anon read to keep the Free project awake; stamps `app_settings.keepalive` with the service role | – |
| `/api/me` | GET | member | `{ account: { plan, usage, periodEnd, left, cap, balance, packs }, org: { id, name, plan } }` | – |
| `/api/sets` | GET | member | `{ sets: SetRow[] }`, the org's newest 50 | – |
| `/api/sets` | POST | member (30 per user per 10 min) | body `{ campaign, ask, style?, slides: n | {min,max}, lane: "batch"|"priority", hd? }`; validates, calls `fc_reserve_set`, starts the priority worker in `after()`; `201 { id, lane, started }`; refusals `402` (`FC_QUOTA`, `FC_SPEND_CAP`, `FC_NO_PLAN`, `FC_NO_HD`), `403` (`FC_NOT_MEMBER`), `400` otherwise | engine + service role to start |
| `/api/sets/[id]` | GET | member (RLS) | `{ set: SetRow, label, slides: signedUrl[] }`; the row includes `content_json` and `compliance_json.clean = { frames, slides, stripped: [{ chunk, what, count }], verified }` (what the metadata gate removed from the provider frames and that the shipped slides are pixels only); signed URLs last one hour | – |
| `/api/sets/[id]` | DELETE | member (RLS) | cancel a `queued` set: `{ cancelled, released }`; `409 { cancelled: false }` once it started; released immediately when the host has the service role | service role optional |
| `/api/sets/[id]/download` | GET | member (storage policy) | a store-only zip of `slide-N.png` plus `post.txt`; `409` until done | – |
| `/api/cron/lanes` | GET, POST | bearer `CRON_SECRET` (refuses when unset) | one worker tick over every open, unlocked set (240 s budget): `{ ticks: [{ id, before, after, ok, note }], skipped, ms }` | engine + service role |
| `/api/specs` | GET | member | `{ campaigns: Spec[] }` visible under RLS | – |
| `/api/specs` | POST | platform owner | upsert a spec (`{ campaign }`) | – |
| `/api/ingest` | POST | platform owner | `{ brief, save? }` → `{ spec, usd, saved }` via Claude | engine + Anthropic key |
| `/api/styles` | GET | member | `?niche=` → `{ niche, styles: [{ id, label, blurb, canvas, fit }] }` | engine |
| `/api/studio/render` | POST | platform owner | `{ campaignId, style? }` → `{ style, canvas, ms, logic, slides: "/api/file/..." }`; renders stored copy into `workDirs().studioDir` | engine; laptop or a single function instance |
| `/api/character` | POST | platform owner | `{ campaignId, quality?, variants? }` → character sheets under `workDirs().cacheDir` | engine + OpenAI key |
| `/api/file/[...path]` | GET | member (dev preview: no session) | a file under `workDirs().base` on this host, resolved inside it; `private, no-store` | laptop use; on Vercel `/tmp` is per instance |
| `/api/billing/checkout` | POST | org owner (same-origin `Origin` only) | `{ plan, yearly? } | { pack }` → `{ url }` (Dodo hosted checkout); `503` until `DODO_API_KEY` is set | Dodo env |
| `/api/billing/portal` | POST | member (same-origin) | `{ url }` for Dodo's customer portal; `404` without a subscription | Dodo env |
| `/api/webhooks/dodo` | POST | Dodo (Standard Webhooks signature, 5 min tolerance; checked before anything else) | applies subscription events (`active`/`renewed`/`plan_changed` → plan, `cancelled`, `paused`, `on_hold`/`failed` → past_due, `expired` → No plan), records every `payment.succeeded` in the provider fund (`fc_record_sale`) and gives the share back on `refund.succeeded`; idempotent on `webhook-id` (`billing_events`, a duplicate is `{ ok, duplicate }`, any other write failure is 500 so Dodo retries); `metadata.org_id` must be a uuid; the referral commission call only with `FC_REFERRALS=1` | service role, `DODO_WEBHOOK_SECRET` |
| `/api/partner/payout` | POST | org owner | payout details (dormant feature; needs migration 0008) | – |
| `/api/auth/otp` | POST | public (same-origin `Origin` only) | `{ email, next? }` → asks Supabase for the magic link from the server; writes the PKCE verifier cookie and `fc_next`; `403` invite refused, `429` after 10 requests per address per 10 min or 5 per email per hour (hashed keys, migration 0011) or the mailer's own limit, `400` otherwise; `{ ok: true }` | service role for the limiter (else unlimited) |
| `/api/auth/google` | POST | public (same-origin) | `{ next? }` → `{ url }` to send the browser to Google; `429` after 20 per address per 10 min; `404` unless `NEXT_PUBLIC_GOOGLE_AUTH=1` | Google OAuth client |
| `/api/auth/verify` | POST | public (same-origin) | `{ email, token, next? }` → verifies the 6-digit code from the sign-in email on the server (`verifyOtp`, type `email`), sets the session cookies, `{ ok, next }`; works on any device; `429` after 10 per address per 10 min or 6 per email per 15 min | service role for the limiter |
| `/api/auth/demo` | GET | the demo host only (`FC_DEMO_HOSTNAME`; 404 elsewhere) | signs the visitor in as the demo account (service role mints a one-time token; the dev password on a laptop) and redirects to `/app`; 20 per address per 10 min | service role |
| `/api/auth/dev` | POST | laptops only (`FC_DEV_LOGIN=1`, never production: 404) | `{ who: "demo" | "tester", next? }` → password sign-in as one of the two local test accounts (`tools/dev-users.mjs`), cookies set, `{ ok, next }` | `FC_DEV_PASSWORD` |
| `/auth/callback` | GET | public | `?code=` (the PKCE code from the emailed link or Google; the verifier cookie was written by `/api/auth/*`) or `?token_hash=&type=` (a server-verified token: Supabase's server-side template shape, and what `tools/dev-login.mjs` mints) → session cookie, referral claim, redirect to `next` (same-host paths only) | – |
| `/auth/signout` | POST | public | signs out, 303 to `/login` | – |

**Demo workspace (0013, 0015)**: when `viewer.org.is_demo`, `/app`, `/api/me`, `/api/specs` and the `demo-*` ids answer from `lib/demo-manifest.ts` and `public/demo/**`. With `FC_DEMO_GENERATE=1` a demo member may POST `/api/sets`: the body's slides, lane and HD are replaced by exactly 4 slides on the priority lane, limited to 3 per visitor address per day and 40 a day overall (`FC_DEMO_LIMIT`, 429), and the resulting rows are real sets (Storage, signed URLs, download) listed before the examples for that user. Without the flag, POST answers `FC_DEMO` (402).

Server actions in `app/admin/actions.ts` (platform owner, re-checked inside each action, then RLS): brand-kit create/update/delete/logo, invites add/remove (access `customer`, `platform_owner` or `demo`), sign-up mode, brief pause/resume/delete, and the dormant referral settlement actions.

## `FC_*` codes (raised by the SQL gate, mapped to sentences in `lib/sets.ts`)

| Code | Raised by | Meaning | HTTP |
|---|---|---|---|
| `FC_NOT_MEMBER` | `fc_reserve_set` | caller is not a member of `p_org` | 403 |
| `FC_BAD_LANE`, `FC_BAD_RANGE` | `fc_reserve_set` | lane not batch/priority; range outside 5–10 (4–10 for the demo org) | 400 |
| `FC_NO_CAMPAIGN` | `fc_reserve_set` | campaign not live or not visible | 400 |
| `FC_NO_PLAN` | `fc_reserve_set` | the workspace has no plan (there is no free tier) | 402 |
| `FC_NO_HD` | `fc_reserve_set` | HD not on this plan | 402 |
| `FC_QUOTA` | `fc_reserve_set` | not enough slides this period (detail says how many) | 402 |
| `FC_SPEND_CAP` | `fc_reserve_set` | the org's spend cap would be passed | 402 |
| `FC_READ_ONLY` | `sets_member_update_guard` | a member changed anything but `cancel_requested` | – |
| `FC_NO_SET` | `fc_commit_set`, `fc_release_set` | unknown set id | – |
| `FC_INVITE_ONLY` | `gate_new_user` | email not on the invite list (sign-up refused) | – |
| `FC_NO_PACK`, `FC_FORBIDDEN` | `fc_credit_pack` | unknown pack; caller is not the service role | – |
| `FC_DEMO_LIMIT` | the app | the demo visitor's daily allowance (3) or the demo's (40) is used | 429 |
| `FC_DEMO` | the app (`lib/demo.ts`), not SQL | the caller's workspace is the demo: generation, cancel and checkout are refused; reads come from shipped fixtures | 402 (generate), 409 (cancel), 403 (checkout) |

Add codes; never rename one silently. New codes appear here and in `lib/sets.ts REASONS` (Product writes the sentence).

## Set row (`lib/sets.ts SetRow`)

`id, org_id, campaign_id, style, ask, slides, slides_min, slides_max, reserved_slides, quality, lane, hd, status (queued | rendering | done | failed), stage, caption, cost_usd, files_json, content_json, compliance_json, error, cancel_requested, created_at, started_at, finished_at, updated_at`. `status = queued` means nothing has been spent and cancel is open; `rendering` covers every stage from the first provider call to the commit, including waiting on a provider batch; `stage` carries the machine stage (`copy:submit … render`), `stageLabel()` turns it into words (Product's).

## Planned (see `docs/ROADMAP.md`)

`sets.instructions` (logo, avatar, handle, free text) with a private per-org uploads bucket and an upload route; an admin "set plan" action; an idea-generation endpoint if Product asks; Storage-backed studio output on hosts.
