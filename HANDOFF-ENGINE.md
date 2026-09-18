> **SUPERSEDED (2026-09-18).** Kept for history only; facts below may be stale. Current truth: `docs/ARCHITECTURE.md`, `docs/ENGINE.md`, `docs/DATABASE.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`.

# HANDOFF-ENGINE.md

## What this is

A carousel engine for paid clipping campaigns: an admin ingests a brand brief once
(`campaigns/<id>.json`), then a few words from a clipper produce a compliant,
rendered TikTok/Instagram slide set with AI-generated imagery — the copy from
Claude, the frames from gpt-image-2, the typography drawn in code. Two formats are
built to the reference sets in `Carousel examples/`: **feed** (a real person's
phone photos with small outlined captions; for gym niches one lifter across many
days, for trading aspirational places with an app icon on a pill) and **bedrock**
(the @bedrock.form format: cream page, huge condensed headline, a cel-shaded
character doing the exercise with the working muscles tinted, sets × reps).

## Entry points

```bash
# 0. once: env + deps (Node 22, npm 10)
cp .env.example .env.local        # then fill OPENAI_API_KEY and ANTHROPIC_API_KEY
npm install

# 1. THE canonical path — one set from a campaign + a few words
node tools/make-set.mjs campaign=apex-strength ask="top 5 exercises for biceps rated" slides=7 art=ai quality=medium style=feed
node tools/make-set.mjs campaign=apex-strength ask="the 7 day calisthenics program, zero equipment" slides=7 style=bedrock
node tools/make-set.mjs campaign=tradelens-app-reachify ask="trading apps that actually changed how I trade" slides=6 art=ai quality=medium style=feed
#    args: campaign=<campaigns/*.json id>  ask="..."  slides=5..10  style=feed|bedrock|native|rail|...
#          art=ai (generate frames; omit = use campaign photo dir)  quality=low|medium|high
#          look=<grade> pairing=<font pairing id> seed=<string> mode=subject|aspirational
#    output: output/sets/<campaign>-<style>/slide-N.png + post.json (caption, bio, hashtags, compliance, cost)

# 2. re-render a set from its saved copy and frames — $0, ~15 s (font / grade / numbering tweaks)
node tools/rerender.mjs campaign=apex-strength style=feed [pairing=bebas] [look=phone]

# 3. one contact sheet per set, with cost printed
node tools/sheet-set.mjs apex-strength-feed g1        # → output/gauntlet/round-g1.jpg

# 4. ingest a new brief into a campaign file (Claude), or invent one from a sentence
node tools/ingest.mjs briefs/tradelens.md
node tools/invent-campaign.mjs "creatine brand for lifters, tiktok"

# 5. bedrock only: a new reference figure (once per brand); the default lives at assets/campaigns/character/ref.png
node tools/make-character.mjs && node tools/cut-character.mjs output/gen/character/sheet.png

# 6. every style side by side for one campaign (no AI art; uses campaign photo dirs where present)
node tools/render-style.mjs apex-strength feed

# fonts: assets/fonts/*.ttf (56 files) are tracked; tools/fetch-fonts.mjs re-downloads from Google Fonts if lost
```

The Next.js studio (`app/`, not this workstream) reaches the same engine by
dynamic import: `/api/styles` → `engine/styles/registry.mjs`, `/api/sets` →
`engine/render-native.mjs` + `engine/judge.mjs`, `/api/ingest` → `engine/ingest.mjs`,
`/api/character` → `engine/providers/image.mjs`.

## Env vars

All read from `.env.local` at the repo root (git-ignored). The engine loads it
itself (`engine/providers/*.mjs` `loadEnv`) — `--env-file` is not required for
`tools/make-set.mjs`. Never paste a value anywhere but `.env.local`.

| name | required | what breaks without it | where to get it |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | **required** | `make-set` fails at step 1 (copy): `ANTHROPIC_API_KEY missing from .env.local`. Every set needs it (copy + compliance repair loop, ~$0.04–0.10/set on Opus 5). | console.anthropic.com → API keys. The key **must be workspace-scoped**: a default-workspace key returned 401 here on 2026-09-08. |
| `OPENAI_API_KEY` | **required** for `art=ai` and for `style=bedrock` | `OPENAI_API_KEY missing from .env.local` at the art step. Without `art=ai` a feed set falls back to the campaign's photo dir, which for most campaigns is an untracked `output/...` folder → empty → renders with no imagery. | platform.openai.com → API keys, with access to the image model. |
| `OPENAI_IMAGE_MODEL` | optional | defaults to `gpt-image-2`. | — |
| `FC_ADMIN_SECRET` | site only | gates `/admin` and `/api/ingest`; the CLI does not read it. | choose any string |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | site only | not read by the engine. | Supabase project settings |
| `PEXELS_API_KEY`, `UNSPLASH_*`, `APIFY_TOKEN`, `FAL_KEY` | not needed | only read by `engine/_attic/source/*` and `mining/scrape.mjs` (superseded stock-photo sourcing and a scraper that was never unblocked). | — |

Provider inventory (`engine/providers/`):

| provider | reads | model / endpoint | billing |
|---|---|---|---|
| `claude.mjs` | `ANTHROPIC_API_KEY` | `claude-opus-5` default (`model=` per call); Messages API, JSON extracted by balanced braces with one retry | per-token ledger in memory, `usd` returned per call |
| `image.mjs` | `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL` | `/images/generations` and `/images/edits` (reference images for a held subject); sizes 1024×1536 / 1024×1792 / 1536×1024 / 1024×1024; content-addressed cache `output/gen/cache/img-<sha>.png` | billed from the response's `usage` tokens; medium 1024×1792 ≈ $0.0375/frame, low ≈ $0.004, high ≈ $0.15 |
| matting | — | `@imgly/background-removal-node` is still in `package.json` but only `engine/_attic/source/cutout.mjs` uses it. The live character cutout is a colour key (`engine/character.mjs`). | — |
| stock | `PEXELS_API_KEY`, `UNSPLASH_ACCESS_KEY` | `engine/_attic/source/stock.mjs` — superseded, owner rejected stock imagery 2026-09-07 | — |
| scraping | `APIFY_TOKEN` | `mining/scrape.mjs` — never ran (no token) | — |

## Runs cold?

**Yes.** Proven 2026-09-11 from a fresh `git clone` of this commit (tracked files only:
no `output/`, no cache, no `.env.local`, no `node_modules`) into `D:/Side Quests/hm/fc-cold`.

```bash
git clone "D:/Side Quests/hm/Future Clips" fc-cold && cd fc-cold
npm install --no-audit --no-fund            # 132 packages, 35 s; sharp 0.34.5, resvg 2.6.2, opentype.js 2.0.0 present
# (first attempt on C: died with ENOSPC — that drive has 168 MB free; nothing to do with the repo)

# no .env.local at all → fails at step 1, $0 spent:
#   Error: ANTHROPIC_API_KEY missing from .env.local
# only ANTHROPIC_API_KEY → copy succeeds ($0.0489 spent), then the art step throws:
#   Error: OPENAI_API_KEY missing from .env.local        ← known flaw: no preflight, see What is broken

# both keys, empty cache:
node tools/make-set.mjs campaign=apex-strength ask="top 5 exercises for biceps rated" slides=7 art=ai quality=medium style=feed
#   copy: 1 attempt · $0.0565 · COMPLIANT
#   world: his camera roll · grade: phone
#   art: generating 7 frames at medium (subject)… $0.2683 (0 cached)
#   fonts: oswald (oswald / sansMed)
#   7 slides · 1080x1440 · 346.2s
#   cost: copy $0.0565 + art $0.2683 = $0.3248          wall: 5 m 47 s (real)
#   → fc-cold/output/sets/apex-strength-feed/slide-1..7.png, post.json, content.json

node tools/make-set.mjs campaign=apex-strength ask="the 7 day calisthenics program, zero equipment" slides=7 style=bedrock
#   copy: 1 attempt · $0.0737 · COMPLIANT
#   figures: $0.3368
#   8 slides · 1080x1350 · 325.4s
#   cost: copy $0.0737 + art $0.3368 = $0.4105          wall: 5 m 28 s
#   → fc-cold/output/sets/apex-strength-bedrock/

node tools/sheet-set.mjs apex-strength-feed cold-feed   # → output/gauntlet/round-cold-feed.jpg
```

Contact sheets of both cold sets are at `output/gauntlet/round-cold-feed.jpg` and
`round-cold-bedrock.jpg` in the main checkout (untracked). Total cold-run spend: **$0.78**.

The one thing that blocked the cold run and was fixed in this commit: `tools/sheet-set.mjs`
wrote to `output/gauntlet/` without creating it (`mkdirSync` added). Two things were fixed
*before* the clone because they would have blocked it: campaign assets referenced from the
untracked `output/` folder (APEX app screen, TradeLens icon + screen, the bedrock reference
figure) now live in tracked `assets/campaigns/`, and `sharp` — which every style imports —
was only present as `next`'s optional dependency and is now declared directly.

## What works

Verified 2026-09-11 in this checkout; every run prints its own cost line and
writes it to `post.json`.

| what | command | evidence |
|---|---|---|
| Gym **feed** (human camera roll): one lifter across days, x/10 ratings, app screenshot slide, different font per set | `node tools/make-set.mjs campaign=apex-strength ask="top 5 exercises for biceps rated" slides=7 art=ai quality=medium style=feed` | `output/gauntlet/round-h3.jpg`, `TWO-WAYS.jpg` (next to reference set-08); $0.3224, 288 s |
| Gym feed, list of lessons, 8 slides | `... ask="6 things I wish I knew before I started lifting" slides=8 ...` | `round-h2.jpg`; $0.3605 |
| Supplement feed (CORE creatine, no app) | `node tools/make-set.mjs campaign=core-creatine ask="creatine myths I believed for years, ranked" slides=8 art=ai quality=medium style=feed` | `round-g6b.jpg`; $0.3647 |
| **Bedrock** programme: headline, tinted-muscle figure per slide, sets×reps, LEVEL grid, phone slide, FOLLOW FOR MORE | `node tools/make-set.mjs campaign=apex-strength ask="the 7 day calisthenics program, zero equipment" slides=7 style=bedrock` | `round-b4.jpg`, `TWO-WAYS.jpg` (next to bedrock.form); $0.4112 |
| Trading feed: aspirational frames in one world, icon-on-pill app slide | `node tools/make-set.mjs campaign=tradelens-app-reachify ask="trading apps that actually changed how I trade" slides=6 art=ai quality=medium style=feed` | `output/gauntlet/round-9.jpg`, `LOG.jpg`; ~$0.34 uncached |
| Zero-cost re-render (font/grade/numbering) | `node tools/rerender.mjs campaign=core-creatine style=feed` | `round-g6b.jpg` from `round-g6.jpg`, 15 s, $0 |
| Compliance loop: required phrase, never-bare product name, app placement by slide count, banned claims; mechanical repairs before a paid retry | every `make-set` run prints `COMPLIANT` / the failures; see `engine/compliance.mjs` | all runs above passed first attempt |
| Other styles render from campaign data (no AI art): `native`, `mascot`, `rail`, `clinical`, `editorial`, `document`, `poster`, `pastel` | `node tools/render-style.mjs <campaign> <style>` | rendered in earlier sessions; not re-verified today |

## What is broken

- **The copy model sometimes ignores the format.** With the feed:fitness direction it
  still occasionally writes a "day" heading where an exercise was asked for, and the
  closer then gets a lifestyle frame instead of the #1 exercise (`round-h3.jpg` slide 7 is
  a pull-up bar under "Incline dumbbell curl"). Best guess: the closer's scene is drawn
  from the DAYS bank unconditionally in `engine/scenes.mjs` (`i === scenes.length - 1`);
  making it follow `anatomyFor(closer heading)` when the closer carries rank 1 would fix it.
- **Bedrock figure obedience is ~85%.** The image model occasionally draws a different
  movement than named (round b2: "pull" became a barbell deadlift in a "zero equipment"
  set) or a second figure. Prompts now say "EXACTLY ONE figure" and put the tint first;
  `quality=high` is untested for figures.
- **Slide count is advisory.** The model returned 8 slides for `slides=7` twice (bedrock
  b2, b4). Compliance only enforces the brief's min/max, not the exact ask.
- **`style=bedrock` reads `assets.character.ref`**; `campaigns/bedrock-form.json` still
  carries the old `assets.character.dir` (cut poses). The default ref
  (`assets/campaigns/character/ref.png`) is used when `ref` is absent, so it renders, but
  that campaign file's `content` block is hand-authored for the old renderer: it has no
  `pose`/`muscles`/`headline` fields, so `tools/render-style.mjs bedrock-form bedrock`
  falls back to default poses and untinted figures (and pays for them). Regenerate the
  copy through `make-set ... style=bedrock` instead.
- **`tools/slideshow.mjs` + `skills/slideshow-prompt-builder/`** (a second pipeline where
  Claude writes per-slide image prompts and a text overlay from a SKILL.md) is syntax-valid
  and imports, but was not exercised this session. Status unknown.
- **`app/api/generate/route.ts`** (site surface) imports `engine/index.mjs`, which is now
  `engine/_attic/index.mjs`. The studio UI never calls that route (it uses `/api/sets`),
  so nothing user-facing breaks, but hitting the route returns a 500 until the site owner
  deletes or repoints it.
- **Copy is regenerated on every run**, so the same ask twice pays twice (~$0.05 copy +
  all new frames, because the frames' prompts embed the new copy). `rerender.mjs` is
  the $0 path; there is no copy cache by (campaign, ask, slides).
- **No key preflight.** `make-set` pays for the copy (~$0.05) before discovering
  `OPENAI_API_KEY` is missing at the art step. Check both keys before the first call.
- Cost lines are per-process ledgers; there is no cross-run spend cap. `engine/_attic/budget.mjs`
  is a reserve-then-commit hard-cap ledger that was written but never wired in.

## What is stale

Moved, not deleted, so history and the one remaining importer survive:

| path | why stale |
|---|---|
| `engine/_attic/index.mjs` + `cards/compose/concept/copy/layout/match/palette/render-type/seed/subjects/validate.mjs`, `engine/_attic/templates/` (f1–f6), `engine/_attic/gauntlet/` | the August "premium poster" template engine and its 10-round scorer — dark plates, split-tone, rim light, coloured accent words. Owner pivoted 2026-08-28. Only importer left: `app/api/generate/route.ts` (see above). |
| `engine/_attic/constellation.mjs`, `render-constellation.mjs`, `objects*.mjs` | object-cutout "constellation" slides; rated 9–12/100 by the owner (docs/attic/GAP.md) |
| `engine/_attic/source/` (`stock`, `cutout`, `frames`, `generate`, `matte-worker`, `probe`, `cache`) + `tools/_attic/{build,audit,clean,dedupe,gen}-library.mjs`, `build-plates`, `translucency-check`, `source-subject`, `build-all.sh` | Pexels/Unsplash stock sourcing + learned matting. Owner: "these are generic stock images … use ai please" (2026-09-07). `mining/scrape.mjs` and `mining/subject.mjs` still import `_attic/source/cache.mjs`; they are the never-unblocked scraper. |
| `engine/_attic/render-photo.mjs`, `negative-space.mjs`, `screen-warp.mjs` | one-off renderers for `design/atlas/*` scripts (imports repointed) |
| `engine/_attic/budget.mjs` | never wired |
| `tools/_attic/cost.mjs`, `verify.mjs`, `wordbudget.mjs`, `render-all.mjs`, `gauntlet-round.mjs`, `score-vs-reference.mjs`, `build-comparison.mjs`, `calibrate-fit.mjs`, `color-probe/corpus-*/margins.mjs`, `fetch-pinterest.mjs`, `fetch-plates.mjs`, `build-subjects.mjs` | CLIs that only drive the attic |
| `docs/attic/*.md` | see below |
| `output/round-1..10`, `output/final`, `output/comparison` (144 MB, 1,153 files) | old-gauntlet renders; **untracked in this commit** (`output/` was already in `.gitignore`, the files predated the rule). Still on disk. |

Root markdown, per file (all dated 08-27 → 08-30, all pre-pivot):

| file | verdict |
|---|---|
| VERDICT.md, README-ENGINE.md, GAUNTLET.md, COMPARISON.md, ANALYSIS.md | **confirmed old direction** — they describe `engine/_attic/index.mjs` and its scorer. Moved to `docs/attic/`. |
| COST.md ($0.012/set, no AI), BUY.md (Higgsfield shopping list), GAP.md, PLAN.md (100 templates + small model), STACK.md (pre-gpt-image-2 tests), TARGETS.md | also old direction / superseded decisions. Moved to `docs/attic/`. |
| MINING.md, REPLICATE.md, RESEARCH.md | historical but still true: corpus feature distributions; which reference sets to copy (it ranked Bedrock Form first — that is what `style=bedrock` now builds); why hooks and density win. Moved to `docs/attic/` and marked as background. |
| README.md | the site's readme (Next.js run instructions). Not this workstream's; left in place. |
| `Carousel examples/reference-2026-09/ANALYSIS.md` | **current** — the 15-set reference breakdown the feed style was measured against. |

Live engine inventory (everything not in `_attic/`):

| module | status | called by | purpose |
|---|---|---|---|
| `generate.mjs` | LIVE | make-set, rerender, invent-campaign | copy from Claude with a per-style JSON shape; compliance loop; `toRenderable` maps copy + frames onto a style |
| `compliance.mjs` | LIVE | generate | brief rules → constraints, `check`, mechanical `repair` |
| `scenes.mjs` | LIVE | make-set | feed imagery in code: one world per trading set; DAYS + ANATOMY per gym set |
| `art.mjs` | LIVE | make-set | frame generation: `aspirational` (independent), `subject` (anchor + edits), `days` (hold the face, not the clothes) |
| `character.mjs` | LIVE | styles/bedrock | per-slide cel-shaded figure via edit-with-reference; colour-key cutout; four-in-a-row grid cut |
| `styles/registry.mjs`, `styles/feed.mjs`, `styles/bedrock.mjs`, `styles/{native,mascot,rail,clinical,editorial,document,poster,pastel}.mjs`, `styles/kit.mjs` | LIVE | make-set, rerender, render-style, app `/api/styles` `/api/sets` | the ten renderers and their SVG primitives; `render()` clears stale `slide-*.png` |
| `caption.mjs`, `fit-text.mjs`, `fonts.mjs` | LIVE | styles, render-native | measured text fitting (opentype.js), band scoring (`scoreRegion` → range/skin/mean) |
| `pairings.mjs` | LIVE | styles/feed, rail, kit | 14 loud/quiet font pairings, rotated per set with a history file, filtered to caption-safe faces for feed |
| `grade.mjs` | LIVE (partly legacy) | styles/feed, rail, tools/slideshow | per-channel LUT grades. `phone` (no grade + grain), `clean`, `sunlit` are what the current feed uses, chosen by the world; `cinematic`, `steel`, `ash` are the old direction's looks and only appear when a world or campaign asks for them. |
| `render-native.mjs`, `judge.mjs` | LIVE | styles/native, mascot; app `/api/sets`; tools/render-campaign | the earlier native renderer and its logic check, still behind the `native`/`mascot` styles |
| `ingest.mjs` | LIVE | tools/ingest, invent-campaign, app `/api/ingest` | brief markdown → campaign JSON via Claude |
| `providers/claude.mjs`, `providers/image.mjs` | LIVE | everything above | see the provider table |
| `overlay.mjs` | UNKNOWN | tools/slideshow only | text overlay compositor for the SKILL pipeline; not exercised |

## Cost

From `post.json.cost` of the runs made 2026-09-11 (copy on `claude-opus-5`, frames on
gpt-image-2 `medium`, uncached):

| set | slides | copy | art | total | wall |
|---|---|---|---|---|---|
| APEX feed, 7 | 7 | $0.0539 | $0.2685 | **$0.3224** | 288 s |
| APEX feed, 8 | 8 | $0.0540 | $0.3065 | $0.3605 | 332 s |
| CORE feed, 8 | 8 | $0.0593 | $0.3054 | $0.3647 | 296 s |
| APEX bedrock, 8 (7 figures + one 4-figure row) | 8 | $0.0743 | $0.3368 | **$0.4112** | 274 s |
| TradeLens feed, 6 | 6 | ~$0.08 | ~$0.23 | ~$0.34 | ~280 s |

Rule of thumb: **$0.05–0.10 copy + $0.0375 per medium frame** → a 7-slide set is
$0.31–0.41, a 10-slide set ≈ $0.45. `quality=low` frames are $0.004 (unusable for
faces), `high` $0.15 (4× cost, untested at set scale). Re-rendering is $0. The
session's gauntlets totalled $4.51 for 17 paid rounds. Anthropic Batch and OpenAI
Batch would halve both lines; neither is wired.

## Assets & size

| path | tracked? | size | regenerable? |
|---|---|---|---|
| `assets/fonts/*.ttf` (56) | yes | 8 MB | yes — `tools/fetch-fonts.mjs` (Google Fonts) |
| `assets/campaigns/{apex,tradelens,character}/` | yes (new) | 0.6 MB | app screens and icon: generated once (gpt-image-2); the bedrock reference figure `ref.png` is the character every bedrock set is edited from — **regenerating it changes the character** |
| `assets/inhouse-only/` | yes | 0.8 MB | old direction's plates/subjects; harmless |
| `campaigns/*.json` (21) | yes | 0.1 MB | the product data — irreplaceable-ish (re-ingest from `briefs/` for the 4 that have briefs) |
| `Carousel examples/` (17 folders + `reference-2026-09/` 15 sets) | yes | 52 MB | **irreplaceable** — the downloaded reference corpus the styles were measured against |
| `reference/` | yes | 11 MB | Pinterest/growithalex sheets from research; replaceable, low value |
| `output/gen/cache/` (147 PNGs) | no | 324 MB | the paid image cache, content-addressed; regenerable at ~$0.04/frame (≈$6 for all) |
| `output/sets/` (28 sets) | no | 809 MB | every rendered set incl. graded frames; regenerable from `content.json` + cache for $0 |
| `output/gauntlet/*.jpg` | no | 9 MB | the evidence sheets cited above; regenerable with `tools/sheet-set.mjs` |
| `output/round-*`, `final`, `comparison`, `spread`, `studio`, `niche`, … | no (untracked now) | ~450 MB | old direction; delete freely |
| `dist/` | yes | 0.4 MB | site build; not this workstream |
| `library/niches.json` | yes | <1 MB | niche list for the superseded library builder |

Must NOT be committed: `.env.local` (git-ignored, verified with `git check-ignore`),
`output/` (git-ignored), `node_modules/`, the cold-run clone at `D:/Side Quests/hm/fc-cold`
(delete it; its two sheets were copied into `output/gauntlet/`). Nothing over 1 MB that is regenerable is
tracked; the >1 MB tracked files are reference images and `design/*.html` mockups
(site workstream).

## Merge hazards

- **Shared index — the biggest hazard.** Both workstreams work in ONE clone and one
  index. While this was being packed the site session ran `git reset` (my staged renames
  were unstaged mid-flight) and later staged its own files, which an `--amend` swept into
  my commit; the commit was rebuilt twice to keep the two apart. At the moment this commit
  was made the site workstream had these *uncommitted* changes in the working tree, none of
  which are in this commit: deletions of `app/actions.ts`, `components/Reel.tsx`,
  `components/SignupForm.tsx`, `lib/supabase.ts`, `lib/carousels.ts`, all of `dist/`,
  `future-clips-site.zip`, `future-clips.html`, `future-clips-site/_source/*`; edits to
  `app/page.tsx`, `lib/campaigns.ts`, `design/build_site.py`, `README.md`, `.gitignore`
  (adds `future-clips-site.zip`), `future-clips-site/README.txt`; a new `HANDOFF-SITE.md`;
  and a `package.json` / `package-lock.json` that drop `@supabase/supabase-js` and pin
  `next` to 15.5.24. This commit's `package.json` is the previous HEAD + `sharp` only.
  Expect a conflict on `package.json` / `package-lock.json` when the site commit lands:
  keep their removals, keep `sharp`, regenerate the lock (`npm install --package-lock-only`).
  `dist/` is listed as engine surface but the site session is deleting it; it was left to
  them.
- `sharp` was only ever installed as `next`'s optional dependency. It is now a direct
  dependency; do not remove it — every style imports it.
- `app/api/generate/route.ts` → `engine/index.mjs` no longer exists at that path (see
  What is broken).
- `engine/generate.mjs` builds the copy prompt from a per-style JSON **shape**
  (`SHAPES`). Adding a field to a style's renderer without adding it to the shape means the
  model will never produce it — it ignores field descriptions given as prose.
- `engine/providers/image.mjs` caches on the sha of (model, prompt, size, quality,
  reference-image bytes). Editing any prompt text in `art.mjs`, `character.mjs` or
  `scenes.mjs` invalidates every cached frame downstream — the next run pays in full.
  Changing `assets/campaigns/character/ref.png` does the same for bedrock.
- `campaigns/*.json` paths are relative to the repo root. Campaign photo dirs still point
  at untracked `output/...` folders; only `art=ai` runs are reproducible from a clone.
- `output/gen/pairing-history.json` is state: it steers which font pairing the next set
  gets. Deleting it is harmless; committing it is pointless.
- `tools/_attic/` and `engine/_attic/` are excluded from nothing by `.gitignore`; the
  `tools/_*.mjs` ignore rule matches files, not the `_attic` directory.

## Open decisions

- **Gym feed = "days" mode** (one person, new outfit and place every frame) rather than
  one session. This is what reference set-08 does and what the owner asked for after
  rejecting the same-clothes version; a brand that wants one shoot can pass
  `mode=subject` and will get the session look back.
- **Trading feed = one world per set** (one time of day and palette, chosen by seed; two
  of four worlds are daylight). The owner's complaint was "each one does not match the
  next" and "always dark"; a per-frame free-for-all is one line away in
  `scenes.mjs` if variety is preferred.
- **Font pairing rotates per set** and is pinned per set, not per brand. Pass
  `pairing=<id>` (or `assets.pairing` in the campaign) for a house font.
- **Hand numbering wins.** When the model writes "myth 5 … myth 1" or "#5 · 6/10", its
  numbers are rendered and the mechanical countdown is not. Reasonable, but it means the
  model can produce a broken sequence and the renderer will faithfully show it.
- **Bedrock's accent is the campaign palette[1]** (APEX renders orange, not bedrock.form's
  red). Correct for a brand campaign; wrong if the aim is to clone bedrock.form exactly.
- **Opus 5 for copy.** Sonnet 5 is ~2.5× cheaper and untested on this prompt; the copy is
  the cheapest line either way.
- The old `output/round-*` renders were untracked in this commit (144 MB of a direction
  the owner rejected). They are still on disk if anyone wants them back.

## Do not

- Do not "fix" the imagery by locking one outfit, one room or one lighting across a gym
  set. That was built, it was coherent, and the owner rated it "very very bad … too AI".
  The reference is one *person* across many days.
- Do not source stock photos (Pexels/Unsplash) or drop `art=ai`. Rejected 2026-09-07:
  "generic stock images … use ai please". The stock layer is in `_attic` on purpose.
- Do not describe a new copy field to the model in the brief text. Put it in the style's
  JSON shape in `engine/generate.mjs` (`SHAPES`), or it will not exist in the output.
- Do not reintroduce the cinematic grade as a default. `phone` (no grade) is what the
  human feed uses; the world picks `clean`/`sunlit` for daylight. "Always dark" was a
  direct complaint.
- Do not delete `engine/_attic/` until `app/api/generate/route.ts` is gone; and do not
  put anything new in `_attic` — it is a graveyard, not a staging area.
- Do not commit `.env.local`, `output/`, or the packaged copy at
  `D:\Side Quests\hm\future-clips-product\` (a manual snapshot, not a build artefact).
