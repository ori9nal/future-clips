# COMPARISON.md — five of ours beside five of theirs

Five slides from `output/final/`, each placed next to the reference slide whose
archetype its family was derived from. Same height, same ground, no retouching.
Plates: `output/comparison/*.png`. Build: `node tools/build-comparison.mjs`.

The assessment below is written to be useful, not flattering. Where the engine
wins I say so; where it loses I say how badly.

---

## 1 · CUTOUT-EDITORIAL — `output/comparison/1-editorial.png`

**Ours:** `output/final/f1-p01-B/01.png` · **Theirs:** folder 3, @papanca.io, cover

| | ours | theirs |
|---|---|---|
| plate | `#FFFFFF` | `#FFFFFF` |
| display | Playfair Display 400, 3 lines, one italic accent word | same class of face, 3 lines, one italic line |
| accent | `#5B7FFF` on *quietly* + rule + arrow, 2.4% of pixels | none — emphasis is italic alone |
| subject | procedural ring, ~40% of canvas height | photographic runner cutout, B&W, ~55% |
| furniture | handle bottom-left, arrow bottom-right, wordmark top-centre | handle bottom-left, arrow bottom-right |

**Type: a draw, arguably ours.** The measure, the leading, the italic accent word and
the ranging of "what six / hours *quietly* / costs you" are competitive with the
reference. Ours adds a coloured accent word where theirs stays black — a brand
requirement, and it does not cheapen the slide.

**Subject: a clear loss.** Theirs is a human being. Ours is a wireframe ring. The ring
is well drawn and it is on-brand for a sleep-score product, but it is an *icon* where
theirs is a *photograph*, and a photograph of a person carries information and
attention that a ring cannot. The ring also runs into the third headline line and the
accent rule, which reads as crowding rather than as overlap.

**Verdict: ours would pass as designed; theirs would stop a thumb.**

---

## 2 · CUTOUT-SPORT — `output/comparison/2-sport.png`

**Ours:** `output/final/f2-p09-B/01.png` · **Theirs:** folder 13, cover

| | ours | theirs |
|---|---|---|
| display | Archivo Expanded 800 italic, 2 lines, line 2 in accent | same construction, line 2 in `#FC7F34` |
| subline | italic, accent rule beneath | italic, no rule |
| subject | procedural silhouette, duotone, phone in hand | photographic athlete mid-crouch, greyscale with the shoes left in colour |

**Type: a draw.** "my score said / *seventy-one*" is built exactly the way "side effects
of / *running*" is built, down to the accent landing on the larger line. The rule under
the subline is an addition, and it works.

**Subject: the worst result in the set.** Theirs is a crouching athlete whose shoes cross
the headline's cap-height — a photograph doing real compositional work. Ours is a
seated silhouette whose arm merges into the torso, holding a grey rectangle. It reads as
a blob with a rectangle. The duotone grade meant to soften it instead flattens the only
edge that was separating the limbs.

**Verdict: the reference wins outright.** This is the one comparison where a viewer would
not need to think about it.

---

## 3 · POSTER-CHARACTER — `output/comparison/3-character.png`

**Ours:** `output/final/f3-p05-A/01.png` · **Theirs:** folder 2, Bedrock Form, cover

| | ours | theirs |
|---|---|---|
| plate | bone gradient + grain + accent bloom | bone `#F4ECE1`, flat with paper grain |
| display | Anton caps, 3 lines, negative leading, line 2 in accent, drop shadow, accent rule | same, line 2 in `#DA2F2D`, drop shadow, no rule |
| wordmark | dot + `DRIFT` letterspaced, top-left | glyph + `BEDROCK FORM`, top-left |
| character | flat ink silhouette, seated | fully illustrated figure — musculature, hair, glowing eyes |

**Type: very close, theirs slightly better balanced.** The stack, the two-tone, the
negative leading and the shadow offset all match. Theirs centres the block and lets the
third line run nearly edge to edge; mine is left-ranged and leaves a soft right margin
on line 2. Theirs is the stronger poster.

**Character: a clear loss, and the most instructive one in the project.** The *mechanism*
works — the same figure system recurs on all seven slides with one treatment, and the
strict `plate-stability` and consistency checks both pass. But a silhouette is a
pictogram. Bedrock's character has a face, a pose with attitude, and a personality that
carries a whole account. Mine has a contour.

**Verdict: the system is right and the asset is not.**

---

## 4 · TYPE-MONO — `output/comparison/4-mono.png`

**Ours:** `output/final/f4-p07-B/03.png` · **Theirs:** folder 4, @whymattrs, interior

| | ours | theirs |
|---|---|---|
| plate | `#FFFFFF` | `#FFFFFF` |
| face | JetBrains Mono 400/500/700 only | one monospace only |
| structure | index+tag eyebrow (grey) → claim (black) → body (grey) → stat (accent) | index+title (grey) → body (black) → embedded UI card → caption (grey) |
| furniture | handle bottom-centre, `n / N` top-centre | handle bottom-centre at exactly 115px |

**A genuine draw.** Both are centred monospace on white with grey/black hierarchy and an
enormous quiet. Ours adds a coloured stat line (`-9 pts`) where theirs embeds a real
screenshot of a brokerage card. Theirs is more *specific* — a real artefact from a real
account. Ours is more *systematic* — the stat is generated from the same content object
that produced the copy, so it can never disagree with the text.

**Verdict: even. Theirs has better evidence; ours has better consistency.**

---

## 5 · TYPE-BOLD — `output/comparison/5-bold.png`

**Ours:** `output/final/f5-p04-B/02.png` · **Theirs:** folder 12, closer

| | ours | theirs |
|---|---|---|
| plate | ink glow gradient, measured chroma ≈ 0 outside the accent | blurred dark photo plate |
| display | Archivo Black caps + accent rule | heavy geometric caps |
| body | two tones of grey, stanza-broken | one tone of grey |
| accent | mono eyebrow + rule in `#5B7FFF` | none |

**Ours is the stronger slide.** The reference's blurred plate is muddy and the type sits
on it without a clear ground. Ours has a deliberate glow, a mono eyebrow keyed to the
accent, a rule that anchors the headline, and a two-tone body that separates the claim
from the elaboration. Everything is measurable and everything holds.

**Verdict: the engine wins this one.**

---

## The pattern

| Family | Type | Subject / imagery | Overall |
|---|---|---|---|
| F1 CUTOUT-EDITORIAL | draw, arguably ours | **clear loss** | theirs |
| F2 CUTOUT-SPORT | draw | **heavy loss** | theirs, decisively |
| F3 POSTER-CHARACTER | close, theirs | **clear loss** | theirs |
| F4 TYPE-MONO | draw | n/a (neither uses imagery) | draw |
| F5 TYPE-BOLD | **ours** | n/a | **ours** |

**Five comparisons, one axis of failure.** On typography, measure, hierarchy, colour
discipline and furniture the engine is at parity in every single pairing and ahead in
one. On *imagery* it loses every pairing where imagery exists, and loses badly in two.

The remaining gap is not a layout problem, a typography problem, a colour problem or a
consistency problem. Those are solved and measurably so. It is an **asset problem**:
the engine's subject layer can only draw what a program can draw, and a program drawing
free-hand cannot yet draw a person worth looking at.

Two secondary gaps, smaller but real:

- **Ours never leaves a slide empty.** Folder 3's second slide is a 463px top margin and
  four lines of text. Folder 12 runs full-bleed photographs between type slides. Mine
  always fills the frame, which is safer and slightly more monotonous.
- **Theirs is specific; ours is systematic.** @whymattrs embeds a screenshot of an actual
  brokerage position. Every artefact in mine is generated. That specificity is what makes
  a real account feel real, and it is the one thing the engine cannot synthesise.
