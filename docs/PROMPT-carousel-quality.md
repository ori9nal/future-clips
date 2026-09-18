# Make the carousels not look like AI. Gauntlet until they pass as real posts.

You are working in `~/Projects/Side Quests/hm/Future Clips` (Node 22+, `npm install` done, keys in `.env.local`). This is The Future Clips: a brief goes in, a TikTok/Instagram carousel comes out — Claude writes the copy, gpt-image-2 draws the frames, the engine draws the type in code. **The output currently reads as AI-made. Your one job is to make it read as a real creator's post, judged against the real posts in the repo.** Nothing about the app, the site, billing or the database is in scope.

## Read these first, in this order

1. `Carousel examples/reference-2026-09/ANALYSIS.md` — what 15 real high-performing sets actually are (two families: wealth/trading and gym/physique; small type, thin outline, numbered countdown, app screenshot last).
2. Every slide in `Carousel examples/reference-2026-09/set-01…set-15/` and `Carousel examples/1…15/`, `GYM niche/`, `Random niche/`. **Look at every image.** Build your own written taxonomy before you touch code: per set — niche, aspect, slide count, hook pattern, where the text sits, type size relative to canvas, stroke, what the photo is (a person? a place? a body part? a screen?), lighting, colour, how "amateur" it is (phone grain, crooked framing, cut-off heads, flash, mirror, mess in the background), caption voice, emoji use, how the app is shown.
3. `HANDOFF-ENGINE.md`, `output/gauntlet/GAUNTLET-2026-09-13.md`, `OPEN-DECISIONS.md` §9 — what was built, what the owner already rejected (stock photos; one outfit/one room across a gym set; "always dark"; heavy CapCut strokes; big type), and the de-slop pass.
4. The prompt surfaces you will rewrite: `engine/generate.mjs` (`SHAPES`, `SCENE_DIRECTION`, `systemFor`, `buildCopyRequest`, `judgeCopy`), `engine/scenes.mjs` (worlds, DAYS and ANATOMY banks — what the image prompts say), `engine/art.mjs` (anchor + edit-with-reference plan, "days" mode), `engine/deslop.mjs` (the phone-photo pass, knobs), `engine/styles/feed.mjs` and `engine/render-native.mjs` (how type is set on the frame), `engine/compliance.mjs` (never weaken it).
5. The current output, so you know the baseline: `output/gauntlet/g1/G1-sheet.jpg` (APEX gym), `output/gauntlet/demo/FUEL-native.jpg` (nutrition), `output/gauntlet/demo/TRADELENS-feed.jpg` (trading), and every `output/sets/*-priority/slide-*.png`.

## What "AI slop" means here — the tells to kill

Name each tell you see in the current output next to the reference that does it right. Expect at least these: faces too symmetrical and lit like a catalogue; every frame perfectly exposed and centred; the same "handsome model" energy; clean backgrounds; skin too smooth; text that explains instead of talks; captions that sound like a brand; nouns without specifics ("great workout") where a real post says "3 sets of 12 at 6am"; the same shot type in every frame; sunsets and supercars that look rendered; no mess, no cut-offs, no flash, no phone in the mirror, no timestamps, no ugly gym floors. The references are slightly ugly and completely specific. That is the target.

## What you will produce

1. **`docs/CAROUSEL-MASTER-PROMPT.md`** — the new master prompt system, in three parts, each written to be pasted into the engine:
   - **Copy prompt** (per style, per niche family): voice rules with examples lifted from the references (real lines, quoted), hook patterns that actually appear in the corpus (count them), what the closer does, caption + emoji rules, banned phrasing list, and the JSON shape the renderer needs (keep field names from `SHAPES`).
   - **Image prompt** (per niche family): how to describe a frame so gpt-image-2 returns a *phone photo, not a photograph* — lens, exposure mistakes, framing mistakes, environment mess, "shot by a friend / mirror / propped phone", time-of-day variety, what to forbid (studio lighting, bokeh, symmetry, catalogue poses). One anchor description per subject that holds identity without holding wardrobe. Write the trading/aspirational world prompts so they read as *someone's* camera roll (fingerprints on the window, dashboard glare, a hand in frame), not a rental-company brochure.
   - **Post-processing recipe**: what `deslop.mjs` should do per niche family (strength, exposure floor, grain, crop, JPEG), with numbers, derived from measuring the references (mean luminance, noise, saturation — measure them with sharp, do not guess).
2. **The engine changes** that implement it (`generate.mjs`, `scenes.mjs`, `art.mjs`, `deslop.mjs`, and the type sizes/stroke in the styles if the measurements say so). Keep every existing export and the compliance loop intact; `npm test` must stay green.
3. **`output/gauntlet/GAUNTLET-<date>.md`** with every round: what changed, the sheet, the score, the cost.

## The gauntlet

- Render with the same path the product uses: `node tools/lane.mjs campaign=<id> ask="…" lane=priority slides=6-8 style=feed|native` (≈$0.35–0.45 a set, ~2.5 min). `tools/rerender.mjs campaign=<id> style=<style>` re-renders from cached frames for **$0** — use it for every type/grade/deslop change; pay only when the image prompts change. Sheets: `node tools/_sheet-set.mjs <set dir> <out.jpg>`.
- OpenAI's edit limit is 5 reference images a minute (`OPENAI_INPUT_IMAGES_PER_MIN`); render sets one at a time.
- Campaigns to use: `apex-strength` (gym, feed, "days" mode), `tradelens-app-reachify` (trading, feed, aspirational worlds), `fuel-prep` (nutrition, native), `core-creatine` (supplements, feed). At least one paid round per family per iteration of the image prompt.
- **Score every round out of 100 against the references, not against the previous round**, on this rubric, and write the number down before you write the excuse: photo realism 30 (would a stranger believe this is a phone photo?), specificity of copy 20 (numbers, names, days, weights, prices), hook 15, type treatment 10 (size, stroke, placement vs the reference), consistency of person/world 10 (right kind — one person across days, one world across a set), platform-nativeness 10 (aspect, numbering, app slide, caption), compliance 5 (must be 5/5 or the round is void).
- Stop when three consecutive rounds across the three families score ≥ 90 with the sheet placed next to the closest reference set and you cannot point to a slide that gives it away. Budget: **$12** across the whole gauntlet; write the running total in the log. Do not exceed it without asking.

## Rules

- Do not source stock photos. Do not lock one outfit/room across a gym set. Do not default to dark grades. Do not enlarge the type to "make it pop". Do not weaken `compliance.mjs`. Do not touch the app, the site, Supabase or Vercel. Do not commit; leave the diff for the owner and list every file.
- Measure, don't assert: when you claim the references have "small type", give the pixel size; when you claim "grainy", give the noise figure. Put the numbers in the master prompt doc.
- Show the owner sheets, not descriptions. Every message that claims progress carries a before/after contact sheet with the closest reference set beside it.
