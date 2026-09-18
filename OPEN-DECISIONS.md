> **SUPERSEDED (2026-09-18).** Kept for history only; facts below may be stale. Current truth: `docs/ARCHITECTURE.md`, `docs/ENGINE.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`.

# OPEN-DECISIONS.md

Decisions only the owner can make. Each entry says what was done in the
meantime so nothing is blocked on the answer. Newest at the bottom.

## 1. Agency referral share — not in the pricing table

The admin UI and the old marketing page both carried a "25% share" for agency
referral codes (`?ref=CODE` is still persisted to `signups.agency_code`). The
pricing table has no such row, so **it is not implemented**: an Agency-tier
customer pays $249/mo and gets 10 seats, and that is the whole relationship in
the code today.

**Decided by the owner, 2026-09-13:** a tiered commission on the subscriptions a
referring agency brings in — **20% under 200 referred accounts, up to 30%**.
Built as migration `0005_agency_referrals.sql` (codes on every org, `?ref=`
attribution on first sign-in, `commissions` ledger, `referral_tiers` 0→20% ·
200→25% · 500→30% — the 25% step is an assumption), the "Refer & earn" page in
the app and `/admin/partners`. Paid by hand from margin; never through the
payment provider (what Dodo was told). Still open: the site no longer carries a
partner section (the 09-13 page dropped it) — add one or leave it in-app.

## 2. View counter — removed, then restored at the owner's request

The hero badge rolls up to a pinned `1,304,895` views (`VIEWS_TARGET` in
`design/build_site.py`). Future Clips has no measured view figure: the example
carousels are other creators' posts shown with permission, and the product has
shipped no sets to a public account. A payment-provider reviewer may read the
counter as a claim about results.

**Timeline (2026-09-11):** removed in the pricing redeploy (badge said `5–10
slides per set`); the owner asked for it back the same day, so it is back as
it was (`index-v5.html`, `dpl_J1u43vodRCgvSjFVhrfLvy4QPzNg`).

**Decided by the owner:** keep the counter. **Still open:** what the number
means. If a reviewer asks, the honest answer today is "an aspirational figure".
The cheap fix, when there is one, is a label under the number that says what
it counts ("views on posts like these", "views reported by customers").

## 3. Marketing copy that contradicted the table — changed

Beyond the price cards, the page claimed "2 free slideshows", "Make two, then
decide", "About 2 minutes" per slideshow, and an FAQ promise that "unused
slideshows roll over for one month". None of those are in the table. Changed
to: free tier = one ready-made set per live campaign; queued ≈ 1 hour, instant
≈ 5 minutes; extras at $0.40 / $0.70; **no rollover**.

**Decide:** rollover is a real policy choice with a real cost (quota debt
carried into the next month). The page now says allowances reset on the
billing date. If you want rollover, say so and the quota gate will carry it.

## 4. Yearly pricing — set to 10× monthly

The table gives monthly prices only. The page had a yearly toggle with "2
months free", so yearly is Solo $190, Grind $590, Agency $2,490. Monthly is
the default view because that is what the table specifies.

**Decide:** keep the yearly option at 10× (or drop the toggle). Phase 5 creates
the annual products; it is one line to remove.

## 5. Allowances in slides, "priority" instead of "queued / instant" — decided by the owner

2026-09-12: the owner asked for the page to show slides, not sets, and to drop
the words "queued" and "instant". Done, and the database plans were re-metered
to match: **Solo 350 slides/mo, Grind 840 + 84 priority, Agency 4,200 + 350
priority**; extras $0.06 per slide / $0.10 per priority slide; HD +$0.35 per
slide on Grind, +$0.30 on Agency.

**How the numbers were derived:** the pricing table's set counts × 7, the
measured average set (and the number every per-set COGS figure was built on).
Per-slide COGS is $0.025 on the batch path and $0.05 realtime, so the monthly
COGS allowances are unchanged ($8.75 / $25.20 / $122.50). Metering per slide is
also *safer* than per set: 350 five-slide slideshows cost less to render than
50 ten-slide ones. Internally the two lanes are still `queued` and `instant`
(`sets.mode`); "priority" is the customer word only.

**Still open:** × 7 means a customer who always makes 10-slide slideshows
gets 35 of them on Solo, not the table's 50. The alternative (× 10 = 500
slides) drops Solo to ~37% gross at full quota. Say if you want the higher
number and the margin hit that comes with it.


## 6. The legal pages promise things the product does not do yet — published as written

2026-09-12: the five Trust and Legal pages are live on both hosts, verbatim
from the owner's document. Three clauses do not match the pricing table or
the code today:

- **Refund Policy §1:** "New accounts receive 2 free Slides so you can try
  the Services before purchase." The Free tier in the table (and in the
  quota gate) is *one ready-made slideshow per live campaign*, no
  generation. Either give free accounts 2 slides (the gate can do it: a
  `free` plan row with `slides_per_month = 2`) or change the sentence.
- **Terms §3.2:** "Purchased credits do not expire." Extras ($0.06 / $0.10
  per slide) are booked into `usage.extra_*_purchased` for the *current
  period*. Carrying them across periods needs a balance column and a
  change to `fc_reserve_set`. Small, but it is a promise the code should
  keep before the first extra is sold.
- **Terms §3.2:** "Editing text on an existing Slide, or re-exporting, does
  not use Slides." The re-render path costs $0 in frames and is not
  metered — true by construction, but the drawer's edit-and-re-render
  button is not built yet (Library shows text read-only).

**Decide:** change the text, or have the code keep it. Until then the
pages say what they say.

## 7. "No AI watermark, ever" — softened; the pixel watermark is a provider choice

gpt-image-2 frames carry `c2pa.watermarked.unbound` (confirmed in the
manifest of every frame in `output/gen/cache`): an invisible signal in
the pixels that survives every re-encode. The C2PA manifest itself is
stripped and asserted gone before a slide leaves the engine (`engine/clean.mjs`,
`npm test`), so nothing visible, nothing a platform displays, no metadata
stamp — but "no AI watermark, ever" was a claim someone technical could
disprove. The site now says **"no visible watermark — nothing stamped,
nothing to crop"** (index-v9, live).

**Decide:** keep gpt-image-2 (the "days" face-holding edits are built on
it) with the softened copy, or move frames to a model without a pixel
watermark (Flux) and restore the stronger claim. The second is a
re-benchmark of likeness across frames, not a config change.

## 8. The design's credit packs — not built

The dashboard design listed "100 for $8 · 250 for $18 · 600 for $40". The
pricing table has extras per slide ($0.06 batch / $0.10 priority). The
Settings → Plan page shows the per-slide extras and an email link; no
checkout exists until phase 5 (payment provider still undecided:
OWNER-ACTIONS 4). Say if you want packs with a discount instead of
per-slide extras; it changes `plans` and the Settings copy only.


## 9. The de-slop pass — built, on by default for the feed style

2026-09-13: the owner's `deslop.py` (off-centre crop, flat exposure and
saturation, shadow-weighted sensor grain, a hard JPEG pass, text pasted back)
is ported as `engine/deslop.mjs` and applied to the **photo layer** of every
feed frame before the caption is drawn — so the text is crisp by construction
and no bright-pixel mask is needed. Seeded per set (re-renders are
byte-identical), full strength for the camera-roll (`phone`) look, lighter
for the daylight worlds (`strengthFor`). `assets.deslop: 0` on a campaign
turns it off. Evidence: `output/gauntlet/deslop/AB-apex-feed.jpg` (before /
after, $0) and `output/gauntlet/g1/G1-sheet.jpg` (a fresh set, $0.46).

**Decide:** nothing — but the knobs in `engine/deslop.mjs` (`KNOBS`) are the
script's numbers verbatim; if a niche looks too dark, lower `brightness` or
the look's strength rather than switching it off.

## 10. The plans now follow the site — with three assumptions

The 09-13 site sells Free / Clipper $16 (200 slides) / Pro $32 (500) / Studio
$79 (1,500), packs of 100/$8 · 250/$18 · 600/$40 that never expire. Migration
`0006_plans_match_the_site.sql` re-meters the database to it (internal ids
unchanged; `plans.label` carries the names). Where the page is silent:

- **Priority** is 10% of the allowance on Pro (50) and Studio (150). The page
  lists "priority render queue" as a feature; unlimited priority at 2× COGS
  would take Pro to ~9% gross.
- **HD** is included on Pro and Studio as the page says, but an HD slide
  **uses three slides** of the allowance (an HD frame costs ~4×).
  `hd_per_slide_usd = 0` now means "included, ×3"; `null` means not offered.
- **Free** gets a welcome balance of **5 slides** (the engine's minimum set),
  not the page's "2 slides" — two slides cannot make a slideshow. The site
  and Refund Policy §1 should say "one free slideshow".

Gross at full quota with COST.md's COGS: Clipper 66%, Pro 49%, Studio 38%.
**Decide:** keep or change any of the three; each is one number.

## 11. Legal claims the code now keeps (from #6)

- "Purchased credits do not expire" — true from 0006 (the balance carries).
- "2 free Slides" — the code gives 5 (one slideshow); change the text.
- "Editing text … does not use Slides" — still true by construction; the
  edit-and-re-render button is still not built.
