// Priority 3: generated imagery, via fal.ai.
//
// THIS RUNS AT LIBRARY-BUILD TIME, NEVER IN THE REQUEST PATH.
//
// Per-carousel generation is not affordable and never will be: six subjects at
// ~$0.035 is $0.21 against a $0.006 ceiling, 35x over. Generated ONCE into a
// niche library and reused, the same spend is ~$11 for 300 images amortised
// across thousands of carousels — about $0.002 each. The economics only work
// because the artefact is cached, exactly as with matting.
//
// Two tiers, chosen by what the image has to do:
//   plates   FLUX.1 [schnell] — a background. Cheap; semantics barely matter.
//   subjects Seedream 5       — the subject IS the semantics. Prompt adherence
//                               is the entire reason we are generating at all,
//                               so the expensive tier is the correct one here.
import fs from 'node:fs';
import { keyFor, memo } from './cache.mjs';

const KEY = () => process.env.FAL_KEY || process.env.FAL_API_KEY;

export const MODELS = {
  plate: {
    id: 'fal-ai/flux/schnell',
    usdPerImage: 0.003,
    defaults: { image_size: 'portrait_4_3', num_inference_steps: 4 },
  },
  subject: {
    id: 'fal-ai/bytedance/seedream/v3/text-to-image',
    usdPerImage: 0.035,
    defaults: { image_size: 'portrait_4_3' },
  },
};

export const generationAvailable = () => Boolean(KEY());

/**
 * Subjects are generated to be MATTED, so the prompt has to ask for the thing
 * that makes a matte clean — one person, full body, plain seamless ground,
 * even light — and to refuse the things that wreck it.
 */
export function subjectPrompt(intent, { style = 'editorial photograph' } = {}) {
  return [
    intent,
    'single person, full body in frame, head to feet visible',
    'plain seamless light grey studio background',
    'even soft daylight, no harsh rim light',
    `${style}, sharp focus, realistic, natural proportions`,
    'no text, no watermark, no logo, no border, no collage, no duplicate limbs',
  ].join(', ');
}

export function platePrompt(intent) {
  return [
    intent,
    'wide establishing shot, no people, no text',
    'natural light, cinematic, high dynamic range, sharp',
  ].join(', ');
}

async function falRun(model, input) {
  const key = KEY();
  if (!key) throw new Error('FAL_KEY is not set — generation is unavailable');
  const res = await fetch(`https://fal.run/${model.id}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...model.defaults, ...input }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`fal ${res.status} ${res.statusText} — ${body.slice(0, 240)}`);
  }
  return res.json();
}

/**
 * Generate one image, cached by (model, prompt, seed) so a re-run of a library
 * build never pays twice for the same request.
 *
 * @returns {{ buf, hit, usd, prompt, model }}
 */
export async function generateImage(prompt, { kind = 'subject', seed = null, extra = {} } = {}) {
  const model = MODELS[kind];
  if (!model) throw new Error(`unknown generation kind "${kind}"`);
  const key = keyFor('gen', prompt, { m: model.id, seed, ...extra });

  const { buf, hit } = await memo(key, '.jpg', async () => {
    const out = await falRun(model, { prompt, ...(seed == null ? {} : { seed }), ...extra });
    const url = out?.images?.[0]?.url || out?.image?.url;
    if (!url) throw new Error(`fal returned no image for "${prompt.slice(0, 60)}"`);
    const img = await fetch(url);
    if (!img.ok) throw new Error(`download ${img.status} for generated image`);
    return Buffer.from(await img.arrayBuffer());
  });

  // A cache hit costs nothing; only a real call is billed. Reported so the
  // admin cost view can distinguish spend from reuse.
  return { buf, hit, usd: hit ? 0 : model.usdPerImage, prompt, model: model.id, key };
}

/** Running total for a library build, so a run can be capped before it spends. */
export class Spend {
  constructor(limitUsd = Infinity) { this.limit = limitUsd; this.usd = 0; this.calls = 0; this.hits = 0; }
  add(r) {
    this.usd += r.usd; this.calls += r.hit ? 0 : 1; this.hits += r.hit ? 1 : 0;
    if (this.usd > this.limit) throw new Error(`generation budget exceeded: $${this.usd.toFixed(2)} > $${this.limit.toFixed(2)}`);
    return r;
  }
  toString() { return `$${this.usd.toFixed(3)} over ${this.calls} calls (${this.hits} cached)`; }
}
