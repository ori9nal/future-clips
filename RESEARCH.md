# RESEARCH.md — what actually makes these perform

Primary sources: @papanca.io's live posts (the account the brief was built from),
growithalex.com's own slides, 76 Pinterest designs, plus current writing on Photo
Mode and carousel mechanics. Nothing here is inferred from my own output.

**Headline finding: I have been optimising the wrong variable for four rounds.**
I was chasing polish. Polish is not what separates these. Density of *information*
is.

---

## 1. The hook owns ~80% of the outcome, and it must OPEN a gap

Swipe-through from slide 1 to slide 2 is the number the algorithm reads. Healthy
is 60–75%; below 50% the hook has failed. The hook has to be readable in under
two seconds and has to leave something *unresolved*.

> "5 Instagram tips" closes the gap immediately. "The one carousel mistake
> killing your reach" opens it.

**Mine mostly close it.** Measured against my own concepts:

| my hook | verdict |
|---|---|
| "lift heavy, run easy, never on the same legs" | states the answer — gap closed |
| "the boring part is the sport" | states the claim — gap closed |
| "same hours, different athlete" | opens a gap ✅ |
| "you are not tired, you are unfinished" | opens a gap ✅ |

Two of eight open a gap. That alone caps performance regardless of design.

## 2. The metric is saves and swipes, not views

Photo Mode is reported at roughly 5× the reach of video for the same creators,
with ~4× completion, because **every swipe is an explicit engagement signal**.
Save rate of 1.5–3% of impressions is strong for educational carousels; under
0.5% means the interior slides are not earning their slot. Optimal length is
**5–8 slides** — beyond ~10 drop-off gets steep. My sets run 6–9, slightly long
at the top end.

## 3. Polish is NOT the differentiator — consistency is

This is the finding that invalidates my last four rounds.

> Candid, slightly imperfect photos grouped by a mood or colour palette perform
> well **because they feel personal rather than produced**.

> Consistency in aesthetic is more important than whether the design is raw or
> polished.

I read "$2,000 designer" as *make each frame more beautiful*. The evidence says
the return is in **the set reading as one thing**, and in what the frames
actually *contain*.

---

## 4. THE BIG ONE — top performers are labelled OBJECT CONSTELLATIONS

This is the structural difference, and I missed it completely.

**@papanca.io, "The art of athlete maxxing" — 45.6K likes.** The cover is not a
headline over a photograph. It is **~14 distinct objects arranged on white**
around a small centred serif title:

- a kettlebell athlete and a running athlete (cutouts)
- a Nike Vaporfly, a Berlin Marathon medal, an Apple Watch, a creatine tub,
  a Cadence can, a Precision fuel bottle, a sauna cabin, a bowl of pasta
- **an orange line chart labelled "58 mi"**
- **a blue/magenta heart-rate bar chart labelled 1:10 → 9:27**
- **a watch face showing 31:47.01 · 147BPM · 23:53 · 137BPM**

**Interior slide, "Strength maxxing" — same architecture, now labelled.** Seven
objects orbiting a centred serif title, each carrying a 2–4 word caption:

| object | label |
|---|---|
| kettlebell athlete | Anti-rotation core |
| stacked blue plates | Progressive overload |
| barbell deadlift | Intensity over volume |
| anatomical leg illustration | Single-leg work |
| huge magenta **2X** | 2 sets per muscle group |
| gold stopwatch | Max 50 min in the gym |
| B&W barbell squat | Squat, hinge, push, pull |

**That is seven ideas on one slide.** Mine carry one headline and one photograph.
The density *is* the value proposition — it is what makes the post feel worth
saving.

This matches a named 2026 trend: **Blueprint design** — "objects broken into
labeled parts, exploded views… over-explaining becomes the aesthetic. It makes
ordinary products feel engineered and considered." Alongside it, "scrapbook
carousels… feel more casual, authentic and personal than polished content."

### 4a. Colour is free here, not rationed

One frame carries magenta, cobalt, gold, green, orange. **My "exactly one
chromatic cluster" gate actively suppresses this format.** That rule came from a
corpus of type-only slides and I over-generalised it.

### 4b. The real grading rule: people B&W, objects in colour

In both papanca collages the human cutouts are greyscale while every product
stays full colour. That is a deliberate, repeatable rule — and it is the opposite
of my "grade everything to one hue" duotone.

---

## 5. What I got wrong, specifically

1. **Built "one stock person floating on white."** That is the least
   information-dense frame available. The format's whole value is the opposite.
2. **Never built the object library.** I wrote the `objects` queries into
   `library/niches.json` and never ran them once. Products, equipment, food and
   anatomy are the actual raw material.
3. **Deleted the data graphics.** The original engine had procedural dials,
   hypnograms, bar and ring generators. I moved them to `templates/_legacy/`
   as "the superseded direction". **They are exactly what this format needs** —
   the 58-mile chart and the HR bars are the most valuable objects on the slide.
4. **Enforced one accent colour**, which this format breaks on purpose.
5. **Graded people and objects the same way**, when the rule is to split them.
6. **Optimised polish** when the evidence says density and consistency.
7. **Wrote hooks that close the gap** rather than open it.

---

## 6. What this means for the build — stated, not started

| need | status |
|---|---|
| Object library: products, equipment, food, anatomy, **in colour**, matted | queries written, never run |
| Data-graphic generators: line chart, HR bars, dial, watch face, big stat | exist in `_legacy`, need reviving |
| Constellation layout solver: 7–14 objects + labels around a clear centre, no collisions | not built — the brief's Poisson-disk idea was right |
| Per-object label typography, 2–4 words, bold sans | not built |
| Split grading: people greyscale, objects colour | engine supports both, rule not applied |
| Hook generator scored on gap-opening, not just word count | needs the idea engine |
| Drop the one-chromatic-cluster gate for collage families | one-line change |

The layout engine, `fitText`, the matting pipeline, the cache and the campaign
system all stand. What has to change is **what goes on the slide**, not how it is
placed.

---

## 7. What I still cannot verify

- **Real engagement numbers per format.** I can read likes off a public post; I
  cannot see saves or swipe-through, which are the metrics that actually matter.
  Everything about save-rate above is from published guidance, not measured.
- **Whether papanca's collages outperform their single-cutout posts.** The 193k
  post the brief cites is a *single-cutout*, and the collage here is 45.6K. On
  that evidence the single-cutout format may well be the stronger performer, and
  the collage may be the more *saveable* one. Two different jobs.
- **Whether any of this transfers to TikTok Photo Mode**, where the audience and
  the UI overlay are different.

Sources: [TikTok Photo Mode reach](https://reelbase.io/blog/tiktok-photo-mode-algorithm-explained) ·
[carousel best practices](https://carouselli.com/blog/instagram-carousel-best-practices) ·
[slideshow vs video performance](https://www.attentionclaw.com/blog/tiktok-slideshow-vs-video-performance) ·
[blueprint design trend](https://www.kittl.com/blogs/blueprint-graphic-design-trend-stl/) ·
[2026 design trends](https://www.kittl.com/blogs/graphic-design-trends-2026/) ·
[@papanca.io post](https://www.instagram.com/p/Dbz--lRAPwD/)
