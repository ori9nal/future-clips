# PLAN.md — 100 templates, a small model, and real margin

**Your architecture is better than mine and the numbers prove it.** Pre-build the
templates once as product assets; at request time a cheap model only *chooses*
elements, *makes or finds* them, grades, and composites. No expensive model ever
sits in the request path.

Changing the plan to **30–35 slides for $20** is what unlocks it. The per-slide
budget goes from $0.00075 to **$0.175** — 230× more headroom — and that is the
difference between "cannot afford AI" and "can afford AI plus a quality check on
every slide".

---

## 1. The economics, worked

Binding case is an **agency-attributed** subscriber, because the 25% share comes
off the top.

| | attributed | unattributed |
|---|---|---|
| revenue | $20.00 | $20.00 |
| Stripe (2.9% + 30¢) | −$0.88 | −$0.88 |
| agency share 25% | −$5.00 | — |
| **available** | **$14.12** | **$19.12** |
| COGS budget at 40% net margin ($8 profit) | **$6.12** | $11.12 |
| **budget per slide (35 slides)** | **$0.175** | $0.318 |

### What a slide actually costs

| line | cache hit | cache miss |
|---|---|---|
| template | $0 — pre-built product asset | $0 |
| element selection (Haiku 4.5, ~1.5k in / 400 out) | $0.0035 | $0.0035 |
| element generation (2 new @ $0.035) | $0 | $0.070 |
| vision QC (Sonnet 5, 1 image + 300 out) | $0.0060 | $0.0060 |
| compose + grade (CPU) | $0.00005 | $0.00005 |
| storage + egress (WebP) | $0.00002 | $0.00002 |
| **total** | **$0.0095** | **$0.080** |

At a realistic **80% library hit rate**: `0.8 × 0.0095 + 0.2 × 0.080` = **$0.024 per slide**.

| | attributed | unattributed |
|---|---|---|
| 35 slides × $0.024 | $0.84 | $0.84 |
| profit | **$13.28** | **$18.28** |
| **net margin** | **66%** | **91%** |

**You asked for 40%. This lands at 66% on the worst case.**

Even the pathological case — *every* slide generating two fresh elements, zero
cache — costs $2.80 and still returns **56%**. The margin is not fragile.

### The headroom is the point

Budget is $0.175/slide; the plan spends $0.024. **That is 7× spare**, and it
should be spent on quality, not banked:

- a **vision QC on every slide** is already in the number above — affordable now,
  impossible under the old 200-carousel plan
- 3–4 generated elements per slide instead of 2
- regenerate-on-reject rather than ship-and-hope
- the good image model for subjects, not the cheap one

---

## 2. What changed about the product

**$20 buys ~4–5 carousels, not 200.** That is a different promise: *premium and
few*, not *cheap and many*. It is also the honest one — 200 carousels a month at
this quality was never going to be true, and 35 excellent slides is worth more
to a clipper than 200 mediocre ones.

It also fixes the flaw in the last plan: there is no per-campaign design pass to
amortise, so **self-serve and partner campaigns cost the same**. The templates
are product assets, paid for once by us, not per customer.

---

## 3. TikTok — what the format actually demands

TikTok is network-blocked from this machine (`ERR_CONNECTION_RESET`), so this is
from analysis rather than my own browsing. Flagging that rather than dressing it
up.

Three things that are **not** true of Instagram and that we currently get wrong:

1. **9:16 / 1080×1920, not 4:5.** Every template we have is 1080×1350 or
   1080×1440. The product page promises TikTok export. That is a gap.
2. **Centre-safe.** TikTok's right rail and bottom caption cover the edges — text
   and key elements must sit centred, inside a safe box. Our safe areas are
   Instagram-shaped.
3. **Concrete, numeric hooks.** The winning pattern is a specific outcome, not an
   abstraction: *"Month 1: $0. Month 3: $284."* My hooks — "the boring part is
   the sport" — are abstract, which RESEARCH.md §1 already flagged as
   gap-closing rather than gap-opening. Numbers open the gap harder.

Also confirmed: dark ground + accent + dramatic imagery beat plain black-on-white
(127K views in 72h on the same content); the three formats that carry are
**numbered list, comparison, story reveal**.

**Implication for the template library:** it needs a 9:16 family with a centre-
safe grid, not just a resize of the 4:5 ones.

---

## 4. The 100+ template library

Templates are **data**, built once, versioned as product assets.

**Coverage, not count.** 100 arbitrary templates is worse than 60 that span the
axes properly. The library is a grid:

| axis | values |
|---|---|
| canvas | 1080×1350 (IG) · 1080×1920 (TikTok) |
| archetype | single-cutout · constellation · comparison · statement · numbered-list · story-reveal |
| ground | white · bone · dark · graded photo |
| type voice | editorial serif · plain sans · heavy condensed |
| density | 1 element · 3 · 7–14 |

2 × 6 × 4 × 3 × 3 = 432 combinations. **Ship ~100 hand-tuned points in that
space**, not the full cross-product — the tuned ones are where the design lives.

Uniqueness does not come from template count. It comes from
`template × elements × palette × copy × seed`, and the divergence engine and
fingerprint collision check for that are **already built**.

---

## 5. The request-time pipeline — no expensive model in it

```
1  PICK      seed + campaign + concept -> template          deterministic
2  BRIEF     Haiku 4.5: for each slot, what element and why  ~$0.0035/slide
3  RESOLVE   ladder: campaign clip -> agency asset -> mascot
             -> drawn graphic -> cache -> GENERATE           $0 or ~$0.035/element
4  GRADE     match every element to the template's rule       CPU
5  COMPOSE   engine: fit, safe areas, collisions, rules       CPU
6  QC        Sonnet 5 looks at the slide: ship or redo        ~$0.006/slide
```

Haiku's job in step 2 is deliberately small: **choose and describe, never
design**. The design is already in the template. That is what keeps it cheap and
what keeps it consistent.

Step 6 is the part the old plan could not afford. A slide that fails QC is
regenerated once against the returned reason; the second result ships either way
and the failure is logged, so bad templates surface in the data.

---

## 6. Models — the direct answer

| stage | model | why |
|---|---|---|
| element brief + selection | **`claude-haiku-4-5`** | $1/$5 per MTok. Choosing from a manifest is not a taste task, and it runs 35× a month per user. |
| per-slide vision QC | **`claude-sonnet-5`** | $2/$10. Needs vision and judgment; at $0.006 a slide it fits with room. |
| template authoring, hook writing, campaign onboarding | **`claude-opus-5`** | Rare, offline, sets the ceiling for everything else. Never in the request path. |

**Images:** Nano Banana / Gemini Flash Image (~$0.035) for subjects and objects
where prompt adherence *is* the problem; FLUX schnell (~$0.003) for grounds and
textures; a trained Soul or reference anchor for the mascot.

**Free savings, no quality cost:** prompt-cache the template manifest and brand
document (stable across every call — ~90% off cached input), and use the Batch
API for element sweeps (50% off, nothing offline is latency-sensitive).

---

## 7. Build order

1. **9:16 template family + centre-safe grid** — the TikTok gap, no key needed.
2. **Template schema v2** — archetype, density, ground, voice as first-class
   fields the picker can query. No key needed.
3. **Element bus + provenance ladder** — one resolver over the five sources, with
   `zero_gen_mode` filtering. No key needed.
4. **Haiku brief step** — needs the Anthropic key.
5. **Generation + cache** — needs an image key.
6. **Sonnet QC loop** — needs the Anthropic key.
7. **Author the ~100 templates** — the long tail, and the actual product.

Steps 1–3 and 7 need nothing from you. 4 and 6 need the Anthropic key; 5 needs
Higgsfield re-auth or a `FAL_KEY`.

---

## 8. What I would push back on

- **35 slides is ~4 carousels.** If a clipper needs to post daily, that is a week
  of content, not a month. Either the number climbs to ~60 (still 62% margin at
  these costs) or the plan is positioned as *premium few*, deliberately.
- **The 25% agency share is the real cost line**, not compute — $5.00 against a
  COGS of $0.84. Worth deciding whether it applies to the whole subscription or
  only the first N months.
- **80% cache hit is an assumption, not a measurement.** It holds once a niche
  library is warm and is much worse for the first users in a new niche. The
  pathological case still returns 56%, so this does not threaten the plan, but
  the first cohort in any niche costs real money.
- **I have not verified TikTok myself.** The network here blocks it. Before
  building the 9:16 family on those three claims, someone should look at actual
  million-view slideshows on a machine that can reach it.
