# ANALYSIS.md — Reference Corpus Breakdown

**Corpus:** `Carousel examples/` — 17 carousels, **145 slides**, 15 top-level folders.

**Method:** every one of the 145 slides was measured programmatically (sRGB → CIELAB,
hue binned at 20°, chroma threshold C\*≥18, background = modal colour of the 6% frame
border, content bbox = pixels >14 ΔRGB from the corner-sampled background).
36 slides were additionally read visually (slide 1 / a middle slide / final slide from
12 different folders) to name the archetypes.

Raw measurements: `tools/corpus-report.json`, `tools/corpus-meta.json`.
Probe source: `tools/color-probe.mjs`, `tools/margins.mjs`, `tools/corpus-report.mjs`.

---

## 1. Canvas — measured

| Dimensions | Ratio | Count | Share |
|---|---|---|---|
| 1080×1350 | 0.800 (4:5) | 53 | 37% |
| **1080×1440** | **0.750 (3:4)** | **21** | 14% |
| 1080×1438 | 0.751 (3:4) | 15 | 10% |
| 1170×1463 | 0.800 (4:5) | 15 | 10% |
| 1080×1920 | 0.563 (9:16) | 12 | 8% |
| 1092×1440 | 0.758 (~3:4) | 10 | 7% |
| 1122×1402 | 0.800 (4:5) | 8 | 6% |
| 1170×1450 | 0.807 (~4:5) | 7 | 5% |
| other | — | 4 | 3% |

**3:4 cluster = 47 slides (32%)**, 4:5 = 83 (57%), 9:16 = 12 (8%). 3:4 is a real,
well-populated production format in this corpus — folders **3, 7, 12** are natively
1080×1440/1438. The campaign spec of 1080×1440 is corpus-grounded, not arbitrary.

## 2. Background treatments — measured, four families

Classified by background L\* and C\* (`bg.L`, `bg.C` in the report):

| Family | Rule | Measured exemplars | Count | Share |
|---|---|---|---|---|
| **paper-white** | L\*≥98, C\*<2 | `#FFFFFF` L100 C0 | 51 | 35% |
| **ink-dark** | L\*≤16, C\*≤8 | `#000000` L0, `#0D0D0D` L3.5, `#161616` L7.4, `#181818` L8.3 | 53 | 37% |
| **bone-warm** | L\*≥88, C\* 2.5–9 | `#F1E9DE` L92.7 C6.2 · `#F4ECE1` L93.7 C6.3 · `#FBF5ED` L96.9 C4.7 | 25 | 17% |
| **photo-plate** | anything else | `#0F1815` L7.3 C4.6 · `#32525D` L33 C13.1 · `#045484` L34 C33.1 | 16 | 11% |

> **The single most important finding: 89% of slides are FLAT backgrounds.**
> Only 16 of 145 slides are full-bleed photographs. The corpus is not a photo-collage
> format — it is *flat plate + isolated cutout + type*. Any engine that leans on
> photography is imitating the wrong 11%.

The bone-warm family is remarkably tight: across the 16 Bedrock Form slides
(folders 1+2) the background sits between **L\*92.0–93.7, C\*5.7–6.4** — a range of
1.7 L\* and 0.7 C\*. That is a locked brand plate, not a per-slide choice.
The campaign `paper #F4F1EA` measures L\*95.3 C\*3.7 — squarely inside this family.
Campaign `ink #0A0E1A` measures L\*3.5 C\*3.0 — inside ink-dark.

## 3. Colour grading — measured

### Accent discipline

Counting chromatic clusters per slide (hue-binned at 20°, keeping bins covering ≥0.8%
of pixels):

| Chromatic clusters | Slides | Share |
|---|---|---|
| 0 (fully neutral) | 42 | 29% |
| **1** | **54** | **37%** |
| 2 | 30 | 21% |
| 3 | 13 | 9% |
| 4 | 6 | 4% |

**96/145 slides (66%) carry at most ONE accent hue.** Every slide with 2+ clusters is
either a full-bleed photograph (where the scene supplies its own hue) or contains a
full-colour emoji / UI screenshot. **No flat-background type slide in the corpus uses
two accent hues.** The campaign "exactly one accent" rule is a description of the
corpus, not a restriction on it.

### Accent hue stability within a set

| Set | Modal accent hue | % of slides on that hue | Chromatic slides |
|---|---|---|---|
| 1 (Bedrock Form) | h20 red | **100%** | 6/6 |
| 2 (Bedrock Form) | h20 red | **90%** | 10/10 |
| 5 (pro.fit) | h80 amber | **86%** | 7/7 |
| GYM 2 | h40 orange | 75% | 8/8 |
| 10 (UFC) | h20 red | 67% | 11/12 |
| 13 (running) | h40 orange | 50% | 5/10 |

The disciplined sets — the ones that read as *brands* rather than as posts — hold a
single hue on 86–100% of slides. Measured accent values:

| Set | Accent hex (measured mean of the cluster) |
|---|---|
| Bedrock Form | `#C62B29` → `#DF2C2D` (h20, red) |
| running / F2 | `#FC7F34` (h40, orange) |
| pro.fit | `#EFC662` / `#D3A203` (h80, amber) |
| Dr. Longevity | `#B96042` (h40, bronze) |
| marketingharry | `#FD5BB4` (h340, magenta) + `#FE4D40` |

Campaign `accent-A #FFB020` measures **h≈75 (amber)**; `accent-B #5B7FFF` measures
**h≈288 (blue)**. They land in different bins, so the one-accent validator can
discriminate them cleanly.

### Accent *quantity* decays across the set

Mean share of pixels belonging to the dominant accent cluster, by slide position:

| Position | Mean accent pixel share |
|---|---|
| **slide 1** | **10.7%** |
| middle slides | 9.0% |
| **final slide** | **5.8%** |

The cover is the loudest slide and the closer is the quietest. Folder 13's final slide
measures `chromaticFrac = 0.000` — literally zero accent, all grey. Folder 3's final
slide drops to 1.6%. **The CTA is delivered in a whisper, not a shout.** This is the
opposite of what a naive generator does.

### Ink and paper values

Across the 89 flat-background slides: **median L\*₀₅ = 13** (the darkest 5% of pixels)
and **median L\*₉₅ = 100**. Type is near-black on near-white, or inverted. There is no
mid-grey body copy on light plates except in *deliberately quiet* closers
(folder 13 slide 10, folder 4 slide 7 — both grey-on-white CTAs).

## 4. Safe areas — measured

Content bounding box on the 89 flat-background slides (normalised, expressed at 1080×1440):

| Edge | p10 | p25 | p50 | p75 | p90 |
|---|---|---|---|---|---|
| left | 0 | 0 | 47 | 103 | 108 |
| right | 0 | 0 | 56 | 108 | 180 |
| top | 0 | 12 | 76 | 195 | 243 |
| bottom | 0 | 17 | 56 | 115 | 136 |

The p10/p25 zeros are *deliberate bleeds* (cutouts running off the edge). Filtering to
type-only slides gives the real grid. Two sets use a mathematically exact margin:

- **Folder 3 (@papanca.io):** left = right = **108px on every single slide** (exactly
  10% of 1080). Bottom = **96px** on all 8 interior slides — the handle baseline.
  Headline top edge: 184–224px.
- **Folder 4 (@whymattrs):** bottom = **115px on every interior slide** — again a
  locked handle rail.

**Derived grid for the engine: 72–108px side margins (6.7%–10%), 90px top safe,
150px bottom safe reserved for the furniture rail.** Subjects are permitted — expected,
even — to bleed past this box; type never is.

## 5. Layout archetypes

Thirteen distinct archetypes are present. The five the campaign asks for are marked ★.

### ★ A1 — CUTOUT-EDITORIAL (folder 3, @papanca.io — F1)

Pure white `#FFFFFF`. Centred high-contrast didone/transitional serif headline, 3 lines,
**exactly one line set in italic** ("*unstoppable*"). B&W cutout of a person, bottom-anchored,
occupying the lower ~55%, silhouette breathing into the type's negative space.
Handle `@papanca.io` bottom-left in a neutral grotesk; `→` bottom-right.
Interior: serif index numeral on its own line ("3.") → serif sub-head → **justified**
grotesk body in blank-line-separated stanzas → a single centred emoji as a visual full stop.
Measured: L=R=108px, B=96px, chromaticFrac ≈ 0.00–0.03.

### ★ A2 — CUTOUT-SPORT (folder 13 — F2)

Pure white. Heavy expanded-grotesk **italic** headline, 2 lines, second line ~1.5× the
first and set in the accent (`#FC7F34`). Desaturated cutout positioned so its extremity
(a shoe) **crosses the headline's cap-height** — the overlap is the whole idea.
Small italic subline under the headline. Interior: headline top-left, one word in accent
italic, italic body in short stanzas, cutout bleeding off the right and bottom edges.
Final slide: pure white, black line + **grey** line, tiny centred logo mark, zero accent.

### ★ A3 — POSTER-CHARACTER (folder 1 & 2 Bedrock Form, GYM-1 Obsidian Form — F3)

Bone `#F1E9DE`. Wordmark lockup **top-left** (circular glyph + heavy condensed caps).
Headline: 2–3 lines of ultra-condensed heavy caps, **negative leading** (lines nearly
touching), **two-tone** — line 1 ink, line 2 accent, optional line 3 in a desaturated
tint of the accent (`#7A4A2E` brown). Soft drop shadow, offset ≈ +4/+5px, low opacity.
A **recurring signature character** — same figure, same treatment, every slide — bottom
centre, feet on the baseline, overlapping the headline's descender zone.
Obsidian Form's variant adds **left-to-right gradient-filled letters** (ink → brown)
and letterspaced micro-caps as furniture. The closer stacks `FOLLOW / FOR / MORE` with
the middle word in accent, a hairline rule, letterspaced `S A V E  T H I S  F O R  L A T E R`,
and a **ghost echo of the character at ~8% opacity** behind the live one.

### ★ A4 — TYPE-MONO (folder 4, @whymattrs — F4)

Pure white, **JetBrains-Mono-class monospace only**, centred, no imagery.
Index + title line in **grey**, body in black, `→` used as a literal bullet prefix.
Handle bottom-centre in grey mono, B=115px exactly. Enormous negative space: the p90
top margin here is 705px — over half the canvas empty on the closer.
Note the cover is *not* mono: it is a photo + heavy grotesk. **The set deliberately
switches archetype between cover and interior.**

### ★ A5 — TYPE-BOLD (folder 12 — F5)

Ink `#0D0D0D`–`#161616`, chroma ≈ 0.0–0.1. Small letterspaced brand caps top-centre.
Headline in heavy geometric caps, near-white, 3 lines, tight leading. Body in a lighter
weight, ~⅓ the headline size, generous leading. Zero accent — the whole set measures
`chromaticFrac < 0.003` on 11 of 16 slides.

### Additional archetypes observed (not requested, but they inform the furniture rules)

- **A6 PHOTO-EDITORIAL** (Random-1 @growithalex): full-bleed graded photo; **three-point
  top rail** — date left / handle centre / role right; headline is a *mixed-typeface
  lockup* where a huge didone italic overlaps a small grotesk word above it.
- **A7 CINEMATIC-POSTER** (folder 10): dark graded photo, vertical white→grey gradient
  fill on the headline, second line accent oblique, letterspaced kicker mixing white and
  accent words, `SWIPE ▶` bottom-centre, slide counter `5/10` top-right in accent.
- **A8 LOUD-GRADIENT** (folders 7, 9): white or dark plate, ultra-condensed caps with one
  word in a two-stop gradient, rounded pill chips, hairline-stroked cards.
- **A9 GRID-PAPER** (folder 6 @financialhotgirl): warm blush plate with a faint ruled
  grid texture; centred serif; italic accent line sitting on a torn-edge highlighter swatch.
- **A10 CLINICAL** (folder 11 Dr. Longevity): white, serif headline with the **numeral**
  in accent, italic middle line, grotesk body with bolded key phrases, wordmark + credential
  rule bottom-right.
- **A11 SPEC-SHEET** (GYM-1 interior): ink plate, letterspaced eyebrow + hairline rule,
  gradient-filled condensed caps, mono right-column, accent chevron list.
- **A12 UGC-NATIVE** (GYM-2): raw phone photos, white sans overlay, no furniture at all.
- **A13 POSTER-REFLECTION** (folder 5 pro.fit): 5 lines of condensed caps filling the
  frame edge-to-edge with a **mirrored reflection** of the last line beneath it.

## 6. Hook phrasing — exact word counts on slide 1

| Set | Slide-1 primary headline | Words | Kicker/subline | Words |
|---|---|---|---|---|
| 1 | HIT EVERY MUSCLE | 3 | with ZERO equipment 🔥 | 3 |
| 2 | THE 7-DAY CALISTHENICS PROGRAM | 4 | zero equipment needed 🔥 | 3 |
| 3 | lazy habits that make athletes unstoppable | **6** | — | — |
| 4 | 5 financial rules you should know by 30 | **8** | (simple) annotation | 1 |
| 5 | HOW TO MAKE YOUR CAROUSEL DESIGNS LOOK PRO | **8** | — | — |
| 6 | How To Get So Financially Literate It Feels Illegal | 9 | — | — |
| 7 | THE ART OF VIRAL CAROUSELS | **5** | — | — |
| 8 | 4 TYPES of carousels that are going VIRAL IN 2026 | 10 | — | — |
| 9 | FITNESS CAROUSEL | 2 | HOW I DESIGN MY CLIENT'S | 5 |
| 10 | IF I RAN THE UFC | **5** | 10 CHANGES I'D MAKE IMMEDIATELY | 5 |
| 11 | The 6 Golden Exercises | **4** | — | — |
| 12 | 6 NANO BANANA PROMPTS | **4** | not shot, but sculpted. | 4 |
| 13 | side effects of running | **4** | nobody warned you about | 4 |
| GYM-1 | BEAST HOME WORKOUT | 3 | For Maximum Muscle Growth | 4 |
| GYM-2 | 6 things I wish I new before I started lifting | 10 | — | — |
| Rand-1 | best font Pairings | 3 | — | — |
| Rand-2 | Balding | 1 | (Shampoo Everyday) | 2 |

**Median primary headline = 4 words. Median headline + kicker = 7 words.**
Range 1–10. The 4–8 word rubric band captures 12 of 17.

Recurring hook typologies, with corpus instances:

1. **SIDE-EFFECT** — "side effects of running *nobody warned you about*"; "Nobody warned me running would do all of this"
2. **LAZY/EFFORTLESS** — "*lazy* habits that make athletes unstoppable"
3. **NUMBERED-AUTHORITY** — "5 financial rules you should know by 30"; "The 6 Golden Exercises"; "10 changes I'd make"
4. **CONTRARIAN-NEGATION** — "You're not ugly. You're just…"; "not shot, but sculpted"
5. **CONFESSION / RECEIPT** — "6 things I wish I knew before I started lifting"; "From someone who has made 2500+ carousels"
6. **HYPOTHETICAL** — "If I ran the UFC…"
7. **STATUS-THREAT** — "Most brands are still posting the same carousel and wondering why growth has slowed"

Craft notes measured across covers:

- **Lowercase covers exist and perform** (folders 3, 13). Not everything is caps.
- The hook is almost never a complete sentence; it is a noun phrase with a **twist tail**
  ("…nobody warned you about", "…it feels illegal", "…by 30").
- **Exactly one word carries the emphasis** — italic, accent colour, or scale — never two.

## 7. Type pairings, weights, and where the accent lands

| Archetype | Display face (class) | Body face (class) | Accent lands on |
|---|---|---|---|
| A1 CUTOUT-EDITORIAL | high-contrast serif, regular + **italic** | neutral grotesk 400/700, justified | the **italic line** (colour stays black) |
| A2 CUTOUT-SPORT | expanded grotesk 800 **italic** | same family, 400 italic | **one whole line**, the larger of two |
| A3 POSTER-CHARACTER | ultra-condensed grotesk 900 caps | grotesk 600–700 | **line 2 of 3** |
| A4 TYPE-MONO | monospace 500 | monospace 400 | none — grey is the accent |
| A5 TYPE-BOLD | geometric grotesk 800–900 caps | grotesk 400, light grey | none |
| A6 PHOTO-EDITORIAL | didone italic + grotesk 700 lockup | grotesk 600 | a small inline **chip** |
| A10 CLINICAL | transitional serif + italic | grotesk 400 with **bold phrases** | the **numeral** |

Universal rules extracted:

1. **Exactly two type families per slide.** Every slide in the corpus uses one display
   and one text face. The only third face is a monospace used *as furniture*.
2. **The accent lands on precisely one target**: one line, one word, one numeral, or one chip.
   Never scattered across a paragraph.
3. **Body copy is stanza-broken**, not paragraph-flowed. Blank lines between 1–3 line groups.
4. **Emphasis inside body copy is weight, not colour** (Dr. Longevity's bolded "major muscle group").
5. Interior headlines are **35–55% of the cover headline's size**. Nothing on an interior
   slide competes with the cover.

## 8. How subjects are cut out and how they interact with type

- **Grade:** B&W (folder 3), desaturated-with-one-colour-retained (folder 13 — the runner
  is greyscale but the shoes hold `#FC7F34`, which is *the same hue as the accent type*),
  or chrome/obsidian rendered (Obsidian Form). Measured: folder 3's cutout slides read
  `chromaticFrac ≈ 0.000` — the cutout contributes **zero** chroma. The subject is
  colour-neutral so the accent can be the only colour event on the slide.
- **Anchor:** bottom-centre (A1, A3), bottom-right bleeding off two edges (A2), or
  bottom bleeding off one edge (A6, A13).
- **Overlap:** deliberate and measured. The runner's shoe in folder 13 crosses the
  headline's cap-height by roughly 35–45px. Bedrock's character head enters the headline's
  descender band. In every case the subject sits **behind** the type in z-order but
  **above** the background — layer 2 of 4, exactly as the layer model specifies.
- **Contact shadow:** Bedrock's character casts a soft elliptical shadow on the plate.
  Obsidian's does not. Presence of a contact shadow is what makes the figure feel *placed*
  rather than *pasted*.
- **Scale:** the subject occupies 45–65% of canvas height on covers, 25–40% on interiors.

## 9. Furniture — what appears on every slide

Counting furniture presence across all 145 slides:

| Element | Sets using it | Placement |
|---|---|---|
| **@handle** | 11/17 | bottom-left (3, 5, 8) · bottom-centre (4) · top-centre (7, 9) · top-right (6) |
| **wordmark** | 8/17 | top-left (Bedrock, Obsidian) · top-centre (12) · bottom-right (11) · bottom-centre (7) |
| **→ arrow** | 6/17 | bottom-right, always |
| **slide index** | 4/17 | bottom-right `01` (5) · top-right `5/10` (10) · bottom micro-rail `01 02 … NEXT` (Rand-1) |
| **save/CTA chip** | 5/17 | bottom-centre "save for later" (8) · bottom-right "SAVE FOR LATER" (4) · "SWIPE ▶" (10) |
| **hairline rule** | 5/17 | under headline (Bedrock, Obsidian, GYM-1) |

**The single most consistent structural fact: the furniture rail is fixed for the whole
set and never moves between slides.** Folder 3 places `@papanca.io` at exactly the same
(108, y−96) coordinate on all 8 interior slides. Folder 8 runs an identical three-point
bottom rail — handle left / "save for later" centre / long arrow right — on all 7 slides.

Corpus caveat worth naming: **folder 3 and folder 13 both DROP the handle on the final
slide.** The campaign rule ("@drift.sleep on every slide") is therefore *stricter* than
the corpus. That's fine — it is a brand requirement, and it costs nothing.

## 10. What the final slide always does

All 17 closers were examined. Every one does at least three of these five:

1. **Drops the accent.** Mean accent share falls from 10.7% (cover) to 5.8% (closer).
   Folder 13's closer measures exactly 0.0% chroma. Folder 3's falls to 1.6%.
2. **Names one CTA verb.** Measured verbs: *follow* (13, 4, Bedrock, Obsidian),
   *comment* (3, 7, 8, 6), *save* (4, 5, Obsidian, 8), *swipe*/*learn more* (10, 7).
   The verb is always the largest or the only coloured word on the slide.
3. **Increases negative space dramatically.** Folder 4's closer has a 705px top margin
   and a single line of text. Folder 13's closer is two short lines on pure white.
4. **Restates the brand.** Wordmark, logo mark, or handle — enlarged relative to interiors,
   or moved to centre.
5. **Softens the voice.** Grey replaces black (13, 4). Italic replaces roman (8).
   ":)" appears (4). The closer is the only slide allowed to be gentle.

The failure mode the corpus avoids: **no closer is a wall of text.** The closer has the
*lowest* word count of any slide in 14 of 17 sets.

---

## 11. Direct implications for the engine

1. Default to **flat plates**, not photos. 89% of the corpus. Photos are an exception path.
2. **One accent, held for the whole set**, at 5–11% pixel coverage, decaying toward the closer.
3. **Grade cutouts to neutral** so the accent is the only chroma on the slide. If a photo
   plate is used, **duotone it into the accent's own hue** so it merges into one cluster
   rather than adding a second.
4. **Furniture coordinates are set-level constants**, computed once, reused on every slide.
5. **Text volume must decay** — cover ≤ 8 words, interiors 25–60 words, closer ≤ 15 words.
6. **Exactly one emphasis target per slide.** The template must declare where it lands.
7. **Negative leading on stacked caps** (0.82–0.90 of the point size) is what makes A3/A5
   read as posters instead of as slides.
8. **Subject overlaps type by 30–50px** and sits behind it. Overlap is a template parameter,
   not an accident.
9. Interior headline size = **35–55%** of the cover headline size.
10. The closer is a *different layout*, not the same layout with different words.
