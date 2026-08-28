# COST.md — measured per-carousel COGS

**Ceiling: $0.012 per 8-slide carousel, all in.** This is a build requirement, so it is
measured, not estimated. Reproduce with:

```
node tools/cost.mjs --n 10
```

CPU-seconds come from `process.cpuUsage()` deltas around each `renderCarousel` call;
byte counts come from the encoded output. The full run writes `output/cost/COST.json`.

---

## Result

| | per 8-slide carousel |
|---|---|
| Render only | **$0.000046** |
| Render + amortised sourcing | **$0.000061** |
| Ceiling | $0.012 |
| **Headroom** | **99.5%** — roughly **196x** under budget |

The ceiling is not close. That is the useful finding: it means the expensive options
(priority-3 AI generation, higher-resolution plates, more regeneration attempts) are
*affordable* provided they stay cached, and it means the $20/150-carousel plan has a
gross margin dominated by fixed costs rather than per-unit ones.

At 150 carousels/month the marginal COGS of a Clipper subscriber is **$0.009**.

---

## Where the money goes

Measured over 10 carousels (75 slides), first carousel excluded from the warm mean.

| Stage | Measured | Notes |
|---|---|---|
| Cold render (1st carousel) | 9.45 CPU-s | pays the one-time font parse + libvips warm-up |
| Warm render (mean) | 5.14 CPU-s | ~0.72 CPU-s per slide |
| PNG out (mean) | 685 KB | intermediate only |
| WebP out (mean) | 200 KB | **70.8% smaller** — the brief's WebP rule, confirmed |

| Cost line | USD | Share |
|---|---|---|
| Compute | $0.000022 | 36% |
| Egress | $0.000018 | 30% |
| Sourcing (amortised) | $0.0000128 | 21% |
| Storage | $0.000001 | 2% |

Egress is a third of the bill, which is why WebP is not a nicety — shipping PNG would
roughly triple the largest variable line.

---

## The sourcing model — why the ceiling holds

Matting is by far the most expensive operation in the system: **5.2 CPU-seconds** per
image (`@imgly/background-removal-node`, ONNX, CPU-only). Six subjects per carousel at
5.2s each would be 31 CPU-s — still under the ceiling, but wasteful, and it would scale
linearly with volume forever.

It does not, because matting is paid **once per subject**, not once per carousel:

```
measured cold    5.2 s      measured warm (cache hit)   0.001 s
```

A campaign's subject library is built once and reused:

| | |
|---|---|
| Frame extraction (per source video) | 0.95 CPU-s → 10 scene-cut candidates |
| Probe (per candidate, 256px) | 0.05 CPU-s |
| Matte (per accepted subject) | 5.2 CPU-s |
| Library: 60 subjects, ~3 candidates probed each | **322 CPU-s = $0.019, once** |
| Amortised over 1,500 carousels | **$0.0000128 each** |

This is the architectural claim the brief makes ("one source video should yield subjects
reused across dozens of carousels — this is what holds COGS at $0.012") and the cache
is what makes it true. Cache keys are content hashes, so the same photograph arriving
from two different URLs collapses to one entry.

---

## Price book — stated assumptions

These are assumptions, not measurements, and they are the only soft numbers here.

| Assumption | Value | Why |
|---|---|---|
| Render worker | $26.50/mo, 4 dedicated vCPU | brief requires long-running processes, not serverless — the font cache and libvips need warm workers |
| Utilisation | 60% | a queue-backed worker at steady state; charging by wall-clock at 100% would understate |
| **Derived rate** | **$4.26e-6 per CPU-second** | |
| Object storage | $0.021 /GB/month | |
| Egress | $0.09 /GB | |
| Draft retention | 0.25 months | aggressive lifecycle expiry on drafts, per the brief |

Change any of these in `PRICES` / `SOURCING` at the top of `tools/cost.mjs` and rerun —
the whole report is derived.

---

## What is NOT yet in this number

Honesty about scope, because the figure above is only as good as its coverage.

1. **Stock API calls are free but not yet exercised.** Pexels and Unsplash are both
   free at our volume and add egress only (~1.1 MB per candidate downloaded, cached
   forever after). Modelled at 3 candidates per accepted subject; not yet measured
   against the live APIs because the keys are not in the environment.
2. **Priority-3 AI generation is not modelled.** At typical hosted-diffusion pricing
   (~$0.002–0.01/image) a *cached* generated subject costs the same amortised
   fractions of a cent as a matted one, but an *uncached* one would cost more than the
   entire rest of the carousel. The brief's 40-images/month cap on the $20 tier is the
   right control, and it must be enforced against the cache-miss count, not the
   composite count.
3. **The render measurement is on this machine.** Absolute CPU-seconds vary with load;
   two consecutive runs of `tools/cost.mjs` on a busy machine differed by ~40%. The
   headroom is large enough that this does not threaten the conclusion.
4. **Queue, database and auth overhead** are per-request, not per-carousel, and are
   fixed costs of the app tier rather than COGS of a generation.
