# GAUNTLET.md

Automated harness: `node gauntlet/run.mjs --round N [--n 10] [--strict T]`
Every round generates **10 fresh carousels with fresh seeds** (`campaignId` is
salted with the round number), scores the 60 automated points in code, and builds
one contact sheet + one 200px thumbnail strip per carousel for the vision pass.
Reports: `gauntlet/rounds/rN/report.json`. Output: `output/round-N/`.

Rubric = 60 automated + 40 vision-judged. PASS = ≥85/100 on fresh output for 3
consecutive rounds, with a hard floor of 8 rounds.

Scores below are honest. Where a round regressed, it says so.

| Round | Auto /60 | Vision /40 | Total /100 | Strict tier | Verdict |
|---|---|---|---|---|---|
| 1 | 52.50 | 21 | **73.5** | 0 | Renders end-to-end; three systemic defects |
| 2 | 57.30 | 28 | **85.3** | 0 | First pass — so the rubric gets tightened from round 3 |

---

## Round 1 — baseline

`node gauntlet/run.mjs --round 1 --n 10`
Family mix: CUTOUT-SPORT 2, POSTER-CHARACTER 3, TYPE-MONO 2, CUTOUT-EDITORIAL 2, TYPE-BOLD 1
Accent mix: A(amber) 7, B(blue) 3 · Render errors: 0 · Fingerprint collisions: 0

### Automated — 52.50 / 60

| Check | Lost | Note |
|---|---|---|
| canvas | 0 | 10/10 carousels, every slide exactly 1080×1440 |
| overflow | 20 | F2 only — type ink escaping the safe box on the left |
| collision | 0 | no type-slot overlaps in 78 slides |
| safe | 0 | — |
| hook-words | 0 | every cover headline landed in 4–8 words |
| **volume-decay** | **30** | 10/10 carousels: slide 1 is not the lowest word count |
| **one-accent** | **25** | amber leaking into blue sets; plus a measurement bug |
| furniture | 0 | handle on 100% of slides |
| cta | 0 | CTA verb on 10/10 closers |

### Vision — 21 / 40

Read all 10 contact sheets and 2 thumbnail strips at 200px.

| Criterion | Score | Reasoning |
|---|---|---|
| hook stops the scroll | 6/10 | The *copy* is corpus-grade ("you are not tired / you are under-slept in a way you cannot feel"). The *visual* hook is not: F4's cover has almost no scale contrast, F1's cover puts a flat black silhouette behind grey body text, F2's cover figure floats above the headline without touching it. |
| readable at 200px | 6/10 | F3, F5 and F2 hold hierarchy at thumbnail size. **F4 fails outright** — its mono cover is uniform grey mush at scroll size. Corpus note: @whymattrs deliberately switches archetype for the cover for exactly this reason; I did not. |
| overlap reads intentional | 2/5 | F2's cover has *zero* overlap. F3's interior figures are sliced flat by the right canvas edge — reads as a crop bug, not a bleed. F1's data objects sit in dead space and read as filler. |
| grade coherent, single accent | 2/5 | Hard fail: amber objects on blue carousels (f1-p05-B, f2-p00-B). Otherwise the plates are clean. |
| style/character consistency | 3/5 | F3's character genuinely recurs and holds its silhouette treatment — the mechanism works. But pose repetition and edge-slicing undercut it, and F1/F2 interiors are structurally identical slide to slide with no rhythm. |
| holistic — millions of views | 2/5 | Competent typography and good copy, but static compositions. Nothing on any interior slide earns a second look. |

### Reference diff — corpus vs best output

Best output this round: **f5-p07-A** (TYPE-BOLD). Compared against folder 12,
folder 3 (@papanca.io) and folder 13:

- **Theirs varies the interior; mine does not.** Folder 12 runs full-bleed photo
  plates between type slides. Folder 3 changes body length and drops the graphic
  on some interiors. Every one of my interiors is the same skeleton with different words.
- **Theirs lets the subject touch the type.** Folder 13's shoe crosses the headline
  cap-height by 35–45px. My F2 cover has the figure ending 40px *above* the headline.
- **Their accent moves.** Folder 1 puts red on line 2 of the headline, then on a chip,
  then on a muscle group. Mine puts the accent in the same slot on every slide.
- **Their closers use the whole canvas.** Folder 4's closer is one line with a 705px
  top margin. Mine centre a small block and leave the rest empty without intent.

### Top 3 failure modes, ranked by cost

1. **Accent cross-contamination (≈28 pts: 25 auto + 3 vision).**
   Two independent causes. (a) The data-object subjects are PNGs baked with
   `#FFB020`; `grade: none` preserves that amber, so a blue carousel renders amber
   dials. (b) The set-consistency test compares raw 20° hue-bin labels, and
   `#FFB020` sits at hue ≈75 — right on the h60/h80 boundary — so anti-aliased
   edges scatter across two bins and a perfectly consistent set reports as spanning two hues.
2. **Word-count model counts unrendered copy (30 pts).**
   `wordCount` summed every content field on a slide. Templates render a *subset*:
   F1's cover never draws `eyebrow`, F5's cover reuses `kicker` as an eyebrow. The
   cover was being charged for words the viewer never sees.
3. **Italic left overhang escapes the safe box (20 pts).**
   `layoutWidth` correctly *measures* ink that overhangs the advance box, but the
   block is still painted with its glyph origin at `box.x`, so Archivo Expanded 800
   italic paints ~8px to the left of the safe edge. Measured, not guessed: the type
   layer's real ink bbox starts at x=68 against a safe left of 76.

### Fixes applied

1. **Data objects became procedural** (`engine/subjects.mjs`). The dial, hypnogram,
   moon and bed are now generated as SVG at render time from the live palette, so
   an accent-B carousel cannot contain an amber pixel. The baked PNGs were deleted
   from the pool. *(root cause: assets carrying colour)*
2. **Set-hue comparison uses circular distance** (`gauntlet/pixels.mjs`,
   `checks.mjs`). Each slide gets a chroma-weighted mean hue; the set passes when
   the maximum pairwise circular distance is ≤40°. Bin-boundary scatter no longer
   reads as a second accent. *(root cause: the measurement, not the output)*
3. **Word count is computed from rendered slots** (`engine/layout.mjs` returns
   `renderedWords`; `checks.mjs` uses it). *(root cause: model/render mismatch)*
4. **Ink-accurate block placement** (`engine/fit-text.mjs`, `layout.mjs`). `fitText`
   now returns `inkLeft`/`inkRight` and a `paintedHeight` derived from the face's
   real ascender/descender, and layout offsets the painted block so ink starts at
   the box edge. Collision and safe-area checks now run on painted extents rather
   than layout boxes — strictly harder than before.
5. **F3 figures no longer slice on the right edge**; interior subject anchors moved
   inboard and the character is given real room.

**Verdict: not close.** Renders reliably, copy is strong, three systemic defects
found and fixed at root cause. The vision score is the real problem — compositions
are static and the subject layer reads as filler rather than as design.


---

## Round 2 — after the round-1 root-cause fixes

`node gauntlet/run.mjs --round 2 --n 10`
Render errors: 0 · Fingerprint collisions: **1** (f2-p02-B + f2-p09-B)
Family mix: CUTOUT-SPORT **6**, TYPE-MONO 3, TYPE-BOLD 1, CUTOUT-EDITORIAL **0**, POSTER-CHARACTER **0**
Accent mix: B **8**, A 2

### Automated — 57.30 / 60  (+4.80)

| Check | Lost | Note |
|---|---|---|
| canvas / collision / safe / hook-words / furniture / cta | 0 | clean |
| overflow | **0** (was 20) | ink-accurate block placement closed it; the pixel corroboration now passes on every slide |
| one-accent | **0** (was 25) | procedural subjects + circular-hue comparison; one carousel scored a clean 60/60 |
| volume-decay | 27 | still failing — but for a *different* reason than round 1 |

The volume-decay failure changed character, which is the useful part. Round 1 was
counting words the templates never drew. Round 2 counts only rendered words, and
now says something true: **my closers are terser than my covers.** F2's closer
renders 8 words against a 9-word cover. The corpus is the other way round —
folder 3 closes on ~12 words against a 6-word cover, folder 13 on 10 against 8.

### Vision — 28 / 40  (+7)

| Criterion | R1 | R2 | Reasoning |
|---|---|---|---|
| hook stops the scroll | 6 | **7** | F2's cover now works: the figure's foot crosses down through the headline's cap-height, which is the folder-13 move. F4's cover finally has scale contrast. Covers still leave a soft void under the type. |
| readable at 200px | 6 | **8** | F2 and F4 both hold hierarchy at scroll size. The `-13 pts` stat variant is legible at 200px, which is the point of it. |
| overlap intentional | 2 | **3** | Cover overlap is fixed and reads deliberate. Cost: wide objects (`stage-bar`, `rings`) sliced flat by the frame — a crop bug, not a bleed. |
| grade coherent | 2 | **4** | Single accent throughout, both hues. `stage-bar`'s grey segments are muddy against amber. |
| consistency | 3 | **3** | Within a set it holds. Across the *batch* it does not: six of ten carousels were CUTOUT-SPORT and two families never appeared at all. |
| holistic | 2 | **3** | f2-p06-A is the first output I would not immediately spot as generated. The rest are still static. |

### Reference diff — corpus vs best output

Best this round: **f2-p06-A** (CUTOUT-SPORT, 10 slides, amber). Against folder 13:

- Theirs keeps the cutout on *interior* slides too, bleeding off the right and
  bottom. Mine drops the figure entirely after the cover and substitutes data objects.
- Theirs varies where the accent lands (whole line → one word → a shoe). Mine puts
  it on the last word of every interior headline without exception.
- Theirs earns its white space — the figure anchors the composition so the empty
  area reads as air. Several of my interiors have empty area with nothing anchoring it.

### Top 3 failure modes, ranked by cost

1. **Closers terser than covers (27 pts).** Root cause: the closer copy bank was
   written at 6–9 words. The corpus writes closers at 9–14: a CTA verb plus one reason.
2. **Divergence was sampled, not stratified (vision consistency + 1 fingerprint
   collision).** Independent draws over 5 families gave 6/10 to one family and 0/10
   to two others. This is also a product defect: an account would post the same
   layout six times running.
3. **Wide objects sliced by the frame (vision overlap).** `heightPct` scaled by
   height only, so a 900×210 stage bar at 0.19 came out 1174px wide on a 1080 canvas.

### Fixes applied

1. **Closer bank rewritten to 9–14 words** — CTA verb plus a reason, matching the
   corpus shape, so the cover is genuinely the quietest slide.
2. **Stratified divergence** (`engine/index.mjs`). Family and accent are now drawn
   from a seeded *permutation* walked by post index: 10 posts give exactly 2 of each
   family and 5 of each accent, and every family appears before any repeats.
3. **Subject width clamp** (`maxWidthPct`, default 0.72). Scale by height, then clamp
   by width — no object can be wider than the frame it sits in.
4. **`hypnogram-flat` made visibly flat** — it was near-identical to `hypnogram`, so
   two interiors in one set read as a duplicate.

**Verdict: first pass at 85.3.** Per the protocol, passing before round 8 means the
rubric is too soft, not that the work is done. Round 3 runs at **strict tier 1**,
which adds two corpus-derived checks the base 60 never made: accent coverage must
decay toward the CTA (10.7% → 9.0% → 5.8% in the corpus), and interior headlines
must stay at or under 72% of the cover headline's size.
