# VERDICT.md

**The question:** can a deterministic engine plus a narrow generative assist match human
designers on Instagram/TikTok carousels?

**The answer:** **Yes on everything except the picture.** Ten rounds of adversarial
scoring, a rubric tightened twice mid-run, and a five-way blind-style comparison against
the reference corpus all land in the same place: the engine reaches parity or better on
typography, layout, colour, hierarchy, furniture and consistency, and loses every
comparison where a photograph or an illustrated character is doing the work. The gap is
real, it is narrow, and it is entirely in the subject layer.

---

## What was actually built and measured

| | |
|---|---|
| Reference corpus | 17 carousels, **145 slides**, every one measured in CIELAB |
| Engine | 4-layer compositor — satori/resvg for type + furniture, sharp for plates, subjects and encode |
| Families | 5, entirely as JSON. No layout constant lives in JavaScript |
| Gauntlet rounds | **10** (floor 8), rubric tightened at rounds 3 and 7 |
| Final automated | **89.30 / 90** at maximum strictness = 59.53 / 60 |
| Final total | **93.5 / 100** · four consecutive passes |
| Deliverable | 10 carousels, **75 slides**, campaign rules 10/10, fingerprint collisions 0 |

---

## Where it wins

**1. It cannot ship broken type, and it can prove it.**
`fitText` parses real `hmtx` advances and per-glyph bounding boxes through opentype.js,
greedy-wraps, and binary-searches the largest size that fits. It was calibrated against
rendered pixels — the worst case where the model under-measured what resvg actually
painted was **0.61px** (`tools/calibrate-fit.mjs`). When nothing fits it returns `null`
and the caller regenerates shorter copy. Across the last four rounds — 40 carousels,
roughly 300 slides — there were **zero overflow events and zero type collisions**, and
that is verified twice over: once by re-running the layout independently in the checker,
and once by measuring the real ink bounding box of every rendered type layer against the
safe box. A human designer working at volume does not hold that line.

**2. Colour discipline beyond what the corpus manages.**
The campaign rule is one accent per carousel. Measured with the same LAB clustering used
on the reference corpus, the engine holds a single chromatic cluster across every slide
of every set. **The corpus does not:** folder 3 drifts across four hue bins within one
carousel; folder 13 across two. The engine wins here because the constraint is machine-
checked on the output pixels rather than remembered by a person at 1am.

**3. Set-level hierarchy is guaranteed, not attempted.**
The cover is laid out first, its display size measured, and `coverSize × 0.68` passed
back as a ceiling for every subsequent slide. Before this existed, interiors were
out-shouting covers by up to 121% — invisible to a per-slide check and obvious once
measured across the set.

**4. Typographic rules a busy human breaks.**
`linesCrash` compares the real ink below one baseline against the real ink above the
next, so negative leading is permitted exactly where the glyphs allow it. Anton's cap
height measures 0.859em, so 0.90 leading is legal and 0.86 is not — and mixed-case with
descenders is opened automatically to the minimum it needs (`autoLeading`). Justification
skips paragraph-final lines. These are the details that separate typeset from typed.

**5. Structural divergence is a property, not a hope.**
Family, accent and hook type are drawn from seeded *permutations* walked by post index,
so ten posts give exactly two of each family and five of each accent, and every family
appears before any repeats. Zero fingerprint collisions in the last two rounds and in the
delivered set. Before stratification, one batch was 6/10 a single family with two
families never appearing.

**6. On pure-type families it beats the reference.**
`COMPARISON.md` §5: our TYPE-BOLD interior against folder 12's closer. Ours has a
deliberate ground, a mono eyebrow keyed to the accent, a rule anchoring the headline and
a two-tone body separating claim from elaboration. Theirs has a muddy blurred plate.
That is a win, not a draw.

---

## Where it still loses

**1. The subject layer. This is the whole gap.**

Five comparisons, one axis of failure:

| Family | Type | Imagery | Overall |
|---|---|---|---|
| F1 CUTOUT-EDITORIAL | draw, arguably ours | **loss** | theirs |
| F2 CUTOUT-SPORT | draw | **heavy loss** | theirs, decisively |
| F3 POSTER-CHARACTER | close, theirs | **loss** | theirs |
| F4 TYPE-MONO | draw | — | draw |
| F5 TYPE-BOLD | **ours** | — | **ours** |

Folder 13's cover is a crouching athlete whose shoes cross the headline's cap-height.
Ours is a seated silhouette whose arm merges into the torso, holding a grey rectangle.
Bedrock Form's character has musculature, hair, glowing eyes and attitude. Ours has a
contour. On typography those two pairs are level; on the picture they are not close.

Worth being precise about *why*, because it changes the fix: the **system** for character
consistency works. The parametric skeleton produced the same figure, the same weight and
the same treatment across 75 slides; the vision `consistency` line lost its point for
*pose repetition*, never for style drift. It is not a consistency failure. It is that a
program drawing free-hand cannot yet draw a person worth looking at.

**2. It never leaves a slide empty.**
Folder 3's second slide is a 463px top margin and four lines of text. Folder 12 runs
full-bleed photographs between type slides. The engine always fills the frame — safer,
and slightly more monotonous. Silence as a deliberate beat is a judgement call it does
not make.

**3. Systematic, not specific.**
@whymattrs embeds a screenshot of a real brokerage position. Every artefact in our output
is generated from the same content object that produced the copy — internally consistent,
and therefore never surprising. Specificity is what makes an account feel like a person,
and it is the one thing this architecture cannot synthesise.

**4. The "narrow generative assist" was me, not a model.**
The brief allows no paid APIs and no keys, so there is no model in the loop at runtime.
The copy banks — seven hook typologies, sixteen sleep insights, six closers at three
lengths each — are authored, and the engine assembles and *solves* over them
deterministically (it picks the closer length that satisfies the volume inequality
against real rendered word counts). That is a real capability and it is honest about its
limits: novelty comes from combination, not from generation. A 10-post batch is varied;
a 200-post batch would exhaust the banks.

---

## What surprised me

**The corpus is not a photo format.** 89% of the 145 reference slides are flat plates —
white, bone or ink. Only 16 are full-bleed photographs. The brief's layer model implies
imagery does the heavy lifting; the measurement says type does, and imagery is a
*cutout on a flat plate*. That reframed the whole build and is the reason the type-only
families came out strongest.

**Tightening the rubric was the most productive thing in the run.** Both times the score
fell — tier 1 cost 5.8 automated points, tier 2 cost 5.2 — and both times the new checks
found defects the previous rubric was structurally blind to: no set-level hierarchy, and
negative leading applied to mixed-case (lines literally crossing). A rubric that only
ever agrees with its own output is not measuring anything.

**Round 6 was the most useful failure.** Two carousels did not render at all. The engine
had trimmed the same headline six times rather than trying a different one, and the
line-crash guard had rejected a layout when it had the information to *correct* it
instead. Both were fixed at root cause — a hook-substituting regeneration ladder, and
`autoLeading` — and there have been zero render failures since. It also exposed a
harness bug: averaging only over survivors made a round with two dead carousels look like
the best result so far. Failures now score zero.

**Two rubric rules were in direct contradiction and I had been papering over it.**
`volume-decay` wants the cover shortest; `closer-quiet` wants the closer no longer than
any interior. Together they demand `cover < closer ≤ min(interiors)`. I had been hitting
that window by shaving individual words and hitting it on **22 of 38** template/hook
combinations. Writing three closer lengths and having the engine *solve* for the one that
satisfies the inequality against real rendered counts took it to **37/38**. Constraints
you cannot satisfy by hand are a sign to make them a solved variable.

---

## What would close the gap

Ranked by how much of the remaining distance each buys.

**1. A licensed cutout library — closes most of F1 and F2 immediately.**
The background-removal path already works: `@imgly/background-removal-node` produces
clean alpha in ~6 seconds and the grading, trimming, scaling, anchoring and overlap
machinery all take a photographic cutout unchanged. What is missing is *subjects*. Free
public-domain sources have essentially no modern lifestyle photography — a survey of
Wikimedia Commons returned anatomical reference plates and archival portraits. A stock
subscription and an afternoon of curation would move F1 and F2 from "loses decisively"
to parity. This is the highest-value change in the list and it requires no engine work.

**2. A generated recurring character — closes F3.**
F3 needs something a stock library cannot supply: the *same* character in many poses.
Two routes. An illustrator draws 8–12 poses once, they are graded by the existing
`silhouette`/`duotone` pipeline, and the family is done permanently. Or an image model
with character-consistency conditioning generates the pose set — which is exactly the
"narrow generative assist" the brief describes, and the one place in this project where a
model earns its cost. Either way the *engine* does not change; only the asset does.

**3. Let the engine choose silence.**
A `beat` slide role — one line, enormous margin, no object — placed by the same
positional schedule that drives body variants. Cheap, data-only, and it buys the one
compositional judgement the output currently never makes.

**4. Widen the copy banks, or put a model behind them.**
Sixteen insights and seven hook typologies carry ten posts comfortably. At two hundred
they would not. The clean version is a model generating candidates that must pass the
existing validator — banned claims, word counts, accent-word-in-headline, and the
`fitText` contract — before they are allowed near a layout. The scaffolding for that is
already built and already enforced; only the candidate source would change.

**5. Photographic plates for interiors.**
Folder 12 alternates type slides with full-bleed graded photographs. The engine supports
`type: "photo"` backgrounds with duotone grading into the accent hue (so the plate merges
into one chromatic cluster rather than adding a second), but with two usable plates it is
untested at scale. Same asset problem, same fix.

---

## Bottom line

A deterministic engine can match human designers on this format's **craft** — measure,
hierarchy, colour, consistency, and the rules that get broken at 1am — and it can prove
each of those claims with a number rather than an opinion. On the last four rounds it
produced 40 carousels with zero overflow, zero collisions, zero render failures and zero
structural duplicates, at a rubric strictness that cost real points every time it was
raised.

It cannot yet match them on **imagery**, and no amount of engine work will change that,
because the deficit is in what the subject layer is able to draw. That is not a
disappointing answer. It localises the remaining work precisely: the engine is done, and
what it needs next is an art director's asset budget, not another sprint.

If I had to state it as one line for a decision-maker: **this replaces the layout
designer today, and it will not replace the photographer.**
