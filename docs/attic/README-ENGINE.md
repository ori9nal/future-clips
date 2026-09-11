# DRIFT carousel engine

In-house capability test: can a deterministic engine match human designers on the
Instagram/TikTok carousel format? Answer and evidence in **[VERDICT.md](VERDICT.md)**.

## Deliverables

| Path | What |
|---|---|
| [ANALYSIS.md](ANALYSIS.md) | Reference corpus broken down — 145 slides measured in CIELAB |
| [engine/](engine/) | The generator |
| [templates/](templates/) | Five template families, entirely as JSON |
| [gauntlet/](gauntlet/) | Scoring harness |
| [GAUNTLET.md](GAUNTLET.md) | Full log of all 10 rounds: scores, failures, fixes |
| `output/final/` | 10 finished DRIFT carousels, 75 slides, 1080x1440 PNG |
| [COMPARISON.md](COMPARISON.md) | Five of ours beside five reference slides |
| [VERDICT.md](VERDICT.md) | The answer |

## Run it

```
node tools/fetch-fonts.mjs          # 24 Google Fonts TTFs -> assets/fonts/
node tools/build-subjects.mjs       # figure library -> assets/inhouse-only/subjects/
node tools/fetch-plates.mjs         # CC0 photographic plates (optional)

node gauntlet/final.mjs             # 10 carousels -> output/final/
node gauntlet/run.mjs --round N --n 10 --strict 3   # one scoring round
node tools/calibrate-fit.mjs        # prove fitText against rendered pixels
node tools/wordbudget.mjs           # prove the volume inequality per template
node tools/build-comparison.mjs     # side-by-side plates
```

## Layer model

Every slide is four composited layers, in this order:

1. **BACKGROUND** — flat / gradient / glow / graded photo, authored as SVG, rasterised by libvips
2. **SUBJECT** — cutout with alpha, graded, scaled, anchored, overlapping a named type slot
3. **TYPE** — satori -> resvg, lines pre-wrapped by `fitText` so satori cannot re-wrap them
4. **FURNITURE** — handle, arrow, wordmark, index; set-level constants that never move

Slot decorations (rules, swatches) composite *below* the subject, so a cutout occludes
them the way it does in the corpus.

## The parts that matter

- **`engine/fit-text.mjs`** — real `hmtx` advances + kern pairs + per-glyph bounding
  boxes. Binary search with a descending sweep as a correctness backstop. Returns `null`
  rather than shipping overflow. Calibrated against rendered ink: worst under-measure
  0.61px. Also `linesCrash` / `requiredLineHeight` (`autoLeading`), which permit negative
  leading exactly where the glyphs allow it.
- **`engine/layout.mjs`** — the only file that turns a box spec into pixels, and it knows
  nothing about any specific family. Collision and safe-area checks run on *painted*
  extents, not layout boxes.
- **`engine/seed.mjs`** — `hash(account, campaign, index)` drives every structural axis.
  Family, accent and hook are stratified permutations, so a batch of 10 covers all five
  families twice and never collides.
- **`engine/subjects.mjs`** — procedural subjects generated from the *live* palette, so an
  accent-B carousel cannot contain an accent-A pixel.
- **`gauntlet/checks.mjs`** — 60 automated points. Every check re-derives its answer;
  where a pixel can settle the question, the pixel wins over the model.
- **`gauntlet/strict.mjs`** — three tiers of rubric tightening, each derived from a
  measured corpus fact. `--strict 3` is 90 points.

## Asset boundary

Everything under `assets/inhouse-only/` is for this capability test only. The engine
throws if such an asset is used with `PRODUCTION=true`:

```
PRODUCTION=true node gauntlet/final.mjs
# Error: PRODUCTION=true forbids in-house test asset
#        "assets/inhouse-only/subjects/stand-slump.png".
```

Type-only families (F4, F5) render unaffected under `PRODUCTION=true` because they use no
stored assets. Procedural subjects are generated in-engine and carry no licensing burden.

## Campaign rules (enforced, not documented)

`engine/validate.mjs` hard-rejects a carousel that breaks any of: `@drift.sleep` on every
slide · `DRIFT` wordmark on slide 1 and the closer · 6-10 slides · exactly 1080x1440 ·
a CTA verb on the final slide · any banned claim (cure/cures/treats/clinically proven/
insomnia cure/medically approved/diagnose). 10/10 delivered carousels pass.
