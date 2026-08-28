# MINING.md — measured distributions from the reference corpus

**Status: partial.** The measurement half of the reference miner is built and validated.
The scrape half is blocked on the Apify token and the handle list. Everything below is
measured on the **local** corpus in `Carousel examples/` — 17 posts, 145 slides — which
is *not* the same population the corrected brief's claims are about. That distinction
governs how much weight each number below can carry, and I've marked it throughout.

```
node mining/analyse.mjs                    # full corpus
node mining/analyse.mjs --covers-only      # covers only, ~10x faster
```

Writes `mining/reference_features.json`, whose row shape maps 1:1 to the
`reference_features` table so the Apify path emits identical rows.

---

## 1. What the corpus is — and what it is not

| | |
|---|---|
| Posts | 17 |
| Slides | 145 |
| Engagement labels | **none** |
| Handle labels | **none** (one post positively identified as @papanca.io) |
| Niches | mixed — gym, UFC, finance, "random" |

The corrected brief's claims ("WHITE background. Every single one.") are about
**@papanca.io's top posts by engagement**. This corpus is an unlabelled grab-bag across
several accounts and niches. It therefore **cannot confirm or refute those claims** — it
can only describe a broader population. This is precisely why the brief puts the scrape
first, and the scrape is what will settle it.

---

## 2. The one post I can positively identify as @papanca.io

Folder `3`, cover slide. Measured against the brief's description of the format:

| Brief says | Measured | |
|---|---|---|
| white background | `isWhite: true`, whiteShare 0.79 | ✅ |
| one B&W cutout | 1 matted subject, 20.98% of frame | ✅ |
| bleeding off an edge | `bleedEdges: ["bottom"]` | ✅ |
| no accent colour | **0 chromatic clusters** | ✅ |
| mono @handle bottom-left | `handleLikely: true` | ✅ |
| → arrow bottom-right | `arrowLikely: true` | ✅ |
| no grain / vignette / split-tone | 0 chromatic clusters, flat ground | ✅ |
| editorial serif w/ one italic accent word | heuristic said "regular-sans" — **wrong**, see §6 | ❌ metric |

**Seven of eight measured axes match the brief exactly.** Within the population the
brief is actually describing, the brief looks right. The eighth is a failure of my
measurement, not of the brief.

---

## 3. Measured distributions (whole local corpus)

### Background — covers (n=17)

| | |
|---|---|
| white (strict) | **35.3%** |
| white or near-white | 41.2% |
| dark | 23.5% |
| median border luma | 229.19 |

### Background — all slides (n=145)

| | |
|---|---|
| white or near-white | 37.9% |
| dark | 36.6% |

### Chromatic clusters — all slides

| clusters | share |
|---|---|
| 0 | **30.3%** (44) |
| 1 | 24.1% (35) |
| 2 | 18.6% (27) |
| 3+ | 26.9% (39) |

Median chromatic pixel share: 5.42%.

### Subject — covers

| | |
|---|---|
| cover has a matted subject | **100.0%** |
| median subject coverage | **29.03%** of frame |
| bleeds ≥1 edge | **64.7%** |
| — bleeds bottom | 52.9% (9) |
| — bleeds right | 11.8% (2) |
| — bleeds left | 11.8% (2) |

### Slide count

| | |
|---|---|
| p25 / median / p75 | **7 / 8 / 10** |
| range | 5 – 16 |

### Furniture — all slides

| | |
|---|---|
| handle detected | 59.3% |
| arrow detected | 41.4% |

### Canvas aspect

| aspect | share | |
|---|---|---|
| **0.80** | **53.1%** (77) | 1080×1350, IG-native 4:5 |
| 0.75 | 26.2% (38) | 1080×1440, the brief's mandate |
| 0.56 | 8.3% (12) | 9:16 |
| 0.76 | 6.9% (10) | |

---

## 4. What the data supports

These hold across the whole mixed corpus, so they are the safest to derive parameters from:

1. **Every cover has a matted subject.** 100%, n=17. Cutout quality really is the whole
   imaging problem — there is no cover in this corpus that is type alone.
2. **Bleed is the dominant compositional move, and it is a BOTTOM bleed.** 64.7% bleed at
   least one edge; bottom outnumbers left and right combined by more than 2:1. The brief's
   "bleeding off the bottom-right edge" is the right default.
3. **Subject sizing has a tight centre.** Median 29% of frame. That is a directly usable
   template parameter.
4. **Slide count: median 8, IQR 7–10.** The brief's `min_slides: 6 / max_slides: 11`
   comfortably contains the observed distribution.

## 5. What the data does *not* support — flagged, not silently ignored

I'm building to the brief regardless; you should just know where the local evidence and
the brief diverge, so the scrape can adjudicate.

1. **"WHITE background. Every single one."** Measured: 35.3% of covers strictly white,
   41.2% near-white, 23.5% outright dark. In the population the brief describes
   (@papanca.io top posts) this may well be 100% — folder 3 is white. Across a mixed
   corpus it is not the norm. **The scrape settles this**, and until it does I'll take
   white as the default because the identified papanca post supports it.

2. **"≤1 chromatic cluster" as a blocking gate.** Measured: **45.5% of slides carry 2 or
   more.** As a hard gate this would reject nearly half the reference corpus. I'd suggest
   it stays a gate for *our* output (it enforces discipline) but is not presented as a
   description of what top posts do.

3. **Canvas 1080×1440.** Measured: only 26.2% of corpus slides are 4:3-ish 0.75; **53.1%
   are 0.80 (1080×1350)**, Instagram's native 4:5. 1080×1440 crops or letterboxes in feed
   against the majority of the reference set. Worth a deliberate decision rather than an
   inherited default — I'll build 1080×1440 as specified, but flag it now rather than
   after the app is built around it.

---

## 6. Methodology — including two measurement bugs I found and fixed

Reporting these because both materially changed the headline numbers, and an unstated
methodology bug is indistinguishable from a finding.

**Bug 1 — background measured on a contaminated border ring.** The first implementation
took mean+sd luminance over the border. A subject that *bleeds off an edge* puts its own
dark pixels in that ring, dragging the mean down and inflating sd — so the metric
reported the exact format we care most about (white ground, cutout off the bottom) as
"not white". Folder 3's cover measured `bg=other`. Replaced with a **share-based** test:
the fraction of border pixels that are genuinely white, which a partial-edge subject
cannot dominate. **White covers went 5.9% → 35.3%.**

**Bug 2 — stroke contrast measured over the whole frame.** The serif/sans heuristic
measured horizontal dark-run dispersion across the entire slide, so on photo-heavy slides
it was measuring skin and shadow, not letterforms. Restricted to detected text bands
under 15% frame height. **regular-sans went 20.7% → 50.3%; serif 68.3% → 31.0%.**

**Still unreliable: the serif/sans metric.** Even after Bug 2 it calls folder 3's cover —
an unmistakable high-contrast editorial serif with an italic accent word — "regular-sans".
It is directional in aggregate and wrong in specific cases. **Do not derive a template
parameter from it.** Getting this right needs OCR plus font fingerprinting, or simply
reading it off the scrape's rendered text. I've left it in, labelled APPROXIMATE, rather
than deleting a measure that is 80% right.

**What is measured reliably:** background (share-based), chromatic clusters (CIELAB,
C\* ≥ 18, hue-binned at 30°, bins under 0.8% discarded as noise), subject presence,
coverage and bleed (real alpha matte, untrimmed, edge-run ≥5% of the border), slide
count, canvas, and furniture presence.

**Word counts and hook text are absent** because they need captions, which the scrape
supplies. There is no OCR in this pipeline.

---

## 7. Blocked — what I need to finish Phase 1

1. **Apify API token.**
2. **The handle list per niche.**

With those, `mining/scrape.mjs` runs `apify/instagram-scraper` with
`{ directUrls, resultsType: "posts", resultsLimit: 24 }`, stores posts with engagement,
re-runs this same extractor on engagement-labelled covers, and populates `idea_corpus`
with top-performing hooks and captions. The measurement code above then answers the white
background and chromatic-cluster questions **on the right population**, and the hook word
count distribution — which the idea engine in Phase 2 needs as a scoring target — becomes
available for the first time.
