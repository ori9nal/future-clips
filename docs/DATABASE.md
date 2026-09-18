# Database

Engineering owns this file. Supabase project `clipcarousel` (`waipwmyncpsgoglmkhdz`, us-east-1, Free tier, Postgres 17). Every table has RLS on. Money and quota move only through `SECURITY DEFINER` functions the service role calls. Files under `supabase/migrations/` are the record; the "applied" column below is the truth about the live database.

## Migration state (2026-09-18)

| File | Remote migration name(s) | Applied | Notes |
|---|---|---|---|
| – | `create_signups_table` (2026-08-25), `create_public_assets_bucket`, `allow_html_in_site_bucket` (2026-08-29) | yes | pre-product; no local file |
| `0001_product_schema.sql` | `product_tables`, `product_policies`, `product_guards`, `product_auth_hooks`, `product_seed_and_buckets` (2026-09-11) | yes | |
| `0002_product_hardening.sql` | `product_hardening` | yes | |
| `0003_plans_in_slides.sql` | `plans_in_slides` | yes | allowances metered in slides |
| – | `assets_platform_write` (2026-09-11) | yes | storage policies for bucket `assets`; no local file |
| `0004_lanes_and_quota.sql` | `lanes_and_quota_a` … `_g` (2026-09-12) | yes | lanes, ranges, gate functions, spend cap, cancel |
| `0005_agency_referrals.sql` | – | **no** | dormant feature (D-001); decision on applying it as dormant schema is open |
| `0006_plans_match_the_site.sql` | – | **no** | superseded: it assumes a free welcome balance and references 0005's columns inside `orgs_protect_billing`; replaced by the planned `0010` |
| `0007_billing_events.sql` | – | **no** | applied with the Dodo work (M5) |
| `0008_partner_accounts.sql` | – | **no** | dormant feature |
| `0009_m0_security_hardening.sql` | `m0_security_hardening` (2026-09-18) | yes | S2, S5, S6, S7 from the audit |
| `0010_no_free_tier_site_pricing.sql` | – | planned (M2) | prices 16/32/79, allowances 200/500/1500, packs, labels, `welcome_slides = 0`, `free` row = "no plan"; priority and HD numbers per `docs/DECISIONS.md` |

File numbers are not the apply order. Apply through the Supabase MCP `apply_migration` (or the CLI once logged in), then run `get_advisors` (security and performance), then update this table.

## Tables (public)

| Table | Purpose | Written by | Read by (RLS) |
|---|---|---|---|
| `plans` | one row per tier: `price_usd_month`, `slides_per_month`, `priority_slides_per_month`, `hd_per_slide_usd` (null = not offered), `seats`, feature flags, extras, `cogs_allowance_usd` | migrations | any signed-in user; `anon` may SELECT (keepalive/health, RLS returns no rows) |
| `orgs` | workspaces: `plan`, `seat_limit`, `is_platform` (one row), billing ids and status, `current_period_*`, `spend_cap_usd` | `handle_new_user`, the billing webhook (service role), owner rename | members of the org |
| `members` | `(org_id, user_id, role owner|member)` | `handle_new_user`; owner may remove others | members |
| `app_settings` | `signup {mode: invite|open}`, `keepalive {at}` | platform owner, keepalive | platform owner |
| `allowed_emails` | the invite list (citext), optional org and role | platform owner, org owners | same |
| `campaigns` | `id` slug, `org_id` (null = platform-wide), `kind spec|campaign`, `data` jsonb, `status live|paused|closed`, `art_mode`, `photo_dir_available`, `brief_hash` | platform owner (ingest, admin), org owners | platform rows to every signed-in user, own rows to members |
| `sets` | one row per generation: ask, range, lane, quality, `status`, `stage`, `state_json` (lane state), `files_json`, `content_json`, `compliance_json`, `cost_*`, `cancel_requested` | `fc_reserve_set` (insert), the worker (state), `fc_commit_set` / `fc_release_set` | members; members may UPDATE only `cancel_requested` on `queued` rows (`sets_member_update_guard`) |
| `usage` | per org per period counters and `reserved_usd`, `cogs_usd` | the gate functions | members |
| `spend_ledger` | `reserve | commit | release` rows per set | the gate functions | members |
| `signups` | the old waitlist (3 rows); no code reads or writes it | – | nobody (anon insert policy dropped in 0009) |
| `creators`, `brand_kits`, `pairing_history`, `jobs` | schema for own-creator, brand lock, pairing rotation, a generic queue; unused by code | – | own org (jobs: no policies) |

Live plan rows (2026-09-18): `free` 0 slides; `solo` $19, 350 slides; `grind` $59, 840 + 84 priority, HD $0.35; `agency` $249, 4,200 + 350 priority, HD $0.30, 10 seats. These are the 0003 numbers and do not match the site; `0010` reconciles them.

## Functions

| Function | Security | Callable by | Purpose |
|---|---|---|---|
| `my_org_ids()`, `is_org_owner(uuid)`, `is_platform_owner()` | definer | authenticated | policy helpers |
| `fc_reserve_set(p_org, p_campaign, p_ask, p_style, p_min, p_max, p_lane, p_hd, p_creator, p_look) → uuid` | definer | authenticated (checks membership itself) | the quota gate: campaign live, plan has the lane, allowance, HD, spend cap; inserts the set, updates `usage`, writes `spend_ledger reserve` |
| `fc_commit_set(p_set, p_made, p_cost, p_caption, p_files, p_content, p_compliance, p_cost_json, p_storage_prefix)` | definer | service role | charge slides made, give back the rest, record real cost |
| `fc_release_set(p_set, p_error, p_cost)` | definer | service role | fail the set, return every reserved slide, record partial cost |
| `fc_period_start(uuid)`, `fc_reserve_rate(lane, hd)` | definer / invoker | service role | billing period; $0.03 batch, $0.06 priority, ×3 HD |
| `gate_new_user()`, `handle_new_user()` | definer | trigger only | invite-only sign-up; personal org + owner membership + invited memberships |
| `invites_respect_seats()`, `orgs_protect_billing()`, `sets_member_update_guard()` | trigger only | – | seat limit on invites; members cannot change plan/billing fields; members may change only `cancel_requested` on a set (generic row comparison since 0009) |

## Triggers

`auth.users`: `fc_gate_new_user` BEFORE INSERT, `fc_handle_new_user` AFTER INSERT. `allowed_emails`: `invites_respect_seats` BEFORE INSERT. `orgs`: `orgs_protect_billing` BEFORE UPDATE. `sets`: `sets_member_update_guard` BEFORE UPDATE.

## Grants (after 0009)

`anon`: SELECT on `plans` only; nothing else on public tables or sequences; default privileges no longer hand new tables, sequences or functions to `anon`. `authenticated`: the default DML grants minus TRUNCATE, REFERENCES and TRIGGER; RLS decides rows. Function EXECUTE is granted by name (see 0004 and 0009). Keep it that way: a new function gets an explicit grant.

## Storage

| Bucket | Public | Policies | Contents |
|---|---|---|---|
| `site` | read | public read only (anon insert dropped in 0009) | the static site's deploy objects (`index-vN.html`, `legal-v1/*`, images) until the site deploys from git |
| `assets` | read | platform owner insert/update/delete | brand logos (`brand/<id>/logo.*`); empty |
| `free-sets` | read | public read | unused (no free tier) |
| `sets` | no | members read `<org>/…` of their orgs; service role writes | rendered slides and `post.json` per set; empty until hosted rendering runs |
| `cache` | no | service role only | content-addressed frames; empty |
| `anchors` | no | service role only | unused |

## Advisors (2026-09-18)

Open: `jobs` has RLS with no policies (INFO); the four SECURITY DEFINER helpers are callable by `authenticated` (by design); leaked-password protection is off (owner, Auth settings); seven unindexed foreign keys, the duplicate index pair `sets_org_created` = `sets_org_recent_idx`, `members_owner_remove` re-evaluating `auth.uid()` per row, multiple permissive policies on `campaigns` and `brand_kits`. These go into `0010` or a `0011_advisor_fixes`.

## Reconciliation plan (`0010`, milestone M2)

Prices 16/32/79 and allowances 200/500/1,500 (the site's figures; note the site shows them under a yearly toggle with $20/$39/$99 monthly, D-013); packs 100/$8, 250/$18, 600/$40 in a `packs` table with `orgs.slide_balance` and `sets.from_balance` as 0006 designed; `plans.label` and `welcome_slides` with every welcome balance 0 (no free tier); the `free` row relabelled "No plan"; priority 50/150 and HD ×3 unless `docs/DECISIONS.md` says otherwise; the `fc_reserve_set` / `fc_commit_set` / `fc_release_set` balance logic from 0006; `orgs_protect_billing` rewritten without the referral columns unless 0005 is applied first; `billing_events` from 0007 when Dodo goes live; advisor fixes. `sets.instructions jsonb` and a private per-org uploads bucket come with the instructions feature (M4).
