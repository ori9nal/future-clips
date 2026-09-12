// Art direction: generate a set's imagery, holding one subject across it.
//
// Stock photography is coherent but generic, and generic does not travel. The
// alternative used to be worse — generated people drifted into a different
// person by the fifth frame — but gpt-image-2's edit endpoint takes a reference
// image, and measured on 2026-09-07 it holds a face across completely different
// scenes: desk at night, window in daylight, bed at dawn, street outdoors, one
// man throughout.
//
// So the shape is: generate ONE anchor frame, then generate every other frame
// as an edit conditioned on that anchor. Slide order does not matter; only the
// anchor does. If the anchor is wrong the whole set is wrong, which is why it
// is the one frame worth generating best-of-N.
import fs from 'node:fs';
import path from 'node:path';
import { generate, sizeFor } from './providers/image.mjs';

/** Photographic direction shared by every frame, so the set grades as one. */
const LOOK = {
  phone: 'Amateur iPhone photo. Slightly grainy, slightly soft, harsh mixed lighting, no retouching, no colour grade, candid, imperfect framing, a real cluttered place.',
  cinematic: 'Cinematic phone photo, 35mm, natural light, shallow depth of field, muted film grade, fine grain.',
  steel: 'Cinematic photo, cool blue-grey grade, hard directional light, deep shadows, high contrast, fine grain.',
  sunlit: 'Warm natural photo, golden window light, soft shadows, gentle contrast, airy and clean.',
  clean: 'Clean editorial photo, soft even daylight, neutral colour, minimal styling, plenty of negative space.',
  ash: 'Desaturated photo, near-monochrome, overcast light, muted greys, quiet and still.',
};

const GUARD = 'Photograph, not an illustration. No text, no logos, no watermarks, no captions anywhere in the image. One person only.';

/**
 * The aspirational guard is different in kind: it forbids the thing that made
 * round one fail. No face, no emotional pose, no person as the subject — the
 * subject is the place or the object, shot the way a phone catches it.
 */
const ASPIRE_GUARD = 'Candid phone photograph, not staged, not a stock photo. No visible face, no person as the subject, ' +
  'no one posing or emoting. No text, no logos, no watermarks. The subject is the place or the object itself.';

/**
 * The prompt for every frame of a set, without spending anything.
 *
 * Returned as a plan so the same words go out whichever lane runs them: the
 * realtime executor below calls the API frame by frame; the batch lane
 * (engine/providers/openai-batch.mjs) submits the anchor as one batch and,
 * when it lands, the remaining frames as a second batch conditioned on it.
 * Frames after the anchor need the anchor's FILE (the edit endpoint takes the
 * pixels), so `frames(anchorFile)` is a function of it rather than a list.
 */
export function planSet(o) {
  const {
    subject, scenes, look = 'cinematic', quality = 'medium', w = 1080, h = 1920, id = 'set',
    mode = 'subject', days = false,
  } = o;
  const size = sizeFor(w, h);
  const style = LOOK[look] ?? LOOK.cinematic;

  if (mode === 'aspirational') {
    return {
      mode, size, quality, anchor: null,
      frames: () => scenes.map((scene, i) => ({
        i, label: `${id}-a${i}`, refs: [], prompt: `${style} ${scene} ${ASPIRE_GUARD}`,
      })),
    };
  }

  const anchor = { i: 0, label: `${id}-anchor`, refs: [], prompt: `${style} ${subject} ${scenes[0]} ${GUARD}` };
  const frames = (anchorFile) => scenes.slice(1).map((scene, n) => {
    const i = n + 1;
    // A close-up is asked for by the scene, and "keep the same face" pulls
    // the model straight back to the anchor's full-body framing — round one
    // of the gym gauntlet rendered "a tight close-up of a bicep" as the same
    // mirror selfie four times. So a close-up keeps the person by skin, build
    // and clothing, and is told outright that the face is not in the frame.
    const closeUp = /close-up|no face|from behind|from the waist down|neck down/i.test(scene);
    // `days` mode: the person is the constant, everything else changes. The
    // scene names its own outfit and place, and the model is told the
    // reference's clothing and room are NOT to be kept — otherwise it copies
    // the anchor's hoodie into the boat shot.
    const keep = days
      ? (closeUp
        ? `Same person as the reference image — same skin tone, same build, same body hair — photographed on a DIFFERENT day in a DIFFERENT place. Do not copy the reference's clothing, room or lighting. ${scene} The face is not in the frame; the body part named fills the frame.`
        : `The SAME PERSON as the reference image — same face, same hair, same build, same skin tone — photographed on a DIFFERENT day. Different clothes, different place, different light from the reference; do not copy the reference's outfit or room. ${scene}`)
      : closeUp
        ? `Same person as the reference image — same skin tone, same build, same clothing and shoes — and the same gym and lighting, this is the same session. But the framing is DIFFERENT from the reference: ${scene} The face is NOT in the frame; the body part named fills the frame, shot close on a phone. Do not repeat the reference composition.`
        : `Keep the SAME PERSON from the reference image: same face, same hair, same body, same clothing, same shoes. Same location and same lighting as the reference — this is the same session. Do not restyle or age them. New scene: ${scene}`;
    // Naming what must NOT change does more work than describing the person
    // again — the reference already carries the likeness, and re-describing
    // it invites the model to reinterpret rather than preserve.
    return { i, label: `${id}-${i}`, refs: [anchorFile], prompt: `${style} ${keep} ${GUARD}` };
  });
  return { mode, size, quality, anchor, frames };
}

/**
 * Generate imagery for a set, realtime: the plan above, run frame by frame.
 *
 * @param {object} o
 * @param {string} o.root
 * @param {string} o.cacheDir
 * @param {string} o.subject   locked description of the person, reused verbatim
 * @param {string[]} o.scenes  one scene line per slide, in order
 * @param {string} [o.look]    a LOOK key
 * @param {string} [o.quality] low | medium | high
 * @param {number} [o.w]       canvas, used to pick the nearest accepted size
 * @param {number} [o.h]
 * @param {number} [o.anchorTries] how many anchors to draw before picking one
 */
export async function generateSet(o) {
  const { root, cacheDir, anchorTries = 1 } = o;
  const plan = planSet(o);
  const { size, quality, mode } = plan;

  // Aspirational mode: every frame is its own generation with no reference
  // image and no recurring person. Coherence comes from the shared LOOK, not
  // from a face — which is how the reference sets are actually built. Round
  // one of the gauntlet put one man with his hand over his face on five of six
  // slides, because "hold the subject" was the only mode there was.
  if (mode === 'aspirational') {
    const files = [];
    let usd = 0, cached = 0;
    for (const f of plan.frames()) {
      const r = await generate({ root, cacheDir, size, quality, label: f.label, prompt: f.prompt });
      files.push(r.file);
      usd += r.usd ?? 0;
      if (r.cached) cached++;
    }
    return { files, usd: +usd.toFixed(4), cached, size, quality, anchor: null, mode };
  }

  // The anchor carries the whole set's likeness, so it is drawn from the scene
  // that shows the face most plainly rather than from slide 1, which is often
  // a wide or a detail shot.
  let anchor = null;
  for (let i = 0; i < Math.max(1, anchorTries); i++) {
    const r = await generate({ root, cacheDir, size, quality, label: plan.anchor.label, variant: i, prompt: plan.anchor.prompt });
    if (!anchor) anchor = r;
  }

  const files = [anchor.file];
  let usd = anchor.usd ?? 0, cached = anchor.cached ? 1 : 0;
  for (const f of plan.frames(anchor.file)) {
    const r = await generate({ root, cacheDir, size, quality, label: f.label, refs: f.refs, prompt: f.prompt });
    files.push(r.file);
    usd += r.usd ?? 0;
    if (r.cached) cached++;
  }
  return { files, usd: +usd.toFixed(4), cached, size, quality, anchor: anchor.file, mode };
}

export { LOOK };
