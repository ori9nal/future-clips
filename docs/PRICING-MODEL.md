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

## Batch for every customer (owner, 2026-09-20; migration 0031)

The owner's rule is 50% at full use, and the realtime path (below) could not reach it. Every customer's set now goes through the providers' batch APIs — the same words and frames at half the price, back within the day and usually much sooner — and only the demo renders in two minutes. So the whole allowance is costed at the batch rate again, and the caps are $6 / $12 / $30 (0.03 a slide reserve).

| Plan | Yearly rate | Cost at full use ($0.027 / $0.019 a slide) | Margin at 100% use | Margin at 60% use | Monthly rate, margin at 100% |
|---|---|---|---|---|---|
| Clipper | $16 | $5.40 / $3.80 | 46% / 56% | 60% / 66% | 53% / 61% |
| Pro | $32 | $10.80 / $7.60 | 46% / 56% | 60% / 66% | 58% / 65% |
| Studio | $79 | $27.00 / $19.00 | 46% / 56% | 60% / 66% | 53% / 61% |

(after the 15% agency commission and 5% fees. $0.027 is the one batch set ever measured, before P-23; $0.019 is that figure with P-23's 30% saving, which applies to the batch lane too.) Read: on the monthly price the rule holds at full use at either cost. On the yearly rate it holds only at the P-23 cost — the pre-P-23 figure misses by four points — and the one number that decides it is the batch cost per slide, which has been measured exactly once. **Measured (2026-09-20, one 5-slide set on the test workspace, collected by the five-minute poller, 16 minutes end to end): $0.1447 for 5 slides — copy $0.0235, frames $0.1212 — that is $0.0289 a slide.** A 5-slide set is the worst case (the copy is billed per set), and it is one set; but it is the number to plan with until more land. At $0.029: monthly price at full use **51% / 57% / 51%** — the rule holds; yearly rate at full use **44% / 44% / 43%** — it does not; yearly at 60% use 58%. Two levers reach 50% on the yearly rate, both the owner's: allowances of **166 / 332 / 820** slides on yearly billing, or a yearly rate of about **$19 / $39 / $96** a month at today's allowances. `node tools/pricing.mjs batch=0.029` reproduces the table.

## There was no priority tier for a day (owner, 2026-09-20; migration 0030 — superseded by 0031 above)

Every set now renders on the fast path, from one allowance. Pro and Studio lose their 50 and 100 priority slides; allowances stay 200 / 400 / 1,000; spend caps are resized to $12 / $24 / $60 so the whole allowance can be used at the fast path's reserve rate. The arithmetic above assumed most slides were drawn on the slow lane at $0.027. They are not any more, and the 50% rule no longer holds at full use on any plan:

| Plan | Yearly rate | Cost at full use ($0.0446 / $0.058 a slide) | Margin at 100% use | Margin at 60% use | Monthly rate, margin at 100% |
|---|---|---|---|---|---|
| Clipper | $16 | $8.92 / $11.60 | 24% / 8% | 47% / 37% | 35% / 22% |
| Pro | $32 | $17.84 / $23.20 | 24% / 8% | 47% / 37% | 44% / 34% |
| Studio | $79 | $44.60 / $58.00 | 24% / 7% | 46% / 36% | 35% / 22% |

(after the 15% agency commission and 5% fees; $0.0446 is the P-23 single-set measurement, $0.058 the 18-set average.) Read: at the measured utilisation the plans keep roughly 37–47%; a customer who uses every slide leaves 8–24%. The levers are the same as before — the cost per slide, or the allowances — and both are the owner's to move. `node tools/pricing.mjs` now costs the whole allowance at `priority=`.

## Applied (D-044 and D-048, 2026-09-19)

Two prices per plan (D-048): monthly **$19.99 / $49.99 / $99.99**, or **$16 / $32 / $79 a month** paid yearly. Allowances are sized against the yearly rate because that is the least a customer can pay in a month, so the rule holds on either billing.


Migration 0018 and the site: **Clipper $16 / 200**, **Pro $32 / 400 + 50 priority**, **Studio $79 / 1,000 + 100 priority**, packs unchanged. Margin at full use 46% / 37% / 38%; at the measured 60% utilisation 60% / 54% / 55%. Product's measured cost: $0.0582 a priority slide over 18 sets and 138 slides, copy billed per set (about $0.102), so a short set costs more per slide; 6 of those 18 sets paid for the copy twice because the first attempt was rejected.

To raise the allowances, lower the cost first: repair a rejected copy attempt instead of paying for a new one, and drop the reference image on families that hold no single person (those frames draw at $0.038 against $0.050 for an edit). Each cent off a priority slide is about 165 more slides inside Studio's budget.

## The earlier proposal (superseded)

Keep the prices. If Product's current cost is at or under the measured one: Clipper 200, Pro 400 + 50 priority, Studio 1,000 + 100 priority hold 50% at 60% use and stay above 30% at full use. If Product's cost is lower, raise from the table. Packs unchanged. Whatever is chosen is one `update public.plans` per row (D-012 note) and one edit of the site's pricing cards.
