# COST.md

What one set costs to make, measured — not estimated — on 2026-09-12 with
live keys, and what that means for each plan. Every figure below comes
from the providers' usage blocks as the engine bills them (`engine/providers/*`);
the two end-to-end runs are in `output/lanes/*.json` and `output/sets/apex-strength-feed-{batch,priority}/post.json`.

## Two measured sets (APEX feed, gym, "days" mode, medium quality)

| | Batch lane (included allowance) | Priority lane |
|---|---|---|
| Ask | "the gym habit that finally stuck", 6–8 slides | "what changed when I stopped training to failure", 6–8 slides |
| Slides made | **8** | **7** |
| Copy (claude-opus-5) | $0.0231 · 1 attempt, compliant, caption 💪📈 | $0.0665 · 1 attempt, compliant, caption 💪 📈 |
| Frames (gpt-image-2, 1 generation + N edits) | $0.1948 (anchor $0.019 + 7 edits × $0.025) | $0.3392 (anchor $0.041 + 6 edits × $0.050) |
| **Total** | **$0.2179 → $0.027 / slide** | **$0.4057 → $0.058 / slide** |
| Wall clock | 20 min 22 s (copy 93 s, anchor batch 16 min, frames batch 3 min, render 16 s) | 2 min 25 s (copy 33 s, anchor 32 s, 6 edits four-at-a-time 68 s, render 12 s) |

Both lanes send identical words to the models (`engine/lanes.mjs` builds the
request once); the batch lane is the same set at half the provider price,
returned within the day. Batch turnaround in practice today: Anthropic 1–2
minutes, OpenAI images 3–17 minutes per batch; the API promises 24 h.

## Where the money goes, per frame

gpt-image-2 list prices (developers.openai.com/api/docs/pricing, 2026-09-12): text in $5/M,
**image in $8/M**, out $30/M tokens; batch halves all three.

| Frame | Output tokens | Input | Realtime | Batch |
|---|---|---|---|---|
| Generation, medium 1024×1792 | 1,372 | ~40 text | $0.041 | $0.021 |
| Edit with reference, medium | 1,372 | **1,536 image** + 22 text | $0.054 | $0.027 |
| Edit with reference, low | 196 | 1,536 image | $0.018 | $0.009 |
| Generation, high | 5,488 | ~40 text | $0.165 | $0.082 |

The reference image on every edit costs $0.012 by itself — more than a
low-quality frame's own pixels. The ledger did not bill image-input tokens
before today, so earlier per-set figures ($0.32–0.41) were ~$0.07 light.

## Per slide, per plan

Reserve rates used by the quota gate (`fc_reserve_rate`): **$0.03 batch,
$0.06 priority**, ×3 for HD. Spend cap per plan = full quota at those rates × 1.5.

| Plan | Price | Allowance | COGS at full quota | Gross at full quota | Spend cap |
|---|---|---|---|---|---|
| Solo | $19 | 350 slides | 350 × $0.027 = **$9.45** | $9.55 (50%) | $15.75 |
| Grind | $59 | 840 + 84 priority | 840 × 0.027 + 84 × 0.058 = **$27.55** | $31.45 (53%) | $45.36 |
| Agency | $249 | 4,200 + 350 priority | 4,200 × 0.027 + 350 × 0.058 = **$133.70** | $115.30 (46%) | $220.50 |
| Extras | $0.06 / slide, $0.10 / priority slide | | $0.027 / $0.058 | 55% / 42% | |
| HD (Grind $0.35, Agency $0.30 per slide) | | | high output is 4× medium: ~$0.11 batch / $0.22 realtime per frame | 69% / 27% at realtime | |

"Solo at full quota costs $9.45 on $19." Nobody uses full quota; a typical
month (say 20 sets × 7 slides = 140 slides) costs $3.80.

Not in these numbers: Vercel Pro ($20/seat), Supabase Pro ($25), Storage
egress, the payment provider's cut (~3–5%), Anthropic/OpenAI batch
retries when copy fails compliance (measured 0 of 2 today; the loop allows 3).

## Levers, biggest first

1. **Quality low for frames without a face** (aspirational feed, trading):
   $0.009 per batch edit instead of $0.027 — a 7-slide set for ~$0.09.
   Not switched on: the gym "days" sets need medium to hold the face.
2. **gpt-image-1-mini** ($8/M out, $2.50/M image-in — 3.75× cheaper) for
   the same frames. Untested for likeness; likely fine for no-face sets.
3. **claude-sonnet-5 for copy**: $0.036 realtime vs opus $0.05–0.067; same
   compliance rate on the two asks tried. Opus stays default for now
   because the bedrock/native voice was tuned on it.
4. **The frame cache**: content-addressed on (model, prompt, size, quality,
   reference hash). Re-renders with edited text cost $0 (no new frames);
   the same ask on the same campaign hits the cache for copy too once the
   copy cache lands (not yet — copy is regenerated per set).
5. **Slide ranges**: charging for slides made, not the maximum reserved,
   is already the rule (fc_commit_set gives the difference back).

## What is billed and where

- Copy: `engine/providers/claude.mjs` (`RATES`), batch at `BATCH_RATES` (half).
- Frames: `engine/providers/image.mjs` `usdFor(usage)` — output + text-in +
  image-in − cached; batch lane divides by 2 in `openai-batch.mjs`.
- Per set: `state.usd` in `engine/lanes.mjs`, written to `sets.cost_usd`
  and `spend_ledger` (commit) by `fc_commit_set`, into `usage.cogs_usd`.
- Reservation: `fc_reserve_set` at the reserve rates; released on failure
  with the partial provider cost still recorded.
