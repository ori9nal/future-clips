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
 * Generate imagery for a set.
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
  const {
    root, cacheDir, subject, scenes, look = 'cinematic',
    quality = 'medium', w = 1080, h = 1920, id = 'set', anchorTries = 1,
    mode = 'subject',
  } = o;
  const size = sizeFor(w, h);
  const style = LOOK[look] ?? LOOK.cinematic;

  // Aspirational mode: every frame is its own generation with no reference
  // image and no recurring person. Coherence comes from the shared LOOK, not
  // from a face — which is how the reference sets are actually built. Round
  // one of the gauntlet put one man with his hand over his face on five of six
  // slides, because "hold the subject" was the only mode there was.
  if (mode === 'aspirational') {
    const files = [];
    let usd = 0, cached = 0;
    for (let i = 0; i < scenes.length; i++) {
      const r = await generate({
        root, cacheDir, size, quality, label: `${id}-a${i}`,
        prompt: `${style} ${scenes[i]} ${ASPIRE_GUARD}`,
      });
      files.push(r.file);
      usd += r.usd ?? 0;
      if (r.cached) cached++;
    }
    return { files, usd: +usd.toFixed(4), cached, size, quality, anchor: null, mode };
  }

  // The anchor carries the whole set's likeness, so it is drawn from the scene
  // that shows the face most plainly rather than from slide 1, which is often
  // a wide or a detail shot.
  const anchorScene = scenes[0];
  let anchor = null;
  for (let i = 0; i < Math.max(1, anchorTries); i++) {
    const r = await generate({
      root, cacheDir, size, quality, label: `${id}-anchor`, variant: i,
      prompt: `${style} ${subject} ${anchorScene} ${GUARD}`,
    });
    if (!anchor) anchor = r;
  }

  const files = [anchor.file];
  let usd = anchor.usd ?? 0, cached = anchor.cached ? 1 : 0;

  for (let i = 1; i < scenes.length; i++) {
    // A close-up is asked for by the scene, and "keep the same face" pulls
    // the model straight back to the anchor's full-body framing — round one
    // of the gym gauntlet rendered "a tight close-up of a bicep" as the same
    // mirror selfie four times. So a close-up keeps the person by skin, build
    // and clothing, and is told outright that the face is not in the frame.
    const closeUp = /close-up|no face|from behind|from the waist down|neck down/i.test(scenes[i]);
    const keep = closeUp
      ? `Same person as the reference image — same skin tone, same build, same clothing and shoes — and the same gym and lighting, this is the same session. But the framing is DIFFERENT from the reference: ${scenes[i]} The face is NOT in the frame; the body part named fills the frame, shot close on a phone. Do not repeat the reference composition.`
      : `Keep the SAME PERSON from the reference image: same face, same hair, same body, same clothing, same shoes. Same location and same lighting as the reference — this is the same session. Do not restyle or age them. New scene: ${scenes[i]}`;
    const r = await generate({
      root, cacheDir, size, quality, label: `${id}-${i}`,
      refs: [anchor.file],
      // Naming what must NOT change does more work than describing the person
      // again — the reference already carries the likeness, and re-describing
      // it invites the model to reinterpret rather than preserve.
      prompt: `${style} ${keep} ${GUARD}`,
    });
    files.push(r.file);
    usd += r.usd ?? 0;
    if (r.cached) cached++;
  }

  return { files, usd: +usd.toFixed(4), cached, size, quality, anchor: anchor.file };
}

export { LOOK };
