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
| `0010_no_free_tier_site_pricing.sql` | `no_free_tier_site_pricing` (2026-09-18) | yes | prices 16/32/79, allowances 200/500/1,500, priority 50/150 and HD ×3 (D-012 default), packs, `plans.label`, `welcome_slides = 0`, the `free` row is "No plan", `orgs.slide_balance`, `sets.from_balance`, balance-aware gate functions, `fc_credit_pack`, advisor fixes (duplicate index, seven FK indexes, `members_owner_remove`) |

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
| `sets` | one row per generation: ask, range, lane, quality, `status`, `stage`, `state_json` (lane state), `files_json`, `content_json`, `compliance_json`, `cost_*`, `from_balance`, `cancel_requested` | `fc_reserve_set` (insert), the worker (state), `fc_commit_set` / `fc_release_set` | members; members may UPDATE only `cancel_requested` on `queued` rows (`sets_member_update_guard`) |
| `usage` | per org per period counters and `reserved_usd`, `cogs_usd` | the gate functions | members |
| `spend_ledger` | `reserve | commit | release` rows per set | the gate functions | members |
| `packs` | the slide packs on sale: `p100` 100/$8, `p250` 250/$18, `p600` 600/$40 | migrations, later Dodo | any signed-in user |
| `signups` | the old waitlist (3 rows); no code reads or writes it | – | nobody (anon insert policy dropped in 0009) |
| `creators`, `brand_kits`, `pairing_history`, `jobs` | schema for own-creator, brand lock, pairing rotation, a generic queue; unused by code | – | own org (jobs: no policies) |

Live plan rows after 0010 (2026-09-18): `free` "No plan", 0 slides; `solo` "Clipper" $16, 200 slides; `grind` "Pro" $32, 500 slides + 50 priority, HD included (an HD slide draws 3), 1 seat; `agency` "Studio" $79, 1,500 slides + 150 priority, HD included, 5 seats. `packs`: p100 $8, p250 $18, p600 $40. `orgs.slide_balance` holds purchased slides (spent after the allowance, never expire); `sets.from_balance` records how many a set drew from it.

## Functions

| Function | Security | Callable by | Purpose |
|---|---|---|---|
| `my_org_ids()`, `is_org_owner(uuid)`, `is_platform_owner()` | definer | authenticated | policy helpers |
| `fc_reserve_set(p_org, p_campaign, p_ask, p_style, p_min, p_max, p_lane, p_hd, p_creator, p_look) → uuid` | definer | authenticated (checks membership itself) | the quota gate: campaign live, plan has the lane, allowance, HD, spend cap; inserts the set, updates `usage`, writes `spend_ledger reserve` |
| `fc_commit_set(p_set, p_made, p_cost, p_caption, p_files, p_content, p_compliance, p_cost_json, p_storage_prefix)` | definer | service role | charge slides made, give back the rest, record real cost |
| `fc_release_set(p_set, p_error, p_cost)` | definer | service role | fail the set, return every reserved slide, record partial cost |
| `fc_period_start(uuid)`, `fc_reserve_rate(lane, hd)` | definer / invoker | service role | billing period; $0.03 batch, $0.06 priority, ×3 HD |
| `fc_credit_pack(p_org, p_pack, p_note) → integer` | definer | service role (the webhook; the admin by hand) | adds a pack's slides to `orgs.slide_balance`, ledger `credit` |
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

After 0010: `jobs` has RLS with no policies (INFO, dormant table); the four SECURITY DEFINER helpers are callable by `authenticated` (by design); leaked-password protection is off (owner, Auth settings); multiple permissive policies on `campaigns` and `brand_kits` (cosmetic). Fixed in 0010: the seven unindexed foreign keys, the duplicate `sets` index, `members_owner_remove`.

## Still to come

`billing_events` (0007) with the Dodo work; `sets.instructions jsonb` and a private per-org uploads bucket with the instructions feature (M4); an admin "set plan" path (service role) for D-011; the dormant tables and buckets decision (D-017 and the list above). If the owner changes D-012 or D-013, the plan rows are one `update` each.
