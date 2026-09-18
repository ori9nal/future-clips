# QUALITY.md — how a carousel is judged, and what the references actually are

Owner: Product (this chat). Companion to docs/PRODUCT.md (the product) and docs/ROADMAP.md (requests, Done log).
Every prompt or style rule written from here on cites a count or a measurement from this file.

## 0. Budget

- Owner budget: **not set** (DECISIONS D-018 asks for a weekly amount and a ceiling). Until it is, a session spends at most **$5** and stops to ask.
- Session 2026-09-18: spent **$0.47** (round 0). Remaining this session: $4.53.
- Rule of thumb: a 7–8 slide priority set is $0.45–0.50; batch halves it; a re-render is $0. Prompt text is a cache key, so any change to a string in engine/art.mjs, engine/scenes.mjs or the copy shape re-pays every frame downstream.

## 1. The rubric (adopted from docs/PROMPT-carousel-quality.md, unchanged)

Score every round out of 100 **against the references, never against the previous round**, with the sheet placed beside the closest reference set. Write the number before the excuse.

| Axis | Points | What earns them |
|---|---|---|
| Photo realism | 30 | Would a stranger believe this is a phone photo. Mess, blown windows, flash, phone in the mirror, uneven skin. Catalogue light, smooth skin, clean floors and rendered supercars lose points. |
| Specificity of copy | 20 | Numbers a real post has: sets × reps, kg, minutes, $, %, a time of day, an app named. Nouns without numbers lose points. |
| Hook | 15 | One of the counted corpus patterns (section 4), under 12 words, readable at thumbnail size. |
| Type treatment | 10 | Size, stroke, placement versus the family's measurements (section 3). |
| Consistency of person or world | 10 | Gym: one person across many days. Trading: one life (car, city, watch), day and night mixed. Collage family: one palette. |
| Platform-nativeness | 10 | Aspect, numbering direction, ratings when ranking, the app shown the way the family shows it, caption with 2–3 fitting emojis. |
| Compliance | 5 | Must be 5 or the round is void. |

Stop criterion: three consecutive rounds across gym, trading and Grow-with-Alex scoring ≥ 90 with the reference beside the sheet and no slide anyone can point to.

## 2. How things are measured

`tools/_measure.mjs <dir>` (git-ignored scratch tool, present in the main checkout) prints per image, at 720 px wide for the photo statistics and native resolution for the type survey:

| Column | Meaning |
|---|---|
| lum, std | luminance mean and standard deviation (0–255). std is the "contrast" figure. |
| dark%, clip% | share of pixels below 12 and above 243 |
| sat | mean saturation (max−min)/max |
| noise | RMS residual against a 3×3 median in flat areas (the "flat-area noise" / grain figure) |
| flat% | share of pixels that count as flat (gradient < 6) |
| sharp | RMS Laplacian |
| lines, lineH, lineH/W | count of outlined-white-text bands; median band height in px and as a fraction of the canvas width |
| stroke | median dark run beside white text, px (the visible outline plus any dark ground touching it) |
| top, bot | first and last text band as a fraction of canvas height |

Type sizes are also read by eye from native-pixel crops with a 25 px grid (`output/gauntlet/2026-09-18/type-calibration.jpg`) because lineH is a median across heading and body lines. Cap height is the number quoted below; em ≈ cap / 0.72 for the platform sans.

Sheets: `scratchpad/pair.mjs <out> <label> <cellH> <oursDir> <refDir>…` builds ours-over-reference sheets; `tools/sheet-set.mjs` builds a single-row sheet with the cost line.

## 3. Taxonomy per family (counted and measured, 2026-09-18)

Corpus looked at in full: `Carousel examples/reference-2026-09/set-01…15` (84 slides), `Carousel examples/1…15, GYM niche, Random niche` (154 files, 17 folders), `reference/growithalex/` (18 images + SHEET.png), `New reference stuff/*.zip` (5 sets, 34 slides), `public/carousels/` (15 covers, other creators' posts shown with permission, never our output), and the public grid of instagram.com/growithalex (33 covers visible without login; full posts need a signed-in browser, see ROADMAP).

### 3.1 Gym / physique family — sets 05, 07, 08, 09, 10, 13, 15 (+ old corpus 14, 15, GYM niche)

| Property | Measured / counted |
|---|---|
| Aspect | 3:4 (1080×1440) and 9:16 (1080×1920, 1170×2080) about equally; set-08 is 9:16, set-13 mixes 3:4 and 4:5 slide to slide |
| Slide count | 4–9, median 7 |
| Photo | mirror selfie 27 %, close crop with no head 20 %, friend shot 16 %, POV of own body 13 %, phone-with-app 13 %, objects 8 %, outdoors 7 % (70 slides). A clear face straight to camera on 8 of 70. New outfit in nearly every frame. |
| Lighting | overhead gym LED, blown windows, flash in mirrors; lum 80 mean, std 60, dark 18 %, sat 0.25, noise 1.28, flat 63 %, sharp 29 (44 slides) |
| Type | platform sans (TikTok Classic), sentence case, white, thin outline. Heading cap height 48–52 px on a 1080-wide canvas (set-08 "5. Dumbbell curls" = 50 px), body cap 36–40 px (set-13). lineH median 48 px, 0.044 of width. Visible outline 5–7 px (median 5.7) ≈ 0.11 of cap height. |
| Block position | top 0.33 H, bottom 0.57 H (means); the block sits across the chest or mid-frame, not at the top |
| Ratings | x/10 in 2 of 7 sets (08, old-15), both "top N exercises" ranking asks; negative and 1000/10 allowed |
| Numbering | countdown in the two rated sets; count-up in 13, 15; "Day 1–4" in 10; none in 05 (numbered tips 1–5 count up), 07, 09 |
| App slide | 6 of 7 sets: "Pro tip / bonus tip / QUICK TIP" + a phone photographed on a bench, floor, table or in a hand, LAST in 5 of 6, second-to-last (before #1) in set-08 |
| Copy voice | first person, lowercase "i", "lol", "lowkey", "FAVVV", one CAPS word; sets × reps in 4 of 7 sets |
| Emoji on slides | 3 of 44 slides (💪 after "RDLS", ➡️, 💀) |

### 3.2 Wealth / trading family — sets 01, 02, 03, 04, 06, 11, 12, 14 (+ new sets 7681616…, 7682783…)

| Property | Measured / counted |
|---|---|
| Aspect | 3:4 dominant (1080×1440, 1200×1600), some 9:16 (1180×2096) |
| Slide count | 2–8, median 5 |
| Photo | car exterior 18 %, person from behind / hooded / hand 18 %, desk-and-monitors or penthouse window 18 %, pool / palms / dusk 18 %, plane 10 %, car interior POV 8 %, boat 8 %. Faces: none visible in 6 of 8 sets. Daylight frames 37 %; set-01 is 4 daylight of 5. |
| Lighting | lum 70 mean, std 57, dark 20 %, sat 0.37, noise 1.57, flat 66 %, sharp 35 (40 slides). Night frames ~35 lum, day frames 90–130. |
| Type | platform sans, white, thin outline; lineH 50 px on 1080–2160 canvases, 0.034 of width (smaller than gym); body cap ≈ 37 px on set-01; outline median 6.3 px |
| Block position | top 0.36 H, bottom 0.56 H (centred just above the middle) |
| The app device | icon as a rounded square ~27 % of width, upper-centre, white pill with black "N. Name" under it (cap ≈ 60 px), one small caption under that — sets 01, 04, 14; small icon + name inline in 02, 06; a screenshot pair only in the new self-improvement sets |
| Numbering | count-up 1→N in 04, 13, 14, 15; countdown 4→1 in 01, 5→1 in 08 (both rankings). Month 1-2 → 10-12 in 11. |
| App position | inside the list (every item is an app) in 01, 04, 14; slide 4 of 5 in 02, 03; slide 3 of 8 in 11; last in 06, 12 |
| Copy voice | "fr", "gamechanger", "..", "Bro I don't know how to start trading…" as a quoted DM; specific pairs, months, $5k–$10k, 1 % risk |
| Emoji on slides | 2 of 40 (💯, 🗣️) |

### 3.3 Dark self-improvement collage — New reference stuff 7684095…, 7684464…, 7684640… (visual reference only; no campaign, no brand inferred; "Journey" is the app those posts advertise and nothing more is assumed about it)

| Property | Measured / counted |
|---|---|
| Aspect | 9:16 (828×1472, 900×1600) and 3:4 |
| Slide count | 6–9 |
| Photo | 2×2 photo grid on every slide of 7684464 (laptop, watch, bed, skyline, cash, chart), single dark aspirational frames elsewhere (Porsche, yacht, jet, marina at night, mountain lake) |
| Lighting | lum 40, dark 38 %, sat 0.29, noise 1.25, flat 72 % — deliberately dark, the darkest family |
| Type | bold platform sans headline 50–63 px lineH (0.05–0.07 of width) centred at 0.44–0.58 H, three bullet rules under it at 11–17 px lineH; numbered rules "1. Wake up with purpose." with one sub-line |
| Structure | hook = "how to upgrade your life in 90 days [Self-Discipline]" / "8 rules to stop wasting your life:"; N numbered rules; the app on slide 7 of 9 (screenshots + "I use "Journey" to block…"), or an App Store screenshot on slide 5 of 6 |
| Note | the old "always dark" complaint was about the trading family drifting dark; this family is dark by design and needs its own style if the owner wants it (D-015) |

### 3.4 Grow with Alex family — reference/growithalex (18 images) + the public Instagram grid

| Property | Observed / measured |
|---|---|
| Aspect | 4:5 (1080×1350) on 15 of 18; Level 1–3 are 4:5 at other sizes |
| Header strip | every post: "GROW WITH ALEX · ▶ 229K SUBSCRIBERS" or "MAY @2026 · GROWITHALEX · CREATIVE STRATEGIST", small tracked caps, top 0.05 H |
| Loud / quiet fonts | ONE loud word in a display serif (often italic: "carousel", "prompt", "formula", "evergreen", "win.") or in a heavy condensed sans (WORDS WIN, VISUAL HOOK, brand WORLD), paired with a quiet geometric sans for the qualifiers ("steal my", "system", "6 folders inside my", "dies in a week"). The loud word is 0.25–0.40 of the canvas width tall-set; the quiet lines 0.02–0.03. |
| Hierarchy per cover | 1 header strip, 1 loud word, 1–2 quiet lines, 1 image, 1–3 floating "document" cards (the product), 1 footer triplet ("6 rules. Every carousel. No exceptions." / "5 Rules · Same Post ›" / "6 Types · Every Post · No Guessing") — 6–8 elements |
| Image | the creator in a surreal composite: desert, burning car, a horse at sunset, a giant head in the sand, a dragon; or a bust; never a plain portrait |
| Colour system | orange accent (#E9622B-ish) + cream/white type on blue-and-orange photographs; the "Level" pages invert to cream paper with black type and an orange pen-red |
| Density | measured lines per image 6.5, mean lum 99, sat 0.40, noise 1.5 |
| Level 1 → 2 → 3 | the same headline ("After 10 years: WORDS WIN") at three production levels: 1 = cream page, two-font type, page number, nothing else; 2 = adds one photographed object (a pen) and a red splash; 3 = adds the creator, the sky, the italic serif contrast and the header strip. The structure that changes is IMAGE presence and font contrast, not the words. |
| Copy | numbers everywhere: 17 Claude Skills, 6 rules, 25K likes, 67,800 likes, 229K subscribers; imperative "steal my…" on 7 of 33 grid covers |

The engine's `rail` style was built from this family. Measured against it today (section 5) it keeps the header strip and one loud face but has no loud/quiet contrast, no person, no product cards, no footer triplet, and moody stock mountains instead of a composite. D-014 asks the owner to confirm this is the family they mean.

### 3.5 The older corpus (Carousel examples/1–15, Random niche) in one line each

1 and 2: @bedrock.form cel-shaded programme (our `bedrock`). 3: black-on-white serif list with a cut-out figure (`editorial`/`document`). 4: mono typewriter finance rules with tables (`document`). 5: yellow/black CapCut-bold design tips (`poster`). 6: pink-grid finance literacy (`pastel`). 7 and 9: agency "carousel design" explainers. 8: dark green editorial with italic serif. 10: UFC red/white poster (`poster`). 11: Dr Longevity clinical illustrations (`clinical`). 12: AI product-shot prompts. 13: white running editorial, orange accent, cut-out runners. 14: two-slide "Maturing is realising…" + app screenshot. 15: rated bicep exercises (gym family, see 3.1). None of these is a product path today; they anchor the ten non-feed styles.

## 4. Hook patterns, counted (20 sets: reference-2026-09 + the five new sets)

| Pattern | Count | Examples (quoted from the corpus) |
|---|---|---|
| Number + list ("N things / top N / N rules / N ways") | 10 | "4 trading apps I'll never uninstall", "Top 5 PEAK exercises for BICEPS", "7 muscles I regret skipping…", "8 rules to stop wasting your life:" |
| "How I / how to" narrative | 3 | "How I became a profitable trader", "How I would structure the first year…", "how to upgrade your life in 90 days" |
| Quoted DM / quote | 2 | „Bro I don't know how to start trading…", "I want to go to gym 4x a week" |
| Colon lead-in | 2 | "Traders don't sleep on this:" (twice) |
| Contrarian | 1 | "TJR will not make you profitable.." |
| Gatekeep | 1 | "hot girls don't gate keep / ab guide➡️" |
| Milestone ladder | 1 | 100k month … 1st funded (on a mountain) |

Rule that follows: the hook is a count plus a promise in 50 % of the corpus, a "how I" in 15 %, a quoted DM in 10 %. Nothing in the corpus opens with a confession or a brand line.

Numbering direction, counted over the 12 numbered sets: count-up 1→N in 9 (75 %), countdown N→1 in 3 (25 %), and the countdown appears **only** with x/10 ratings (set-01 is the exception, 4→1 without ratings). Rule: countdown only for a rated ranking; everything else counts up. Our tradelens set (habits, 5→1) breaks it.

Ratings x/10: 2 of 20 sets, both "top N exercises" asks. Rule: scores only when the ask is a rating or ranking of exercises (already in generate.mjs).

App slide: LAST in 8 of 18 sets that show one, second-to-last in 3, inside the list in 7. Gym = a phone photographed with the app open under a "Pro tip"; trading = the icon-on-pill or an icon row; self-improvement = a screenshot pair.

## 5. Baseline scores (2026-09-18) — sheets in output/gauntlet/2026-09-18/

| Set (on disk unless noted) | Closest reference | Score | Measured vs reference | The tells |
|---|---|---|---|---|
| apex-strength-feed-priority = g1 (2026-09-13) | set-08, set-13 | **66** (realism 14, specificity 15, hook 11, type 5, consistency 8, native 8, compliance 5) | noise 4.50 vs 1.28 (3.5×), std 43 vs 60, sat 0.18 vs 0.25, lum 60 vs 80, flat 23 % vs 63 % | every frame a mirror selfie of one smooth-faced man, sand-blasted with grain; block at 0.24 H |
| **Round 0** apex-strength, "top 5 exercises for wider lats, rated honestly", current prompts, $0.47, 184 s | set-08, set-13 | **73** (realism 20, specificity 16, hook 12, type 5, consistency 7, native 8, compliance 5) | lum 84 vs 80 ✓, std 63 vs 60 ✓, sat 0.23 vs 0.25 ✓, noise 1.80 vs 1.28, flat 46 % vs 63 %, lineH 35 px vs 48 (0.033 vs 0.044 of width), cap height 35 px vs 50 (heading) and 27 vs 40 (body), stroke 6.0 vs 5.7 ✓, block 0.26–0.46 H vs 0.33–0.57 | type 1.4× too small and sitting too high; slide 2 ("barbell rows") is a thigh crop; skin still smooth; rooms too tidy; grain 40 % high |
| tradelens-app-reachify-feed-priority (2026-09-13) | set-11, set-02 | **59** (realism 12, specificity 14, hook 8, type 6, consistency 7, native 7, compliance 5) | lum 24 vs 70, dark 52 % vs 20 %, sat 0.52 vs 0.37, noise 3.5 vs 1.6, lineH 30 px vs 50, block 0.24–0.41 vs 0.36–0.56 | the whole set is a black night world with a cinematic grade ("always dark", the owner's complaint); a serif heading face where the corpus is 100 % the platform sans; habits counted 5→1; no hand, no shoe, no car repeated, so no "one life" |
| fuel-prep-native-priority (2026-09-13) | set-10, set-15 | **67** (realism 15, specificity 17, hook 11, type 7, consistency 6, native 6, compliance 5) | noise 3.6 vs 1.3, flat 20 % vs 63 %, lineH 57 px (9:16 ok) | one man in one grey tee and black shorts in all eight frames (the rejected one-outfit pattern); muted "cinematic" grade; heavy stroke; no numbers on a ranked list; the app slide is "FUEL link in bio" over a photo, not a phone with the app |
| core-creatine-feed (2026-09-11) | set-15, set-05 | **58** (realism 10, specificity 15, hook 10, type 4, consistency 7, native 7, compliance 5) | lum 137 vs 80, sat 0.17, stroke 2.6 px vs 5.7 | a bright white catalogue gym that reads as a render; Fraunces serif heading (a designed pairing, the loudest tell); hairline outline; the app slide is a scrim over a mirror selfie |
| summit-craft-rail + northbound-trail-rail | reference/growithalex 1, 3, 5, 7, 8, Brief | **45** (image fit 8, specificity 8, hook 6, type 5, consistency 8, native 5, compliance 5) | lines per image 2.0 vs 6.5; sat 0.22 vs 0.40; lum 96 vs 99 | moody stock mountains, no person, no product cards, no footer triplet, one condensed face with no serif contrast, aphorisms without a number |

The de-slop knobs in the working tree were already re-tuned on 2026-09-13 (engine/deslop.mjs header); the on-disk sets predate that. Round 0 is the first render with the current knobs and confirms the tune is right on luminance, contrast and saturation, and still 40 % heavy on grain.

## 6. Recurring-failure table

| # | Failure | Family | How often | Surface that owns it | Fix attempted | Round fixed |
|---|---|---|---|---|---|---|
| F1 | Caption type 1.4× smaller than the reference (cap 35 px vs 50 heading, 27 vs 40 body) | gym, trading | every set | engine/styles/feed.mjs `SIZE`, `OUTLINE` | `SIZE = 1.4`, `OUTLINE` 0.095; cap heights now 50 / 38 px on the calibration crop | 1a |
| F2 | Text block sits in the top third (0.26 H) where the reference centres it (0.33–0.57 H) | gym, trading | every set | engine/styles/feed.mjs `quietBand` fracs and cost | bands 0.20–0.48 H + a position cost towards 0.34 H; measured 0.35–0.54 (gym), 0.29–0.52 (trading) | 1a |
| F3 | Grain 40 % above the reference (noise 1.80 vs 1.28), flat area 46 % vs 63 % | gym, food, trading | every set | engine/deslop.mjs KNOBS.noiseMono / noiseChroma | 4.2/2.2 → 2.4/1.3; frame-only noise 1.27 vs 1.28 | 1b |
| F4 | Trading set entirely night, lum 24 vs 70; "always dark" | trading | the set on disk (pre-09-13 code) | engine/scenes.mjs times (day/night alternate since 09-13) | round 2 measured lum 90 with 5 of 7 frames daylight: the old failure is gone; watch for the opposite (too bright) over the next rounds | 2 |
| F5 | Habits / rules / lessons counted down; the corpus counts up unless rating | trading, gym lessons | tradelens set on disk | engine/generate.mjs SHAPE "numbering" + RULES_NATIVE, judgeCopy, toRenderable | "numbering": "countdown \| up \| none"; the judge rejects a countdown with nothing rated and no ranking in the hook; `npm test` covers it (D-033) | rule landed 2026-09-18, verified on the next paid habits/lessons ask |
| F11 | The trading LIFE's car changes between frames (a Lamborghini on slide 1, a different car on slide 2) | trading | round 2 | engine/scenes.mjs LIVES / BANK.trading car lines (aspirational mode has no reference image, so the car is re-drawn each frame) | proposed: name the car's colour and model in every car frame and forbid "a different car"; or draw car frames as edits of the hook frame | — |
| F12 | The app-icon pill and icon smaller than the reference (pill cap ≈ 32 px vs 60; icon 27 % of width reads small under it) and a "score" tag line under the app name that no reference carries | trading | round 2 | engine/styles/feed.mjs `iconLockup` (pill `pt`), toRenderable `cleanScore` for icon slides | proposed: pill 44 → 76 pt, no score line on icon slides | — |
| F6 | A scene the anatomy table cannot map renders as an unrelated body crop (round 0 slide 2, "barbell rows" → thighs) | gym | 1 of 8 slides in round 0 | engine/scenes.mjs ANATOMY (rows map to "back from behind" but the shot type was pov) | proposed: pov shots only for arm/forearm/abs; rows/pulldowns force `friend` or `crop` | — |
| F7 | Same outfit across the set in the native style | food | fuel set | engine/scenes.mjs enforceFood has no outfit dealer; art.mjs `days` | proposed: deal OUTFITS in enforceFood cook frames | — |
| F8 | Designed font pairing on the feed (serif heads on tradelens and core) | trading, supplements | 2 sets on disk | engine/styles/feed.mjs (already forced to 'phone' since 09-13; re-render to confirm) | R1: re-render tradelens/core with the current pairing rule | — |
| F9 | The app shown as text over a photo instead of a phone photograph | food | fuel set | engine/render-native.mjs app slide, scenes.mjs food bank `phone` | proposed for the native style pass | — |
| F10 | Rail style is not the Grow with Alex format (no loud/quiet contrast, no person, no cards, no footer triplet) | Grow with Alex | every rail set | engine/styles/rail.mjs, pairings.mjs | needs a spec (section 3.4) and an owner decision (D-014) before a rebuild | — |

## 7. Round log

| Round | Date | What | Cost | Score | Evidence |
|---|---|---|---|---|---|
| baseline | 2026-09-18 | scored the sets on disk against the references, no spend | $0 | 66 / 59 / 67 / 58 / 45 | `output/gauntlet/2026-09-18/pair-*.jpg` |
| 0 | 2026-09-18 | apex-strength, priority, feed, "top 5 exercises for wider lats, rated honestly", current prompts | $0.4724 (copy $0.0772 + art $0.3951), 184 s, compliant first attempt, 8 slides | **73** | `pair-round0-apex-vs-set08-set13.jpg`, `round0/` |
| 1a | 2026-09-18 | round 0's frames re-rendered with engine/styles/feed.mjs `SIZE = 1.4` (captions scaled to the measured cap heights), `OUTLINE` 0.13 → 0.095 (visible outline held at 5–7 px), caption bands moved to 0.20–0.48 H with a position cost towards 0.34 H | $0, 20 s | **77** (type 5 → 8: heading cap now 50 px = set-08, body 38 px = set-13; block 0.35–0.54 H vs reference 0.33–0.57; stroke 6.4 px vs 5.7; realism unchanged, copy unchanged) | `pair-round1a-apex-vs-set08.jpg`, `type-calibration-r1a.jpg`, `round1a/` |
| 1b | 2026-09-18 | + engine/deslop.mjs grain 4.2/2.2 → 2.4/1.3 (one knob, pro rata) | $0, 33 s | **79** (realism 20 → 22: frame-only noise 1.27 vs reference 1.28, flat 57 % vs 63 %, lum 83 vs 80, std 60 vs 60, sat 0.23 vs 0.25 — the photo statistics now sit on the reference family; what is left is the content of the frames: smooth skin, tidy rooms, the wrong-body crop on slide 2) | `round1b/` |
| — | 2026-09-18 | core-creatine-feed re-rendered with the current code (F8 check) | $0, 24 s | pairing is now `phone` (the serif tell is gone in code); frames unchanged so lum stays 125 — the bright catalogue gym needs a paid round with the current scene bank | `output/sets/core-creatine-feed` |
| 2 | 2026-09-18 | tradelens-app-reachify, priority, feed, "4 trading apps i check before every session, ranked", current prompts + rounds 1a/1b type and grain | $0.3503 (copy $0.0804 + art $0.2699), 126 s, compliant first attempt, 7 slides | **78** (realism 21, specificity 17, hook 13, type 7, consistency 7, native 8, compliance 5). Measured: lum 90 vs reference 70 (5 of 7 frames daylight — "always dark" is gone, now a shade bright), sat 0.32 vs 0.37, noise 1.92 (with text) vs 1.57, lineH 47 vs 50, stroke 4.7 vs 6.3, block 0.29–0.52 vs 0.36–0.56. Tells: two different cars across the set (the LIFE's car should repeat), the app pill and icon smaller than set-01's (pill cap ≈ 32 px vs ≈ 60), a "score" tag line under each app name that no reference carries, the Lamborghini too clean. Copy is on the corpus pattern (8am, 15 mins, 1 %, "PEAK"). | `pair-round2-tradelens-vs-set01-set14.jpg`, `round2/` |

Running total this session: **$0.82** (round 0 $0.47 + round 2 $0.35). Remaining under the $5 default: $4.18.

Score after rounds 1a+1b, gym family, against set-08: **79**. Axis by axis: realism 22, specificity 16, hook 12, type 8, consistency 7, native 9, compliance 5. The next points are in the frames (paid): the scene→anatomy mapping (F6), skin and room mess (art.mjs GUARD / scenes CAMERA), and the person holding across every frame.
