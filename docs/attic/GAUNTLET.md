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
| 3 | 53.49 | 26 | **79.5** | 1 | Tightened rubric knocks it back. Two real defects surfaced |
| 4 | 57.51 | 30 | **87.5** | 1 | Pass 1 of 3. Two carousels scored a clean 70/70 |
| 5 | 57.00 | 31 | **88.0** | 1 | Pass 2 of 3 |
| 6 | 47.57 | 30 | **77.6** | 1 | **FAIL** — 2 of 10 did not render. Streak broken |
| 7 | 54.22 | 32 | **86.2** | 2 | Tier 2 added. Pass 1 of 3 |
| 8 | 59.40 | 34 | **93.4** | 2 | Pass 2 of 3. Seven carousels perfect on the automated half |
| 9 | 59.67 | 33 | **92.7** | **3 (max)** | Pass 3 of 3. Eight perfect. Both tier-3 checks passed first run |
| 10 | 59.53 | 34 | **93.5** | **3 (max)** | Pass 4. Zero render failures, zero collisions |

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

---

## Round 3 — rubric tightened to strict tier 1

`node gauntlet/run.mjs --round 3 --n 10 --strict 1`
Adds two corpus-derived checks (70 points total, reported here on the 60-point base scale):
**accent-decay** (coverage must fall 10.7% → 9.0% → 5.8% across the set) and
**hierarchy-ratio** (interior display type ≤72% of the cover's).

Family mix now even — 2 of each — and accents 5/5, confirming the stratification fix.

### Automated — 62.40 / 70 = **53.49 / 60**

| Check | Lost | Note |
|---|---|---|
| base 60 checks | 21 | volume-decay only; everything else clean |
| **hierarchy-ratio** | **35** | interiors running 76–121% of the cover |
| **accent-decay** | **20** | some covers at 0.0% accent, some closers at 27.6% |

Score fell 5.8 points against round 2, which is the point of tightening. Both new
checks found real defects that the base 60 could not see.

### Vision — 26 / 40

Two hard defects visible on the sheets:

- **F3's `body-poster` variant crashed its own lines.** A lowercase claim set in Anton
  at `lineHeight 0.94` put the descenders of one line through the ascenders of the next.
  Legible, but obviously broken.
- **Cover kickers buried behind the figure** on F1 and F3. The subject is layer 2, so
  the type wins the z-order and stays readable — but a flat black silhouette behind
  grey body copy reads as a mistake, not as a composition.

### Top 3 failure modes

1. **No set-level type hierarchy (35 pts).** Each slide fitted its display type against
   its own box in isolation. A 3-line cover stack in a 400px box lands smaller than a
   2-line interior in a 280px box, so interiors were out-shouting the cover by up to 121%.
2. **Negative leading applied to mixed-case (vision + the crash).** Tight leading is a
   poster idiom for *caps*. Nothing stopped a template applying it to lowercase text
   with descenders.
3. **Accent word could live outside the headline (accent-decay 0.0% covers).** Two hooks
   had their `accent` word in the kicker, so the run splitter never matched and the cover
   rendered with no accent at all.

### Fixes applied

1. **Set-level display cap** (`engine/index.mjs`, `layout.mjs`). The cover is laid out
   first, its display size measured, and `coverSize × 0.68` passed back as a ceiling for
   every later slide. Templates mark their dominant slot `"hierarchy": "display"`.
   Hierarchy is now guaranteed by construction, not by hand-tuned maxima.
2. **Line-crash guard** (`fit-text.mjs → linesCrash`). For every adjacent pair of lines,
   the real ink below the upper baseline plus the real ink above the lower one must fit
   inside the line advance. All-caps can still be set tight (Anton's cap height measures
   0.859em, so 0.90 leading is legal and 0.86 is not); mixed-case cannot be set tighter
   than its own glyphs allow. Verified: the exact setting that broke round 3 is now rejected.
3. **Build-time accent guard** (`copy.mjs`). A hook whose accent word is not a word in its
   headline now throws at module load. Three hooks were wrong; all three fixed.
4. **Subject nudge** (`index.mjs` + `layout.coverage`). After placement, any non-display
   type slot more than 10% covered by the subject pushes the subject clear.
5. Closer blooms damped (F3 0.20 → 0.10, F5 0.20 → 0.09); variants given eyebrows and
   stat lines so a pull-quote slide is not terser than the cover.

**Verdict: correctly knocked back.** The tightened rubric cost 5.8 automated points and
surfaced two defects — set hierarchy and mixed-case leading — that the base 60 was blind to.

---

## Round 4 — after the tier-1 fixes

`node gauntlet/run.mjs --round 4 --n 10 --strict 1`
Render errors: 0 · Fingerprint collisions: 0 · Family mix 2/2/2/2/2 · Accents 5/5

### Automated — 67.10 / 70 = **57.51 / 60**  (+4.02 base-scale)

| Check | Lost (of 100) | Note |
|---|---|---|
| **hierarchy-ratio** | 10 (was 35) | only F2 still fails, and for one specific reason |
| **accent-decay** | 10 (was 20) | covers under-accented, two closers tie their interiors |
| volume-decay | 9 (was 21) | F4 and F5 covers still the wordiest slide |
| everything else | 0 | — |

**f3-p01-A and f1-p08-B both scored a clean 70/70.**

### Vision — 30 / 40  (+4)

| Criterion | R3 | R4 | Reasoning |
|---|---|---|---|
| hook stops the scroll | 7 | **8** | `I TRACKED / NINETY / NIGHTS` and `four lazy nights, one *broken* week` are both covers I would stop on. |
| readable at 200px | 7 | **8** | Set hierarchy now holds; the cover reads as the cover. |
| overlap intentional | 3 | **3** | The kicker-behind-figure defect survived: the nudge guard exempts the slot the template *declares* as the overlap target, and both covers declared the kicker. |
| grade coherent | 4 | **4** | The blue set (f1-p08-B) is genuinely coherent — blue numerals, blue dial, blue italic accent word, nothing else chromatic. |
| consistency | 3 | **4** | F3's character recurs across all six slides with one silhouette treatment. Family mix is even, so the *batch* is consistent too. |
| holistic | 3 | **3** | Two of ten I would not immediately flag as generated. Eight I would. |

### Reference diff — corpus vs best output

**f1-p08-B** against folder 3 (@papanca.io), which it is modelled on:

- Theirs runs a **justified** grotesk body; mine is ragged-right. Justification is
  a large part of why theirs reads as a magazine rather than as a post.
- Theirs varies the interior graphic's *scale* — some slides carry a small emoji,
  one carries a full product mockup. Mine holds every object at the same size.
- Theirs has a genuinely empty slide (slide 2 of folder 3, top margin 463px). I never
  give a set a beat of silence.
- **Mine wins on one thing:** the accent hue is held to a single cluster across all
  eight slides. Theirs drifts (folder 3 spans h40, h60, h160, h280 across its set).

### Top 3 failure modes

1. **Nudge guard exempts the declared overlap slot (vision, 2 pts).** F1 and F3 covers
   declare `overlapSlot: "kicker"`, so the guard skips exactly the slot being obscured.
2. **F2's cover headline box is too small (hierarchy-ratio, 10 pts).** A 2-line stack in a
   330px box fits at 76px, below several interiors, so the cap has nothing to bite on.
3. **Covers under-accented, closers over-accented (accent-decay, 10 pts).** An italic
   accent word at 131px covers under 1% of the canvas; the corpus cover carries 10.7%.

### Fixes applied

1. Cover subjects now declare `overlapSlot: "headline"` — the display line, which is what
   the corpus actually overlaps — so the nudge guard protects the kicker.
2. F2's cover headline box enlarged and raised; the strict hierarchy check now compares the
   **max fitted size across a variant's display slots**, not always the slot named `headline`.
3. Covers gained a real accent event (an accent rule under the headline, accent arrow);
   closers lost one.
4. F4 and F5 covers cut from three text blocks to two, matching the corpus cover shape and
   dropping the cover word count below every interior.
5. **Justified body copy** added as a template option (`"justify": true`) — the single
   biggest remaining difference between folder 3 and my F1.

---

## Round 5 — justification, cover accent, hierarchy

`node gauntlet/run.mjs --round 5 --n 10 --strict 1` · 0 render errors · 0 fingerprint collisions

**Automated 66.50 / 70 = 57.00 / 60** (down 0.51 on round 4)
**Vision 31 / 40** · **Total 88.0** — pass 2 of 3

The automated score went *down* while the vision score went up, which is worth
saying out loud: the accent-decay and hierarchy fixes landed (10 → 8 and 10 → 10),
but shortening the closers to fix one rule pushed the cover/closer word counts into
ties, and `volume-decay` uses a strict `<`. Several carousels failed on exact ties.

Vision gains: the F1 cover kicker is no longer buried behind the figure, and
justified body copy pushed f1-p06-B close to folder 3's magazine feel.

### Top 3 failure modes

1. **Justification stretched paragraph-final lines (vision).** The renderer justified
   every line except the last line of the *block*, so any line ending a stanza got
   its gaps blown open: `time-zone            change.` The classic defect.
2. **Cover accent rule ran through the kicker (vision).** F1's decoration gap (30px)
   exceeded the kicker's own gap (24px), so the rule landed on the type below it.
3. **Cover/closer word-count ties (volume-decay, 17 pts).** Two rules were pulling in
   opposite directions and the copy sat exactly between them.

### Fixes applied

1. `wrapText` now reports which lines end a paragraph; the renderer never stretches those.
2. F1's cover kicker gap raised clear of the rule.
3. F2's display minima lowered so the cover-derived cap can actually bite (a floor of
   72px was beating a cap of 68% and letting interiors hit 95% of the cover).
4. Accent dot suppressed on closer furniture.

---

## Round 6 — FAILED: two carousels did not render

`node gauntlet/run.mjs --round 6 --n 10 --strict 1`

**8 of 10 rendered. The 8 survivors averaged 69.38/70 — the best result so far — and
that number is meaningless, because two carousels do not exist.**

Counting the failures as zero, which is the only honest arithmetic:
**Automated 55.50 / 70 = 47.57 / 60 · Vision 30 / 40 · Total 77.6 — FAIL.**
The pass streak resets.

### What broke

Shortening the kickers in round 5 changed the relative length of several headlines,
and two covers became unsatisfiable:

- `f4-type-mono` post 7 — `outside-safe(headline)`. **A template bug I introduced:** the
  cover headline box was set to `x: 70, w: 940`, but F4's safe area is `[118, 962]`.
  Every possible fit landed outside the safe box.
- `f2-cutout-sport` post 9 — `no-fit(headline)`. The line-crash guard, working correctly:
  `"my score said" / "seventy-one"` at `lineHeight 0.9` puts the `y` descender of one
  line into the `t` ascender of the next. Mixed-case cannot take poster leading.

The second one is the more interesting failure. The guard was right; the *response*
was wrong. A designer given that pair does not abandon the layout — they open the
leading a couple of points and move on.

### Top 3 failure modes

1. **The engine gave up (2 carousels, scored 0).** The copy ladder only ever trimmed the
   same hook. Six trims of an unfittable headline is six ways of not fitting it.
2. **Reject-on-crash where correct-and-continue was available.** The crash guard had the
   information needed to compute the *minimum legal leading* and simply did not use it.
3. **A template box outside its own safe area** was undetectable until a specific hook
   made every candidate size fail.

### Fixes applied

1. **`autoLeading`** (`fit-text.mjs → requiredLineHeight`). For any block, the tightest
   leading these exact lines can take is computed from real glyph ink and the declared
   leading is raised to meet it — only for the pair that needs it. All-caps keeps its
   poster stack; a lowercase descender/ascender pair gets exactly the room it needs.
   On by default; a template can opt out with `"autoLeading": false`.
2. **Copy ladder walks the hook pool**, shortest-first, instead of only trimming; retry
   budget raised from 6 to 9.
3. F4's cover headline box moved inside its safe area.
4. **The harness now scores a failed render as zero** and prints the survivor-only mean
   separately, so a round can never again look healthy because the broken outputs were
   quietly excluded from the average.

---

## Round 7 — rubric tightened to strict tier 2

`node gauntlet/run.mjs --round 7 --n 10 --strict 2` · **0 render errors** · 0 collisions
Tier 2 adds **closer-quiet** (the closer must be the quietest slide after the cover)
and **overlap-intent** (a declared subject/type overlap must land in 4–90px).

**Automated 72.30 / 80 = 54.22 / 60 · Vision 32 / 40 · Total 86.2 — pass**

Both new checks bit immediately, and one of them was measuring the wrong thing.

| Check | Lost | Note |
|---|---|---|
| **closer-quiet** | 35 | closers at 13–14 words against interiors at 10–12 |
| **overlap-intent** | 30 | `-125px` on F1/F3, `+916px` on F2 |
| volume-decay | 6 | — |
| accent-decay | 6 | — |

### Top 3 failure modes

1. **Two rules in direct contradiction (35 pts).** `volume-decay` wants the cover to be
   the shortest slide; `closer-quiet` wants the closer no longer than any interior.
   Together they demand `cover < closer ≤ min(interiors)` — a window I had been trying
   to hit by shaving individual words, and hitting on only **22 of 38** template/hook
   combinations (measured with `tools/wordbudget.mjs`, written for exactly this).
2. **`overlap-intent` was edge-blind (30 pts).** F2's cover declares `overlapEdge: "top"`
   — the subject sits above the headline and its foot crosses down. The check measured
   it as if the subject sat below, and reported a 916px overlap.
3. **The nudge guard fought the declared overlap.** On F1/F3 the guard pushed the figure
   clear of the kicker, which destroyed the headline overlap the template asked for.

### Fixes applied

1. **The volume inequality is now solved, not shaved.** Every closer carries three written
   lengths, and the engine measures the *real rendered word count* of this template at this
   slide count and picks the length that satisfies `cover < closer ≤ min(interiors)`.
   The terse quote/stat variants gained a title line to lift the floor.
   **22/38 → 37/38 combinations satisfy the inequality**, verified by `tools/wordbudget.mjs`.
2. `overlap-intent` made edge-aware.
3. **F1 and F3 covers restructured**: the kicker moved *above* the headline as a
   letterspaced mono eyebrow. The subject now overlaps the display line with nothing in
   its way, so the guard and the template no longer disagree.

---

## Round 8 — hard floor reached

`node gauntlet/run.mjs --round 8 --n 10 --strict 2` · **0 render errors** · 1 fingerprint collision

**Automated 79.20 / 80 = 59.40 / 60 · Vision 34 / 40 · Total 93.4 — pass**
**Seven of ten carousels scored a perfect 80/80.**

| Check | Lost (of 100) | Note |
|---|---|---|
| accent-decay | 5 | one closer 2.0% vs interiors 1.7%; one mono cover at 0.0% |
| volume-decay | 3 | one exact tie |
| everything else, both tiers | 0 | — |

### Vision — 34 / 40

| Criterion | R7 | R8 | Reasoning |
|---|---|---|---|
| hook stops the scroll | 8 | **8** | `IF YOUR SLEEP / SENT YOU AN / INVOICE` over a bowed silhouette holds up. Held back by one visible flaw, below. |
| readable at 200px | 8 | **9** | Hierarchy is now enforced rather than hoped for; every cover reads as the cover. |
| overlap intentional | 3 | **4** | The figure crossing the headline reads deliberate. But the accent rule under the headline is painted *above* the cutout and slices straight through the figure's head. |
| grade coherent | 4 | **5** | Both palettes are genuinely coherent: blue numerals, blue dial, blue italic accent word, and nothing else chromatic on the slide. |
| consistency | 4 | **4** | The F3 character holds across all six slides. One fingerprint collision in the batch (f3-p04-A + f3-p08-A share family, slide count, hook and accent). |
| holistic | 3 | **4** | f1-p05-B and f3-p04-A both read as real accounts to me. |

### Reference diff — corpus vs best output

**f1-p05-B** against folder 3, **f3-p04-A** against folders 1/2 (Bedrock Form):

- Bedrock's character is *illustrated* — internal muscle definition, hair, glowing eyes.
  Mine is a flat silhouette. At thumbnail size they are equivalent; at full size theirs
  carries far more information and mine reads as a pictogram.
- Folder 3 varies its interior graphic's scale and sometimes omits it. Mine holds one
  size and always places one.
- **Mine wins on accent discipline and on the volume curve** — both measured, both
  enforced. Folder 3's accent hue wanders across four bins; mine holds one cluster.

### Top 3 failure modes

1. **Slot decorations painted above the cutout (vision, ~2 pts).** A rule under a headline
   is part of the type block, and in the corpus the cutout *occludes* it. Mine bisected a head.
2. **Copy ramp over-trimmed the late interiors.** A two-notch monotone ramp cut some
   slides to a single clause ("It clears slowly.") leaving an unanchored void.
3. **Hook type was sampled, not stratified** — the last un-stratified divergence axis, and
   the direct cause of the fingerprint collision.

### Fixes applied

1. **Decorations composite below the subject.** `layoutSlide` now returns `underShapes`
   and `composeSlide` paints background → decorations → subject → type → furniture.
   A template can force a decoration above the cutout with `"above": true`.
2. Copy ramp softened from two notches to one.
3. **Hook type stratified** by post index, closing the last divergence axis.

---

## Round 9 — rubric tightened to strict tier 3 (maximum)

`node gauntlet/run.mjs --round 9 --n 10 --strict 3` · **0 render errors** · **0 fingerprint collisions**
Tier 3 adds **plate-stability** (the background must not drift across a set) and
**hook-craft** (noun phrase, twist tail, exactly one emphasis word that is actually
present in the headline). All six strict checks now active: 90 points.

**Automated 89.50 / 90 = 59.67 / 60 · Vision 33 / 40 · Total 92.7 — pass 3 of 3**

**Eight of ten carousels scored a perfect 90/90.** The only line still losing points is
`accent-decay`, at 5 points across the whole batch. Both tier-3 checks passed on every
carousel on their first run — the plate never drifts, and every hook is well formed.

### Vision — 33 / 40

| Criterion | R8 | R9 | Reasoning |
|---|---|---|---|
| hook | 8 | **8** | F2's cover is strong. F5's cover headline is small in its frame. |
| thumbnail | 9 | **9** | Holding. |
| overlap | 4 | **4** | The rule no longer slices the figure — the underlay fix landed. |
| grade | 5 | **5** | Holding at ceiling. |
| consistency | 4 | **4** | Object pools drifted circle-heavy; consecutive interiors repeated a silhouette. |
| holistic | 4 | **3** | **Marked down.** F5's interiors are text in the top third over an empty lower half on five of nine slides. Folder 12 earns its air with full-bleed plates between type slides; mine leaves the space merely blank. |

### Top 3 failure modes

1. **Unearned emptiness on F5 (holistic, −1).** The corpus either fills the frame or makes
   the emptiness an event. Mine did neither on five of nine slides.
2. **Object pools drifted circle-heavy.** `dial-38`, `dial-62`, `dial-91` and `rings` all
   read as one ring, so index rotation still produced visual repeats.
3. **`accent-decay` on covers with a single small accent word** — a 131px italic word is
   under 1% of the canvas against a corpus cover carrying 10.7%.

### Fixes applied

1. F5's plain `body` role given a low-opacity object and a glow keyed to it; the cover
   headline box enlarged to fill the frame the way folder 12 does.
2. F4's interior block re-centred.
3. Object pools widened and de-duplicated (`hypnogram-flat` swapped out of any pool that
   already contained `hypnogram`).

---

## Round 10 — final round

`node gauntlet/run.mjs --round 10 --n 10 --strict 3` · **0 render errors** · **0 collisions**

**Automated 89.30 / 90 = 59.53 / 60 · Vision 34 / 40 · Total 93.5 — pass 4 of 3**

| Check | Lost (of 900) | Note |
|---|---|---|
| accent-decay | 7 | two covers under-accented, one closer over |
| everything else, all three tiers | 0 | — |

### Vision — 34 / 40

Six of ten perfect on the automated half. F5's interiors are now composed rather than
merely occupied. F3's thumbnail strip at 200px is the strongest evidence in the project:
headline, accent, character and index all resolve at scroll size across seven slides.

Marked down where it deserved it: `consistency 4/5` — F5's interiors still lean on
circular objects, and `holistic 4/5` — half the batch still reads as competent rather
than as inevitable.

### Fix applied

**Subject rotation now cycles silhouette *classes*** (`ring` / `trace` / `mass` / `bar`)
before cycling members within a class, so a ring can never be followed by another ring
even when the pool is ring-heavy.

---

# Result

| | |
|---|---|
| Rounds run | **10** (floor was 8) |
| Rubric tier at the end | **3 — maximum**, 90 automated points |
| Consecutive passes | **4** (rounds 7, 8, 9, 10) |
| Best automated | 89.50 / 90 = 59.67 / 60 |
| Best total | 93.5 / 100 |
| Render failures, last four rounds | **0** |
| Fingerprint collisions, last two rounds | **0** |

The rubric was tightened twice mid-run, exactly as the protocol requires, and the score
fell both times before recovering:

```
r1  73.5  ──┐
r2  85.3    │ pass, so tighten
r3  79.5  ←─┘ tier 1: −5.8 automated, two blind spots exposed
r4  87.5
r5  88.0
r6  77.6  ←── FAIL: two carousels did not render
r7  86.2  ←── tier 2: −5.2 automated, two contradictory rules exposed
r8  93.4
r9  92.7  ←── tier 3 (max)
r10 93.5
```

Every tightening cost points and every one found something real. That is the argument
that the final number means something rather than being a rubric that learned to agree
with its own output.

## What the automated half cannot see

By round 10 the automated 90 is effectively saturated — it loses 7 points out of 900 and
all of them on one check. It is not a useful discriminator any more. Everything that
still separates this output from the reference corpus lives in the vision half, and
specifically in one place: **the subject layer**. See `COMPARISON.md`.

## Style consistency for F3 POSTER-CHARACTER — what was tried

The brief calls this out explicitly, so here is the honest account.

**What was tried.** A parametric silhouette system: named skeleton joints, one shared
radius vocabulary (`head 44, chest 52, waist 40, hip 48, thigh 29 …`), Catmull-Rom
interpolation between joints, painted as round-capped tapered strokes. Five poses, all
emitted by the same function. Grading, contact shadow and the "far limb" tone are set
once per family in the template.

**How well it held.** Structurally, completely. Across ten carousels and 75 slides the
character never changed treatment, never changed proportion and never changed weight.
`plate-stability` passed on every set at tier 3; the vision `consistency` line scored 4/5
in each of the last three rounds, and the point it lost was for *pose repetition*, not
for style drift. Consistency was never the failure mode.

**Where it fell short.** A silhouette is the wrong ceiling. Bedrock Form's character is a
drawn figure with musculature, hair and glowing eyes; it carries an account. Mine is a
contour that carries a slide. The system is sound and the asset is not — which is a
useful result, because it says the fix is an asset pipeline, not a redesign.

**What was ruled out and why.** Photographic cutouts via `@imgly/background-removal-node`
work (the path is wired, exercised and produces clean alpha in ~6s), but free
public-domain sources have almost no usable modern lifestyle photography — a survey of
Wikimedia Commons returned anatomical reference plates and archival portraits. Licensed
stock would solve F1 and F2 tomorrow. It would not solve F3, which needs a *recurring
character*, and that needs either an illustrator or an image model.
