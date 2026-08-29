# STACK.md — the final stack

**TESTED** = I ran it here against the live service. *Researched* = I did not, and it says so.
Two decisions changed after this research round; both are marked **CORRECTION**.

---

## 1. What I tested here

### The free keyless endpoint cannot hold a character. **TESTED**, two ways.

| run | method | character | pose |
|---|---|---|---|
| A | fixed seed, pose clause varies | **near-identical** ✅ | **frozen** — asked push-up + squat, got three standing figures ❌ |
| B | seed varies, description locked, style forced first | **drifts** — skin light tan → brown, shorts black → white, different faces and crops ❌ | still ignored ❌ |

It also ignored the style instruction in both runs ("flat 2d vector, bold outlines,
cel shaded, NOT photorealistic" → painterly digital art every time) and
**rate-limits** — `429` across four consecutive requests.

**Verdict: useless for a mascot, genuinely good for objects.** Objects have no
identity to preserve — 11 made, 5 correctly rejected by the matte gates, ~2.5s
each, $0. That layer stays free.

### The compositor is solved. **TESTED** across every round.
`fitText` on real `hmtx` advances, safe areas, collision rejection, rules
validation, seeded divergence with fingerprint collision checks. Zero overflow
events. Nothing here needs replacing.

---

## 2. The consistency principle

> **Consistency doesn't come from the model. It comes from not calling the model.**

Generate the mascot pose sheet **once per campaign**, store it, composite from
that fixed set forever. Nothing is regenerated at request time, so there is
nothing to drift. This makes "no consistency problems" true by construction, and
it is also what makes it cheap — the expensive call happens once per campaign,
not once per slide.

---

## 3. CORRECTION 1 — the mascot model is Nano Banana Pro, not FLUX Kontext

*Researched.* I had Kontext at $0.025; it is **$0.04/image**. More importantly,
the head-to-head goes the other way for *this* use case:

| | Nano Banana Pro | FLUX Kontext Pro |
|---|---|---|
| identity fidelity | **95% across 20+ generations** | 92% from one 512×512 reference |
| reference images | **up to 14** — built for multi-pose sheets | 1 (FLUX.2 takes 10) |
| how it works | native multimodal — **edits** the image rather than redrawing | flow-matching inpainting |
| known failure | — | **head turns >90° break in 14% of tests**; day→night lighting drops to 71% |
| strength | consistency, speed, lighting preservation | realism and texture |
| price | ~$0.047/image via Higgsfield (2 credits) | $0.04/image |

Kontext's documented weak spot — extreme pose and orientation change — **is
exactly my use case**. A pose sheet needs push-ups (horizontal), handstands
(inverted), squats, sofa poses. That is the 14% failure case, repeatedly.

Nano Banana Pro taking **14 reference images** is the decisive feature: a pose
sheet is precisely "here are 14 views of this character, now give me a 15th".

**And it is already wired into this session via Higgsfield.**

## 4. CORRECTION 2 — pose should be data, not a prompt

*Researched.* Both my failed runs show the model ignoring the pose clause. The
fix is **ControlNet OpenPose**: it reads a stick-figure skeleton and forces the
output to follow that exact skeleton.

That means **I can author the 28 poses as skeleton data** — joint coordinates,
version-controlled, identical for every campaign — instead of hoping a sentence
is obeyed. Identity comes from the reference images, pose comes from the
skeleton. Nothing is left to prompt interpretation.

Hosted: Replicate ~$0.15/run, Segmind pay-as-you-go with a free tier. Open
source under Apache 2.0. Known limit: heavy limb overlap and extreme
foreshortening still fail more often, so the pose set should avoid them.

## 5. CORRECTION 3 — matting should move to BiRefNet

*Researched.* BiRefNet preserves hair, glass and fine fabric edges markedly
better than u2net, which is what the current path effectively uses. It is ~930MB
and slow on CPU.

**Speed does not matter here** — matting is a cache-miss-only operation that runs
once per asset, ever. Quality is the only axis that matters, and my last library
run rejected **5 of 16 assets** for halos and dark fringes, which is exactly what
BiRefNet fixes. Available through `rembg` with the BiRefNet backend, self-hosted,
no per-image cost.

---

## 6. The stack

| layer | tool | runs | cost |
|---|---|---|---|
| Templates | `claude-opus-5`, stored as JSON | offline, once | one-off |
| Pose skeletons | authored as data, OpenPose format | once, ever | $0 |
| **Mascot pose sheet** | **Nano Banana Pro** (14 refs) + skeleton | once per campaign | ~$1.30 |
| Objects & grounds | free keyless endpoint **(TESTED)** | once per campaign | $0 |
| Matting | **rembg + BiRefNet**, isolated worker | once per asset | $0 (CPU) |
| Copy + element choice | `claude-haiku-4-5` | per carousel | $0.0035/slide |
| Composition | satori + resvg + sharp **(TESTED)** | per slide | $0.00005 |
| QC | `claude-sonnet-5` vision | per slide | $0.006 |

### Economics

| per campaign, once | |
|---|---|
| 28 poses @ ~$0.047 | $1.30 |
| ~40 objects & grounds | $0.00 |
| matting (CPU) | ~$0.002 |
| art-direction pass (`opus-5`) | ~$1.50 |
| **setup** | **≈ $2.80** |

| per 8-slide carousel | |
|---|---|
| copy + element choice | $0.028 |
| QC vision | $0.048 |
| render + storage | $0.0006 |
| **total** | **≈ $0.077** |

At **$20 / 35 slides** (~4.4 carousels), binding attributed case:
`$14.12 available − $0.34 generation − $0.03 amortised setup` → **≈ 68% net margin**,
with QC included rather than cut.

---

## 7. Things this research changed about the product

**Whop needs no integration.** *Researched.* There is no public submission API —
clippers publish, then paste the link into Whop for review. So we ship a
**downloadable zip** and stop there. That removes a whole integration surface.

**Auto-publishing is a real differentiator, but not day one.** Instagram Graph
API can publish carousels (container → `media_publish`, carousel counts as one
post, 100/day), but it needs a Business/Creator account and **Meta App Review at
2–4 weeks**. Competitors mostly lack scheduling and publishing entirely.

**Positioning risk — the one that worries me.** Competitors run **$9–29/mo with
unlimited generations**: aiCarousels $14.95, Draft AI ~$10 annual, Mirra $9,
ContentDrips ~$15, WaveGen $29. Against that, "**$20 for 35 slides**" reads
*worse* on a pricing page unless the quality gap is instantly obvious. They are
LinkedIn-shaped template-fill tools and we would be campaign-shaped with a real
mascot — but a buyer comparing feature lists will not see that. The landing page
has to show the difference, not describe it.

---

## 8. What to buy

1. **Higgsfield ULTRA** — this is now first, not third. It carries Nano Banana
   Pro, which the research says is the best multi-pose consistency model, and
   the plan includes **7 days of unlimited Nano Banana Pro** — long enough to
   build pose sheets for many campaigns at no marginal cost. The connector is
   already wired.
2. **An Anthropic API key** — copy, element choice, QC. Cheapest line.
3. **Nothing else.** FLUX Kontext is no longer needed; ControlNet is open source;
   BiRefNet is self-hosted; objects are free.

---

## 9. What I still cannot claim

- **The mascot pipeline has never run.** Nano Banana Pro's 95% figure is from
  published comparison, not my own test. This is the load-bearing assumption and
  it should be the first thing tested once there are credits.
- **No public benchmark independently validates Kontext's consistency claim**
  as of April 2026 — worth knowing that this whole class of claim is
  vendor-reported.
- **BiRefNet's CPU cost here is unmeasured.** 930MB and "slow on CPU" is the
  vendor's own description; I have not timed it on this machine.
- **The QC pass has never run.** Its cost is modelled.
- **68% margin assumes setup amortises over ~100 carousels per campaign.** A
  campaign that makes 10 carries $0.28 each and the margin drops, though it
  stays positive.
