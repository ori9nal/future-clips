# Pricing model

Engineering keeps the arithmetic here; Product measures the costs; the owner sets the numbers (D-003, D-044). Run `node tools/pricing.mjs` for the current table; pass `batch=`, `priority=`, `margin=`, `agency=`, `fees=`, `use=` to try others.

## The rule

For a plan priced **P** a month, three fixed shares leave first: the agency's commission (**15%**, D-026), payment fees (**about 5%**: Dodo as merchant of record), and the margin the business keeps (**50%**, owner's rule). What is left, **30% of P**, is the most the plan's slides may cost at the model providers.

```
provider budget   = P × (1 − 0.50 − 0.15 − 0.05) = 0.30 × P
cost at full use  = batch_slides × c_batch + priority_slides × c_priority     (HD draws 3 slides, so it is already counted)
allowance         = budget ÷ (c × utilisation)
```

Utilisation is the share of the allowance a typical customer actually uses in a month. At 100% the margin is guaranteed whatever a customer does; at a measured 60% the same margin holds for the average customer while the heavy user is still profitable (their margin falls to the 100% column, never below).

## Measured cost per slide (this machine, 2026-09-18)

| Lane | $/slide | Sample | Notes |
|---|---|---|---|
| batch | 0.027 | 1 set (COST.md: $0.2179 for 8) | Message Batches for copy, low-priority frames |
| priority | 0.058 | 18 sets, min 0.034, max 0.108 | realtime copy, 1 anchor + N edits at medium |
| HD | ×3 | not measured | high-quality frames are 3× the edit price |

Product's rounds may have moved these (prompt changes, cache hits, `deslop` off, low-quality anchors); the table below must be re-run with their current numbers.

## What the table says today (`node tools/pricing.mjs`)

| Plan | Price | Budget (30%) | Today | Cost at 100% | Margin at 100% | Margin at 60% use | Max batch slides at 100% | at 60% use |
|---|---|---|---|---|---|---|---|---|
| Clipper | $16 | $4.80 | 200 | $5.40 | 46% | 60% | 177 | 296 |
| Pro | $32 | $9.60 | 500 + 50 priority | $16.40 | 29% | 49% | 248 (keeping 50 priority) | 485 |
| Studio | $79 | $23.70 | 1,500 + 150 priority | $49.20 | 18% | 43% | 555 (keeping 150 priority) | 1,140 |
| Packs | $8 / $18 / $40 | – | 100 / 250 / 600 | $2.70 / $6.75 / $16.20 | 46% / 42% / 39% | (packs are always fully used) | | |

Reading: Clipper is right at 50% for the average customer and still profitable for a heavy one. Pro and Studio as sold today only hold 50% if customers use about half their allowance; a customer who uses everything leaves 29% / 18%. Two levers, in order: (1) bring the priority cost down (the reference image on every edit is $0.012 of the $0.027 frame; a cheaper anchor, fewer edits, cache hits), (2) set the allowances from the table at the utilisation the owner is comfortable with. Packs are safe at any use; the 600 pack is the thinnest.

## The cost came down 30% (Product, 2026-09-19, P-23)

Three levers, each measured: the copy model no longer writes scene prose the engine throws away, a rejection that is only about one line rewrites that line instead of the whole set, and a frame that is wide with nobody in it is drawn a tier cheaper. Verified on the same campaign and slide count: **$0.0635 → $0.0446 a priority slide, 30% down**, with the set reading as well as the one it replaces (round 30 against round 26).

| Plan | Cost if fully used, before → after | Monthly, full use | Yearly rate, full use | Yearly, 60% use |
|---|---|---|---|---|
| Clipper | $5.44 → $4.16 | 59% | 54% (was 46%) | 64% |
| Pro | $13.79 → $10.55 | 59% | 47% (was 37%) | 60% |
| Studio | $33.02 → $25.26 | 55% | 48% (was 38%) | 61% |

At the new cost every plan clears 50% on the monthly price even if a customer uses every slide, and comes within a couple of points of it on the yearly rate — which the old cost missed by 13 points on Pro. The allowances as sold (200 / 400 + 50 / 1,000 + 100) now sit close to the 50% line at the yearly rate rather than well under it: the line falls at 230, 354 and 925 batch slides, so Clipper has room and Pro and Studio are slightly over.

Two cautions. The saving is measured on one set; the 18-set average is what to plan with until more land. And the batch figure above is scaled from the priority measurement, because the batch lane has still rendered exactly one set ever — that single $0.0272 underwrites about 80% of everything sold, and is the largest unverified number in this document.

## Applied (D-044 and D-048, 2026-09-19)

Two prices per plan (D-048): monthly **$19.99 / $49.99 / $99.99**, or **$16 / $32 / $79 a month** paid yearly. Allowances are sized against the yearly rate because that is the least a customer can pay in a month, so the rule holds on either billing.


Migration 0018 and the site: **Clipper $16 / 200**, **Pro $32 / 400 + 50 priority**, **Studio $79 / 1,000 + 100 priority**, packs unchanged. Margin at full use 46% / 37% / 38%; at the measured 60% utilisation 60% / 54% / 55%. Product's measured cost: $0.0582 a priority slide over 18 sets and 138 slides, copy billed per set (about $0.102), so a short set costs more per slide; 6 of those 18 sets paid for the copy twice because the first attempt was rejected.

To raise the allowances, lower the cost first: repair a rejected copy attempt instead of paying for a new one, and drop the reference image on families that hold no single person (those frames draw at $0.038 against $0.050 for an edit). Each cent off a priority slide is about 165 more slides inside Studio's budget.

## The earlier proposal (superseded)

Keep the prices. If Product's current cost is at or under the measured one: Clipper 200, Pro 400 + 50 priority, Studio 1,000 + 100 priority hold 50% at 60% use and stay above 30% at full use. If Product's cost is lower, raise from the table. Packs unchanged. Whatever is chosen is one `update public.plans` per row (D-012 note) and one edit of the site's pricing cards.
