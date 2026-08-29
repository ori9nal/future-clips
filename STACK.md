# STACK.md — the final stack, and what I actually tested

Everything below marked **TESTED** was run in this repo against the live service.
Everything marked *researched* was not, and says so.

---

## 1. What I tested, and what it proved

### The free keyless endpoint **cannot** hold a character. Tested, twice.

I ran the same character description across poses two ways:

| run | method | character | pose | verdict |
|---|---|---|---|---|
| A | **fixed seed**, pose clause varies | **near-identical** — same face, hair, body, clothing | **frozen** — all three came back standing, ignoring "push up" and "squat" | unusable |
| B | **seed varies**, description locked, style forced first | **drifts badly** — skin tone light tan → brown, shorts black → white, different faces, different crops | still ignored | unusable |

It also **ignored the style instruction in both runs** — "flat 2d vector
illustration, thick bold black outlines, cel shaded, NOT photorealistic" returned
semi-painterly digital art every time. And it **rate-limits** (`429` across four
consecutive requests), so it could never serve production traffic.

**Conclusion: free text-to-image is fine for one-off objects and useless for a
mascot.** The objects it produced earlier were genuinely good — a real shoe, a
real kettlebell, a real watch — because objects have no identity to preserve.

### What the free endpoint IS good for. Tested.

Product objects and backgrounds: **11 assets made, 5 correctly rejected** by the
matte gates. ~2.5s each, $0, no key. That layer is solved and should stay free.

### The compositor is solved. Tested across every round.

`fitText` against real `hmtx` advances, safe areas, collision rejection, campaign
rules validation, seeded divergence with fingerprint collision checks. Zero
overflow events. This is the reliability backbone and none of it needs replacing.

---

## 2. The consistency principle — the actual answer

> **Consistency does not come from the model. It comes from not calling the model.**

Generate the mascot's pose sheet **once per campaign**, store it, and every
carousel from then on composites from that fixed set of PNGs. Nothing is
regenerated at request time, so there is **nothing to drift**. Drift is only
possible if you generate per-slide — so don't.

This single decision is what makes "no consistency problems" true by
construction rather than by hoping the model behaves, and it is *also* what makes
it cheap, because the expensive call happens once per campaign instead of once
per slide.

---

## 3. The stack

| layer | tool | when it runs | cost |
|---|---|---|---|
| **Templates** | authored by `claude-opus-5`, stored as JSON | once, offline | one-off |
| **Mascot pose sheet** | **FLUX Kontext** (reference-conditioned) *or* Higgsfield `soul_2` | once per campaign | ~$0.70 per campaign |
| **Objects & grounds** | **free keyless endpoint** (proven), FLUX schnell as paid fallback | once per campaign, cached | ~$0 |
| **Matting** | `@imgly/background-removal-node`, isolated worker | once per asset, cached | $0 (CPU) |
| **Copy & element choice** | `claude-haiku-4-5` | per carousel | ~$0.0035/slide |
| **Composition** | satori + resvg + sharp, `fitText`, rules validator | per slide | ~$0.00005 |
| **QC** | `claude-sonnet-5` vision | per slide | ~$0.006 |

### Why FLUX Kontext for the mascot

*Researched, not tested — no key.* It is purpose-built for reference-conditioned
generation: pass the approved character image plus a pose prompt and it preserves
identity. **$0.025/image**, the best price-performance found. Alternatives:
Qwen Image 2.0 ($0.028), Segmind Consistent Character, Midjourney Omni Reference
(best quality, $10/mo, no API). Higgsfield `soul_2` trains a reusable character
and is the strongest option, at ~$0.046–0.058/image equivalent on their credit
pricing.

**Route: approve one character front view → generate 28 poses against it → store.**

---

## 4. Cost at scale

Per campaign, once:

| | |
|---|---|
| 28 mascot poses @ $0.025 | $0.70 |
| ~40 objects & grounds (free endpoint) | $0.00 |
| matting, 68 assets @ 5.2 CPU-s | ~$0.0015 |
| art-direction pass (`claude-opus-5`) | ~$1.50 |
| **campaign setup** | **≈ $2.20** |

Per carousel of 8 slides, at steady state:

| | |
|---|---|
| copy + element choice (Haiku) | $0.028 |
| QC (Sonnet 5 vision) | $0.048 |
| render (CPU) | $0.0004 |
| storage + egress (WebP) | $0.0002 |
| **total** | **≈ $0.077** |

Against **$20 for 35 slides** (~4.4 carousels), on the binding attributed case
(25% agency share off the top):

| | |
|---|---|
| available after Stripe + agency | $14.12 |
| 4.4 carousels @ $0.077 | $0.34 |
| campaign setup, amortised over 100 carousels | $0.02 |
| **net margin** | **≈ 68%** |

Comfortably past the 40% target, with the QC pass included rather than cut.

---

## 5. Why this survives any niche

Nothing in the stack is fitness-specific. A campaign supplies:

- a **mascot reference** (or the brand's own product / founder / source-video frame)
- a **brand kit** — colours, fonts, handle, logo
- **rules** — banned claims, required mention, slide range
- optional **source video** and **agency assets**

The pose vocabulary and the object list are derived from the **niche's own
template set**, not from a shared shelf — which is the no-fixed-library
correction. A coffee brand gets brew poses and cup objects; a finance brand gets
desk poses and card objects. Same pipeline, different manifest.

---

## 6. What I still cannot claim

- **FLUX Kontext is untested here.** I have no key for it. Its consistency
  claim is from its documentation and third-party comparison, not from my own
  run. It is the one load-bearing assumption in this plan and it should be
  tested before anything is built on it.
- **The free endpoint's rate limit is undocumented.** I hit `429` after four
  rapid requests. Fine for a one-off library build with backoff; not something
  to depend on for a launch.
- **The QC pass has never run.** Cost is modelled, not measured.
- **68% margin assumes the campaign setup amortises over ~100 carousels.** A
  campaign that only ever makes 10 carries $0.22 each of setup and the margin
  drops, though it stays positive.

---

## 7. What to buy, in order

1. **An Anthropic API key** — unblocks copy, element choice and QC. Everything
   at request time depends on it, and it is the cheapest of the three.
2. **FLUX Kontext access** (fal.ai or Replicate) — ~$0.70 per campaign for the
   mascot. This is the quality unlock.
3. **Higgsfield ULTRA**, only if the trained-Soul route beats Kontext in a
   head-to-head. Worth testing before committing $70.

Everything else in the stack is already built and already free.
