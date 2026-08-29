# PLAN.md — the AI as art director

The ask: **the main AI is the graphic designer**, assembling elements from
campaign clips, agency assets, mascots, and AI-made parts. No stock.

The cost math below moves *when* the designer runs. That is the single most
important decision in this plan, so it comes first.

---

## 0. The finding that shapes everything

Running Claude as art director **per carousel** costs roughly **$0.26–0.34**:

| stage | model | tokens | cost |
|---|---|---|---|
| concept + hooks | Opus 5 | 3k in / 2k out | $0.065 |
| art direction, 8 slides batched | Opus 5 | 6k in / 4k out | $0.130 |
| element prompt expansion | Haiku 4.5 | 2k in / 1k out | $0.007 |
| vision critique, 8 slides | Sonnet 5 | 16k in / 2.4k out | $0.056 |
| | | | **$0.258** |

The plan sells **$20 for 200 carousels** — **$0.10 of revenue per carousel**, with
a stated COGS ceiling of **$0.006**. Per-carousel art direction is **2.6× the
entire revenue** and **43× the ceiling**. It cannot ship that way at any model tier;
even all-Haiku lands near $0.05, still 8× the ceiling.

**So the designer runs once per CAMPAIGN, not once per carousel.**

It designs a *system* — archetypes, element sets, treatment rules — and the
deterministic engine executes that system hundreds of times for fractions of a
cent. This is also exactly what the reference products do: growithalex ships a
**Brand System Document** built once, plus a **reference anchor image** that a
30-image library is generated from.

| | design time (once per campaign) | generate time (per carousel) |
|---|---|---|
| who | **Claude Opus 5** as art director | the engine |
| does | picks archetypes, briefs elements, sets treatment rules, critiques samples | resolves elements from cache, lays out, validates |
| costs | **~$4–6, once** | **~$0.002** |
| human | approves the style guide | nothing |

Amortised over a partner campaign serving thousands of carousels this is
~$0.001 each — inside the ceiling with room. See §6 for where it does *not* fit.

---

## 1. The element bus — five sources, no stock

Every element carries `provenance`, so `zero_gen_mode` can filter to the two
client-owned sources and still produce a full carousel.

| # | source | provenance | cost | status |
|---|---|---|---|---|
| 1 | **Campaign clips** — ffmpeg scene-detect → frame → matte | `campaign-video` | $0 | **built** (`engine/source/frames.mjs`) |
| 2 | **Agency / clipping assets** — brand uploads via admin | `agency-asset` | $0 | **built** (`lib/ingest.ts`) |
| 3 | **Mascot** — the account's recurring character | `mascot` | generated once | to build |
| 4 | **AI elements** — objects, textures, grounds | `ai-element` | ~$0.035 each, cached | client built, needs a key |
| 5 | **Drawn graphics** — charts, stats, rings | `drawn` | $0 | **built** (`engine/objects.mjs`) |

Resolution order is cheapest-and-most-on-brand first: **1 → 2 → 3 → 5 → 4**.
Generation is the last resort, never the default, and every result is cached by
content hash so a campaign pays for each element once, ever.

### The mascot is the differentiator

One trained character, reused across every slide of every carousel forever.
That is the "same character, every slide" promise on the product site, and it is
the thing stock can never do. Two routes:

- **Higgsfield `soul_2`** — train a Soul from 5–20 images, then reference it by
  id in any later generation. Already wired into this session.
- **Reference-anchor prompting** — one approved image passed as a reference to
  every subsequent call. Cheaper, slightly less consistent.

---

## 2. The pipeline

```
DESIGN TIME  (once per campaign, human approves)
  1  brief        brand kit + references + source clips
  2  ART DIRECT   Opus 5 -> STYLE GUIDE  (archetypes, element manifest,
                                          treatment + colour rules, type scale)
  3  BUILD        resolve/generate every element in the manifest -> library
  4  CRITIQUE     render 3 sample carousels, Opus 5 looks at them, revises
                  the style guide, re-renders. Max 2 rounds.
  --> approved style guide + element library, both versioned

GENERATE TIME  (per carousel, no model in the path)
  5  concept      pick a structure + copy from the campaign's idea bank
  6  compose      engine executes the style guide against the element library
  7  validate     fitText, safe areas, spellcheck, campaign rules, COGS
```

### What the art director actually emits

Not pixels — *decisions*. The engine turns decisions into pixels deterministically.

```json
{
  "archetypes": [
    { "id": "hero-cutout", "use": "covers",
      "ground": "bone", "subject": { "provenance": ["campaign-video","mascot"],
      "treatment": "greyscale", "bleed": "bottom", "heightPct": 0.72 },
      "type": { "face": "display-editorial", "case": "lower",
                "sizeRange": [88, 132], "maxHookWords": 6 } },
    { "id": "constellation", "use": "value slides",
      "elements": 7, "labels": true, "ground": "white",
      "rule": "objects keep their own colour, people go greyscale" }
  ],
  "elementManifest": [
    { "role": "hero", "brief": "the mascot mid-stride, three-quarter view",
      "source": "mascot" },
    { "role": "data", "brief": "weekly volume, peaking at 58 mi", "source": "drawn" },
    { "role": "object", "brief": "worn race shoe, side profile, studio light",
      "source": "ai-element" }
  ],
  "narrativeEnergy": { "hook": "tension", "value": "clarity", "cta": "resolution" }
}
```

`narrativeEnergy` is the part worth stealing from the reference workflow: the
director picks imagery by *what the slide is doing*, not by keyword match. My
current matcher scores an intent string against a stock query — that is the
difference between a designer and a search box.

---

## 3. The critique loop — what makes it a designer

A designer looks at their own work. At design time only, Claude is shown the
rendered sample slides and returns structured corrections:

```json
{ "verdict": "revise",
  "fixes": [
    { "slide": 1, "issue": "hero reads small against a 132px headline",
      "change": "subject.heightPct 0.72 -> 0.86" },
    { "slide": 4, "issue": "four objects cluster left, right third is dead",
      "change": "constellation.minAngularSpread 0.6" }
  ] }
```

Every fix is a **parameter change to the style guide**, never a one-off nudge to
one image — so the correction applies to all 200 carousels, not one.

---

## 4. Which model — the direct answer

| stage | model | why |
|---|---|---|
| **Art direction** | **`claude-opus-5`** | Runs once per campaign and sets the quality of everything downstream. This is the wrong place to save money — the whole plan works *because* this call is rare. |
| **Critique (vision)** | **`claude-opus-5`** | Same call, same reason. Judging a rendered layout is the hardest task here. |
| **Concept / hooks** | **`claude-opus-5`** | Taste-bound. RESEARCH.md §1: the hook is ~80% of the outcome. |
| **Prompt expansion** | **`claude-haiku-4-5`** | Mechanical brief → prompt rewriting. No judgment. |

**Where you can cut, if you want to:** moving critique to `claude-sonnet-5`
saves about 60% of that stage. At design-time frequency it is a few dollars a
campaign, so I would not — but it is your call, not mine.

Two cost levers that cost nothing in quality:
- **Prompt caching** on the brand document and style guide (stable across every
  call in a campaign) — ~90% off the cached input.
- **Batch API** for the element-generation sweep — 50% off, and nothing at design
  time is latency-sensitive.

### Image models

| use | model | cost | why |
|---|---|---|---|
| mascot | Higgsfield `soul_2`, or Nano Banana with a reference anchor | one-off training | character consistency is the entire promise |
| objects & subjects | **Nano Banana 2 / Gemini Flash Image** | ~$0.034–0.067 | best prompt adherence; semantics are the whole problem |
| grounds & textures | **FLUX schnell** via fal | ~$0.003 | semantics barely matter, volume does |

---

## 5. Build order

1. **Style guide as data** — one JSON schema the art director writes and the
   engine reads. Everything else hangs off this.
2. **Element bus + provenance** — one resolver over the five sources, with the
   priority ladder and `zero_gen_mode` filtering.
3. **Art director call** — brief → style guide, against the schema.
4. **Mascot pipeline** — train/anchor once, reference thereafter.
5. **Critique loop** — render samples, revise parameters, re-render, cap at 2.
6. **Admin surface** — approve the style guide, see the element library, see the
   spend.

Steps 1, 2 and 6 need no API key and are worth doing first. Steps 3–5 need the
Anthropic key; step 4 needs an image source.

---

## 6. Where this plan does not fit — stated, not buried

- **Self-serve campaigns break the amortisation.** A partner campaign serving
  thousands of carousels amortises a $5 design pass to ~$0.001. One user's own
  campaign making 200 carousels carries **$0.025 each — 4× the ceiling.** Fix by
  seeding self-serve campaigns from a pre-built niche style guide (near-zero
  design cost) and reserving a bespoke design pass for the $39 tier.
- **Critique needs a taste anchor.** Claude judging its own layout without a
  reference will converge on "fine". It should be shown the campaign's reference
  images alongside the render and asked to compare, not to rate.
- **$0.006 was set before any of this existed.** With generation amortised the
  engine still lands far under it; the design pass is what pushes a small
  campaign over. That number may need to become "per campaign" rather than
  "per carousel" — worth deciding deliberately.
- **Element generation is still blocked.** Higgsfield's session is expired, Flow
  cannot be automated from here (RESEARCH.md Part 2), and there is no `FAL_KEY`.
  Steps 1, 2 and 6 proceed without it; steps 3–5 do not.
