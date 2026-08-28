# GAP.md — what still separates our carousels from the references

Generated set: `output/atlas/` — 4 carousels, 30 slides, campaign `atlas-fitness`,
template `f1-single-cutout`, 4/4 passing the campaign rules validator.

```
node --env-file=.env.local tools/build-library.mjs --niche fitness --kind people
node tools/dedupe-library.mjs      --niche fitness --kind people --apply
node tools/translucency-check.mjs  --niche fitness --kind people --apply
node tools/render-campaign.mjs
```

---

## What now matches the reference format

| Reference property | Ours | |
|---|---|---|
| White ground | `#FFFFFF` flat, no gradient | ✅ |
| One B&W cutout | real matted photograph, per slide | ✅ |
| Plain regular-weight sans, lowercase, top-left | Archivo 400, `lowercase: true` | ✅ |
| Mono @handle bottom-left | JetBrains Mono 400 | ✅ |
| → arrow bottom-right | ✅ | |
| No accent colour | accent === ink, 0 chromatic clusters by construction | ✅ |
| No grain / vignette / split-tone | none | ✅ |
| Bleeds an edge | bottom, anchor-driven | ✅ |

Everything the *previous* direction got wrong — dark plates, split-toning, grain,
coloured accent words, procedural silhouettes — is gone.

---

## The gap, stated precisely

**It is no longer a rendering problem. It is a semantic-selection problem, and it
is glaring.**

Look at `output/atlas/f1-p00-B`. The carousel is about running and lifting. It shows:

- slide 03 — **a man in a business suit**
- slide 02 — a man in a polo shirt
- slide 04 — a man in jeans and a Superman t-shirt
- closer — a man in a plain tee, leaning

Not one of them is doing anything athletic. Every cutout is technically
immaculate — clean alpha, full tonal range, correct scale, correct bleed, no
halo, no ghost, no duplicate — and the set is still wrong, because a suit does
not belong on a slide that reads *"hard days hard, easy days easy."*

This is exactly the failure the brief predicted: **a perfectly graded photo of
the wrong subject is still wrong.** Every gate I can compute from pixels now
passes. What is left requires knowing what the photograph is *of*, and no
pixel statistic answers that.

### Why the stock queries do not fix it alone

The queries ask for `"fitness model standing plain backdrop"` and
`"athletic man standing full body white background"`. Pexels and Unsplash return
generic studio people for both, because that is what those phrases match in
their tag space. Tightening the wording moves the distribution a little and
costs a lot of API calls; it does not make the result *verified*.

The brief's own answer is the right one, and it is the piece not yet built: an
LLM turns each slide's beat into a query, **and a vision check confirms the
returned frame actually depicts that beat** before it enters the library.

---

## Secondary gaps

1. **Dead space.** The reference sets the subject large and lets it dominate the
   lower two-thirds. Ours are smaller and leave more empty page, particularly on
   interior slides. Partly a sizing parameter, partly a consequence of stock
   subjects being shot full-body with margin.
2. **No F2 or F3.** SCRAPBOOK-COLLAGE and TWO-OBJECT-COMPARE are unbuilt, and the
   object library (`library/niches.json` → `objects`) has never been run. The
   $1,200-phone-vs-$1,200-race-entry comparison — the 37k post — needs F3.
3. **The ideas are hand-authored.** `concepts/atlas-fitness.json` is four
   concepts I wrote to the idea engine's output contract. They prove the render
   path. **They are not evidence the idea engine works, because it does not
   exist.** `IDEAS.md` is deliberately absent rather than fabricated.
4. **The corpus distributions are from the local sample only.** See `MINING.md`.

---

## Measurement bugs found and fixed along the way

Each of these changed the output visibly, and each was found by looking at
rendered pixels rather than at a score.

| Bug | Effect | Fix |
|---|---|---|
| **Halo gate had the wrong sign** | rejected 30 of 42 white-background candidates while keeping dark-background ones measuring −0.40 | on white the *dark* fringe is the visible defect, not the bright one; gate on `darkFringe` |
| **Translucent haze in the matte** | subject sat at alpha 181–254 while 31,368 px carried alpha 1–40; showed as a ghost AND inflated the trim box so subjects rendered undersized | alpha curve (floor 60 / ceil 200) before anything else; opaque px 1,501 → 103,189 |
| **Fixed B&W linear** | flattered a daylight runner, crushed a dark-gym boxer to a silhouette in the same set | `toBW` normalises each subject's own range; highlight capped at 202 so it cannot dissolve into the page |
| **Queries written for the old aesthetic** | "dark studio", "dark gym" → near-black blobs on white | rewritten for daylight and plain backdrops |
| **Same-shoot duplicates** | two frames of the same model on consecutive slides | perceptual hash misses this (poses genuinely differ); one item per photographer catches it exactly |
| **Wrong see-through metric** | measured luminance of *solid* pixels, so it structurally could not see partial alpha | measure `translucency` — share of visible pixels that are not solid |
| **Stats cache not versioned** | `darkFringe` gate silently never fired on cached entries | versioned stats key |
| **`bleed` type conflict** | array of edge names reached arithmetic → NaN offsets → compositor crash | normalise; edge names carry no magnitude |

---

## What unblocks the rest

1. **An Anthropic API key.** Two things depend on it, and they are the two things
   that matter most:
   - the **Phase 2 idea engine** — per the corrected brief this is *the actual
     product*, and there is a hard stop until 10 generated concepts have been
     reviewed;
   - **semantic verification of sourced imagery** — the gap described above.
2. **The Claude in Chrome extension connected**, for Instagram reference mining
   (Apify is off the table). The measurement subsystem is built and validated;
   it needs engagement-labelled posts to run against.
