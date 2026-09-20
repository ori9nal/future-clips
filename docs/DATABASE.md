# Database

Engineering owns this file. Supabase project `clipcarousel` (`waipwmyncpsgoglmkhdz`, us-east-1, Free tier, Postgres 17). Every table has RLS on. Money and quota move only through `SECURITY DEFINER` functions the service role calls. Files under `supabase/migrations/` are the record; the "applied" column below is the truth about the live database.

## Migration state (2026-09-20, after 0029)

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
| `0007_billing_events.sql` | `billing_events` (2026-09-18) | yes | the webhook's idempotency table and `billing_status = 'expired'`; applied ahead of the Dodo connection, with `revoke all … from anon` added |
| `0008_partner_accounts.sql` | – | **no** | dormant feature |
| `0009_m0_security_hardening.sql` | `m0_security_hardening` (2026-09-18) | yes | S2, S5, S6, S7 from the audit |
| `0010_no_free_tier_site_pricing.sql` | `no_free_tier_site_pricing` (2026-09-18) | yes | prices 16/32/79, allowances 200/500/1,500, priority 50/150 and HD ×3 (D-012 default), packs, `plans.label`, `welcome_slides = 0`, the `free` row is "No plan", `orgs.slide_balance`, `sets.from_balance`, balance-aware gate functions, `fc_credit_pack`, advisor fixes (duplicate index, seven FK indexes, `members_owner_remove`) |
| `0011_rate_limits.sql` | `rate_limits` (2026-09-18) | yes | `rate_limits` table and `fc_rate_limit(key, limit, window_s)` (service role only); the sign-in routes call it with hashed keys |
| `0012_provider_fund.sql` | `provider_fund` (2026-09-18) | yes | `fund_ledger`, `app_settings.provider_reserve` (share 0.35), `fc_record_sale` (service role), `fc_fund_summary` (platform owner, checked inside) |
| `0013_demo_workspace.sql` | `demo_workspace` (2026-09-18) | yes | `orgs.is_demo`, the shared demo org (Clipper, 500 seats), `fc_demo_org_id()`, platform owners may read demo orgs, `orgs_protect_billing` also guards `is_demo` |
| `0014_dev_accounts.sql` | `dev_accounts` (2026-09-19) | yes | "Product test workspace" (`grind`, 5 seats, $10 cap) and invite rows for `demo@` and `tester@thefutureclips.com` |
| `0015_demo_generation.sql` | `demo_generation` (2026-09-19) | yes | `fc_reserve_set` reads the org first and accepts a 4-slide range for demo orgs (5 for everyone else), skips the priority allowance for demo orgs; demo org `spend_cap_usd` 15 |
| `0017_rate_limit_peek.sql` | `rate_limit_peek` (2026-09-19) | yes | `fc_rate_limit_peek(key, limit, window_s)` reads a limiter without spending a slot (R16); service role only |
| `0018_allowances_at_margin.sql` | `allowances_at_margin` (2026-09-19) | yes | D-044 applied: Clipper 200, Pro 400 + 50, Studio 1,000 + 100, `cogs_allowance_usd` recomputed |
| `0019_monthly_and_yearly_prices.sql` | `monthly_and_yearly_prices` (2026-09-19) | yes | `plans.price_usd_year`; monthly 19.99/49.99/99.99, yearly 192/384/948 (D-048) |
| `0016_demo_slides_floor.sql` | `demo_slides_floor` (2026-09-19) | yes | `sets.slides_min/max` checks accept 4 for the demo's short sets |
| `0020_creator_assets.sql` | `creator_assets` (2026-09-19) | yes | `sets.instructions`, the private `uploads` bucket, `fc_reserve_set(... p_instructions)` |
| `0021_provider_split.sql` | `provider_split` (2026-09-19) | yes | the provider fund split between Anthropic and OpenAI by measured burn; `app_settings.provider_float` |
| `0022_admin_devices.sql` | `admin_devices` (2026-09-19) | yes | `admin_unlocks` (superseded by 0025's code gate; the sessions table stays) |
| `0023_campaign_samples.sql` | `campaign_samples` (2026-09-19) | yes | `sets.is_sample`, `campaigns.sample`, `fc_queue_sample` (platform owner), the public `samples` bucket |
| `0024_invite_carries_a_plan.sql` | `invite_carries_a_plan` (2026-09-19) | yes | `allowed_emails.personal_plan`; **its `handle_new_user` referenced 0008's unapplied columns and broke every sign-up until 0028** |
| `0025_admin_totp.sql` | `admin_totp`, `admin_totp_reset` (2026-09-19) | yes | the admin code gate: `admin_totp`, `fc_totp_reset` |
| `0026_demo_budget.sql` | `demo_budget`, `demo_budget_gate`, `reserve_set_one_signature` (2026-09-19) | yes | `app_settings.demo_budget` (a fixed number of carousels from a moment), `fc_demo_budget(org)`, the gate in `fc_reserve_set` under the org lock; the ambiguous ten-argument `fc_reserve_set` overload dropped |
| `0027_slide_text_is_editable.sql` | `slide_text_is_editable` (2026-09-19) | yes | `sets.layout_json` (the renderer's text blocks, the baseline), `sets.edits_json` (the member's moves and rewrites), `sets.edited_at` |
| `0028_bootstrap_without_partner_columns.sql` | `bootstrap_without_partner_columns` (2026-09-20) | yes | `handle_new_user` names only columns that exist; `app_settings.signup` set to `open` (D-011 superseded) |
| `0029_fixture_briefs_belong_to_the_demo.sql` | `fixture_briefs_belong_to_the_demo` (2026-09-20) | yes | the 16 fixture briefs moved to the demo workspace, the 5 legacy `campaign`-kind fixtures deleted; platform owners read and write every brief (`campaigns_read`, `campaigns_platform_write`) (D-050) |

File numbers are not the apply order. Apply through the Supabase MCP `apply_migration` (or the CLI once logged in), then run `get_advisors` (security and performance), then update this table.

## Tables (public)

| Table | Purpose | Written by | Read by (RLS) |
|---|---|---|---|
| `plans` | one row per tier: `price_usd_month`, `slides_per_month`, `priority_slides_per_month`, `hd_per_slide_usd` (null = not offered), `seats`, feature flags, extras, `cogs_allowance_usd` | migrations | any signed-in user; `anon` may SELECT (keepalive/health, RLS returns no rows) |
| `orgs` | workspaces: `plan`, `seat_limit`, `is_platform` (one row), `is_demo` (the shared demo, 0013), billing ids and status, `current_period_*`, `spend_cap_usd` | `handle_new_user`, the billing webhook (service role), owner rename | members of the org |
| `members` | `(org_id, user_id, role owner|member)` | `handle_new_user`; owner may remove others | members |
| `app_settings` | `signup {mode: invite|open}`, `keepalive {at}`, `provider_reserve {share}` | platform owner, keepalive | platform owner |
| `allowed_emails` | the invite list (citext), optional org and role | platform owner, org owners | same |
| `campaigns` | `id` slug, `org_id` (null = platform-wide), `kind spec|campaign`, `data` jsonb, `status live|paused|closed`, `art_mode`, `photo_dir_available`, `brief_hash` | platform owner (ingest, admin), org owners | platform rows to every signed-in user, own rows to members |
| `sets` | one row per generation: ask, range, lane, quality, `status`, `stage`, `state_json` (lane state), `files_json`, `content_json`, `compliance_json`, `cost_*`, `from_balance`, `cancel_requested` | `fc_reserve_set` (insert), the worker (state), `fc_commit_set` / `fc_release_set` | members; members may UPDATE only `cancel_requested` on `queued` rows (`sets_member_update_guard`) |
| `usage` | per org per period counters and `reserved_usd`, `cogs_usd` | the gate functions | members |
| `spend_ledger` | `reserve | commit | release` rows per set | the gate functions | members |
| `packs` | the slide packs on sale: `p100` 100/$8, `p250` 250/$18, `p600` 600/$40 | migrations, later Dodo | any signed-in user |
| `billing_events` | one row per Dodo webhook delivery (`id` = the `webhook-id` header), payload and outcome; a redelivery is answered as a duplicate | the webhook (service role) | platform owner |
| `fund_ledger` | one row per paid Dodo invoice: gross, the share earmarked for the model providers, the share used | `fc_record_sale` (service role, from the webhook) | platform owner |
| `rate_limits` | fixed-window counters keyed by a sha256 of an IP or email (never the plain value) | `fc_rate_limit` (service role) | nobody |
| `signups` | the old waitlist (3 rows); no code reads or writes it | – | nobody (anon insert policy dropped in 0009) |
| `creators`, `brand_kits`, `pairing_history`, `jobs` | schema for own-creator, brand lock, pairing rotation, a generic queue; unused by code | – | own org (jobs: no policies) |

Live plan rows after 0018 (2026-09-19): `free` "No plan", 0 slides; `solo` "Clipper" $19.99 monthly / $192 a year, 200 slides; `grind` "Pro" $49.99 monthly / $384 a year, 400 slides + 50 priority, HD included (an HD slide draws 3), 1 seat; `agency` "Studio" $99.99 monthly / $948 a year, 1,000 slides + 100 priority, HD included, 5 seats (D-044). `packs`: p100 $8, p250 $18, p600 $40. `orgs.slide_balance` holds purchased slides (spent after the allowance, never expire); `sets.from_balance` records how many a set drew from it.

## Functions

| Function | Security | Callable by | Purpose |
|---|---|---|---|
| `my_org_ids()`, `is_org_owner(uuid)`, `is_platform_owner()` | definer | authenticated | policy helpers |
| `fc_reserve_set(p_org, p_campaign, p_ask, p_style, p_min, p_max, p_lane, p_hd, p_creator, p_look) → uuid` | definer | authenticated (checks membership itself) | the quota gate: campaign live, plan has the lane, allowance, HD, spend cap; inserts the set, updates `usage`, writes `spend_ledger reserve` |
| `fc_commit_set(p_set, p_made, p_cost, p_caption, p_files, p_content, p_compliance, p_cost_json, p_storage_prefix)` | definer | service role | charge slides made, give back the rest, record real cost |
| `fc_release_set(p_set, p_error, p_cost)` | definer | service role | fail the set, return every reserved slide, record partial cost |
| `fc_period_start(uuid)`, `fc_reserve_rate(lane, hd)` | definer / invoker | service role | billing period; $0.03 batch, $0.06 priority, ×3 HD |
| `fc_credit_pack(p_org, p_pack, p_note) → integer` | definer | service role (the webhook; the admin by hand) | adds a pack's slides to `orgs.slide_balance`, ledger `credit` |
| `fc_rate_limit_peek(p_key, p_limit, p_window_s) → integer` | definer | service role | how many are left on a limiter, without spending one (R16) |
| `fc_rate_limit(p_key, p_limit, p_window_s) → boolean` | definer | service role | true while the key is under the limit in the window; `lib/ratelimit.ts` hashes the key first; a laptop without the service role has no limiter |
| `fc_record_sale(p_org, p_payment_id, p_sku, p_gross_usd, p_note) → numeric` | definer | service role | earmarks `gross × provider_reserve.share` in `fund_ledger`; a repeat payment id is ignored |
| `fc_demo_org_id() → uuid` | definer, stable | authenticated | the demo workspace's id, for the admin's invite form |
| `fc_fund_summary()` | definer (checks `is_platform_owner()` inside) | authenticated | gross, earmarked, consumed (`spend_ledger` commits), balance, sales, share |
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

After 0012: `jobs`, `signups` and `rate_limits` have RLS with no policies (INFO: nobody but the service role should read them); `fc_fund_summary` joins the SECURITY DEFINER list callable by `authenticated` (it checks `is_platform_owner()` inside); the four SECURITY DEFINER helpers are callable by `authenticated` (by design); leaked-password protection is off (owner, Auth settings); multiple permissive policies on `campaigns` and `brand_kits` (cosmetic). Fixed in 0010: the seven unindexed foreign keys, the duplicate `sets` index, `members_owner_remove`.

## Still to come

`sets.instructions jsonb` and a private per-org uploads bucket with the instructions feature (M4); an admin "set plan" path (service role) for D-011; the dormant tables and buckets decision (D-017 and the list above). If the owner changes D-012 or D-013, the plan rows are one `update` each.
