# REPLICATE.md — the corpus, ranked, and how to build the best of it

Looked at all 17 posts / 145 slides in `Carousel examples/`, then read Bedrock
Form (folders `1` and `2`, 16 slides) slide by slide.

---

## The best in the corpus, ranked

### 1. BEDROCK FORM — and it is not close

Folders `1` ("HIT EVERY **MUSCLE** with ZERO equipment") and `2` ("THE 7-DAY
**CALISTHENICS** PROGRAM").

It wins because it is the only entry that is a **complete system** rather than a
good-looking post. Every slide is generated from the same four parts, it scales
to infinite topics, it needs no photography or licensing, and the brand is
unmistakable at thumbnail size.

### 2. Folder 13 — "side effects of *running*"
White ground, B&W athlete cutout, orange italic script accent. The most elegant
single cover in the set.

### 3. Folder 6 — "How To Get So Financially Literate *It Feels Illegal*"
Cream grid-paper ground, editorial serif, pink highlight box, a small object
collage along the bottom. Beautiful, and the calmest.

### 4. Folder 3 — papanca, "lazy habits that make athletes *unstoppable*"
The one the whole brief was built from. Serif + italic accent + B&W bleed.

### 5. Folder 8 — "4 TYPES *of carousels that are going* **VIRAL** IN 2026"
Aerial forest photograph, red condensed caps mixed with italic serif.

Also strong: `10` (UFC octagon, cinematic red), `12` (dark product shot, "6 NANO
BANANA PROMPTS"), `7` (surreal AI baroque portrait).

---

## The Bedrock Form system, decoded

Four parts, and nothing else:

| part | spec |
|---|---|
| **Ground** | flat warm bone, roughly `#EDE6DC`. No texture, no gradient, no photo. |
| **Logo pill** | small dark rounded pill top-left, a dot mark + `BEDROCK FORM`. On **every** slide without exception. |
| **Headline** | 2–3 lines, huge condensed heavy caps, black, with **exactly one line in red** (~`#E8232A`), often with a red underline. Optional small sans subtitle with one emoji. |
| **Character** | a recurring illustrated athlete — near-black body with drawn muscle definition, afro, glowing white eyes — **posed doing the exact thing the slide describes**, with the worked muscles highlighted in red. |

### The slide roles it rotates through

1. **Cover** — headline top, character bottom-centre, subtitle with an emoji
2. **Anatomy map** — character front-on, muscle groups in *different* colours
   (red chest, purple shoulders, green legs, blue core), labels with leader lines
   either side
3. **Progression grid** — 2×2, `LEVEL 1–4`, the character in four variations,
   a caption under each
4. **App proof** — the character *holding a phone* showing a real app screen
5. **Day slide** — headline, character mid-move, a bulleted sets/reps list
6. **Closer** — "FOLLOW FOR MORE", character flexing, a ghosted duplicate behind

### Why it is the right target for us specifically

It is **exactly the campaign-mascot model** — an agency hands over a character,
and every slide is that character in a new pose. No stock, no licensing, no
matting, no halos, and the whole failure class that has been wrecking my output
disappears because **there are no cutouts to matte**. It also solves the
"same character every slide" promise on the product page outright.

---

## How to replicate it

### The one hard part: character consistency

Everything else is layout I already have. The character is the whole problem,
and there are three routes:

| route | how | cost | consistency |
|---|---|---|---|
| **A. Pose sheet, generated once** | one reference image, then generate 24–30 poses against it as a per-campaign asset | one-off | good — the reference anchors it |
| **B. Trained Soul** (`soul_2`) | train once from the pose sheet, then request any new pose forever | Higgsfield credits | best |
| **C. Parametric vector figure** | draw it in code | free | perfect, but the old engine already proved this looks like a blob |

**Recommended: A now, B when there are credits.** A is free today, and B upgrades
it without changing anything downstream, because both produce the same thing —
a folder of posed PNGs keyed by pose id.

### The pose vocabulary

One generation pass per campaign mascot covers essentially every fitness slide:

```
stand-front  stand-flex   push-up      diamond-push  decline-push
pull-up      chin-up      scapular     hang          superman-hold
squat        lunge        split-squat  calf-raise    plank
pike-push    wall-handstand  handstand-push  l-sit
sit-sofa     lie-sofa     hold-phone   hold-plate    walk
point        arms-crossed shrug        celebrate
```

Fixed prompt skeleton, character description held constant, only the pose
clause varying — the same discipline that made the object library read as one
shoot:

> flat vector illustration of {CHARACTER}, {POSE}, full body, centred,
> pure white background, bold clean lines, no text

Then a **muscle-highlight overlay**: the same pose rendered with the worked
muscle group in the accent colour, composited over the base at low opacity.
That is a mask per muscle group, generated once alongside the pose.

### What the engine needs — and mostly already has

| need | status |
|---|---|
| flat ground, one colour | **have** |
| condensed heavy caps, one line in accent, red underline | **have** — `fitText`, accent runs, rule decorations all exist |
| logo pill, fixed corner, every slide | **have** — furniture system |
| character placed bottom-centre, scaled, no matting | trivial — no alpha work needed, the generator returns clean white |
| 2×2 progression grid with per-cell captions | **new** — a simple grid role, much easier than the constellation solver |
| bulleted sets/reps list | **new** — a list block with real bullets |
| leader lines for the anatomy map | **new** — the only fiddly one |
| pose library per campaign | **new** — the generation pass above |

Four small additions. No new architecture, and **no matting anywhere**, which is
the single biggest reliability win available.

---

## Why this is the right thing to build next

- It is the highest-quality thing in the reference corpus.
- It is the **only** entry that is a system rather than a poster, which is what a
  product has to ship.
- It removes cutouts entirely, and cutouts have caused every visible defect so
  far — halos, dark fringes, blown mattes, floating subjects.
- It is the campaign-mascot model, so it fits the "no fixed library" correction:
  the character comes from the campaign, not from a shelf.
- The information design — levels, muscle maps, sets and reps — is genuinely
  useful, which is what earns saves.

The risk to name up front: **if the pose sheet drifts, the whole thing collapses**,
because the character *is* the brand. That is worth spending Higgsfield credits
on rather than economising, and it is the one place a trained Soul clearly beats
a reference image.
