# Engine

Engineering owns the mechanics in this file. Product owns the last section, "Prompt and style surfaces". Numbers are measured (from `output/lanes/*.json`, `post.json` cost blocks and the providers' usage blocks), never estimated.

## What a set is

`copy → anchor frame → frames → render`, run as one resumable state machine in `engine/lanes.mjs`:

```
copy:submit → copy:wait → art:anchor:submit → art:anchor:wait → art:frames:submit → art:frames:wait → render → done | failed
```

`newState({ id, spec, instruction, slides, styleId, lane, quality, model, seed, look, mode })` builds the state. `step(state, ctx)` makes one transition; provider errors mark the set `failed` rather than throwing. `run()` loops with a sleep (the CLI). The hosted worker (`lib/worker.ts`) calls `step` once per cron tick for batch sets and loops to a terminal stage for priority sets, saving the state on `sets.state_json` after every step. `ctx = { root, spec, cacheDir, outDir, concurrency }`.

- **Copy**: `engine/generate.mjs buildCopyRequest()` produces the same system and user text for both lanes; the priority lane calls the Messages API (`providers/claude.mjs completeJson`), the batch lane a Message Batch (`providers/claude-batch.mjs`). `judgeCopy()` repairs mechanical violations (`engine/compliance.mjs repair`), checks the brief's hard rules (`check`), the slide range, the caption emoji, brand-speak and numeric specificity, and feeds failures back verbatim for up to three attempts.
- **Art**: `engine/scenes.mjs direct()` decides the world, the shot types and whether one person is held across days; `engine/art.mjs planSet()` turns that into one anchor prompt and N edit prompts that reference the anchor file. Priority: `providers/image.mjs generate()` (four frames in flight, paced to `OPENAI_INPUT_IMAGES_PER_MIN`). Batch: `providers/openai-batch.mjs` uploads references to the Files API and submits one batch for generations and one for edits.
- **Render**: `engine/styles/registry.mjs render({ spec, root, styleId, outDir, cacheDir })` picks the style, clears stale `slide-*.png`, draws SVG through resvg with the tracked fonts, and `engine/clean.mjs assertClean()` refuses any PNG carrying a non-pixel chunk. Ten styles: `feed`, `native`, `bedrock`, `mascot`, `rail`, `clinical`, `editorial`, `document`, `poster`, `pastel`. `feed` and `native` de-slop the photo layer (`engine/deslop.mjs`) before the caption is drawn.
- **Output**: `slide-N.png`, `content.json` (copy + frame paths), `post.json` (caption, bio, hashtags, compliance verdict, world, look, lane, cost).

## Cache and cost

Frames are content-addressed: `providers/image.mjs cacheEntry()` hashes `(model, prompt, size, quality, reference hashes, variant)` to `img-<sha>.png` in `cacheDir`. The worker mirrors that directory to the private bucket `cache` (`useCacheStore`); a batch-lane frame is a cache hit for a later priority request and vice versa. Editing any prompt string invalidates every frame downstream, so prompt text is a cache key. `tools/rerender.mjs` re-renders a set from its cached frames for $0.

Measured 2026-09-12 (medium quality, gym feed, "days" mode):

| Lane | Slides | Copy | Frames | Total | Wall |
|---|---|---|---|---|---|
| Batch | 8 | $0.0231 | $0.1948 | $0.2179 ($0.027 per slide) | 20 min (provider batches) |
| Priority | 7 | $0.0665 | $0.3392 | $0.4057 ($0.058 per slide) | 2 min 25 s |

Per frame (gpt-image-2 list prices read 2026-09-12): generation medium $0.041 realtime / $0.021 batch; edit with reference medium $0.054 / $0.027 (the reference image alone is about $0.012 of input tokens); edit low $0.018 / $0.009; generation high $0.165 / $0.082. Copy on `claude-opus-5` $0.02 to $0.07 per attempt. The quota gate reserves at $0.03 per slide batch, $0.06 priority, times three for HD (`fc_reserve_rate`); the commit records the providers' real numbers.

Rate limit: reference edits count against OpenAI's "input images per minute" limit, 5 on a fresh org. `providers/image.mjs` paces per process and honours 429 "try again in Ns" for up to eight tries. Two sets rendering on separate function instances share the org limit (a platform-wide throttle is on the roadmap).

## Host safety

The engine writes only under the directories `lib/engine.ts workDirs()` names (`output/` on a laptop, `/tmp/fc` on Vercel): the frame cache, per-set render dirs, the pairing rotation state (`engine/pairings.mjs`, best effort, never fails a render), and per-style plate caches under the set's own `outDir`. The registry hands every style `ctx.cacheDir`; `bedrock` draws its figures into it. Keys come from the host environment first and `.env.local` second (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`).

## Command line

```
node tools/lane.mjs campaign=<id> ask="..." lane=priority|batch slides=6-8 style=feed   # the product path, checkpointed to output/lanes/<id>.json; resume=<id> continues
node tools/make-set.mjs campaign=<id> ask="..." slides=7 art=ai quality=medium style=feed # the older realtime path
node tools/rerender.mjs campaign=<id> style=<style>                                   # $0 re-render from cached frames
node tools/render-style.mjs <campaign> <style>                                        # a style from stored copy, no AI art
node tools/sheet-set.mjs <set-dir> <label>                                            # contact sheet to output/gauntlet/
node tools/ingest.mjs briefs/<brief>.md                                               # brief → campaigns/<id>.json (Claude)
node tools/make-character.mjs && node tools/cut-character.mjs <sheet>                 # bedrock reference figure
node tools/fetch-fonts.mjs                                                            # the 60 TTFs from Google Fonts (prebuild)
npm test                                                                              # tools/test-engine.mjs, 31 checks, $0
```

The CLI reads `campaigns/*.json`; the app reads the `campaigns` table. Keep both in step when a campaign changes (the table is the truth).

## Tests

`tools/test-engine.mjs` (`npm test`) checks, without spending: every rendered slide on disk is pixels only; `stripPng` removes the provider's C2PA manifest and leaves the pixels byte-identical; the copy judge enforces the slide range, the caption emoji, brand-speak and numeric specificity; `slideRange` clamps to the brief; de-slop is deterministic per seed and inside the measured reference band; scene direction obeys the shot-type and daylight rules. A new judge rule gets a new check here.

## Known engine issues (from the audit; Product owns the quality ones)

Copy model sometimes ignores the format direction (closer scene drawn from the DAYS bank); bedrock pose obedience about 85 percent; `campaigns/bedrock-form.json` still in the old content shape; no copy cache (the same ask twice pays twice); the vision judge in `engine/judge.mjs` and the file ledger in `engine/budget.mjs` have no callers (the DB spend cap replaced the ledger); `tools/slideshow.mjs` and `skills/slideshow-prompt-builder/` are a second pipeline that has never been exercised.

## Prompt and style surfaces (Product owns this section)

Where the words and the type live:

- `engine/generate.mjs`: `SHAPE`, `SHAPE_BEDROCK` (the JSON the model must return; a field that is not here does not exist), `RULES_NATIVE`, `RULES_BEDROCK`, `SCENE_DIRECTION` per style and niche family, `BRAND_SPEAK`, `judgeCopy` rules, `toRenderable` (how copy maps onto a style).
- `engine/scenes.mjs`: `CAMERA` lines per family, `MISTAKES`, `DREARY`, the worlds, the `DAYS` and `ANATOMY` banks, `SHOTS`, `direct()`.
- `engine/art.mjs`: `LOOK`, `GUARD`, `ASPIRE_GUARD`, `SAME_PERSON`, `RELEASE`, the app-frame prompt.
- `engine/deslop.mjs`: `KNOBS`, `strengthFor`.
- `engine/styles/*.mjs`: type sizes, `OUTLINE`, faces, layout per style; `engine/pairings.mjs` `PAIRINGS` and the phone faces; `engine/caption.mjs`, `engine/grade.mjs`.
- `engine/ingest.mjs`: the brief-extraction system prompt.
- `engine/compliance.mjs`: shared, never weakened.

Rules for changing them: a new field goes into the shape, not into prose; every paid round changes one variable; re-render for free when the image prompts did not change; add a check to `tools/test-engine.mjs` for every new judge rule; record each round, its cost and its score in `docs/QUALITY.md`.
