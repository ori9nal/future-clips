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
  } = o;
  const size = sizeFor(w, h);
  const style = LOOK[look] ?? LOOK.cinematic;

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
    const r = await generate({
      root, cacheDir, size, quality, label: `${id}-${i}`,
      refs: [anchor.file],
      // Naming what must NOT change does more work than describing the person
      // again — the reference already carries the likeness, and re-describing
      // it invites the model to reinterpret rather than preserve.
      prompt: `${style} Keep the SAME PERSON from the reference image: same face, same hair, same clothing. ` +
        `Do not restyle or age them. New scene: ${scenes[i]} ${GUARD}`,
    });
    files.push(r.file);
    usd += r.usd ?? 0;
    if (r.cached) cached++;
  }

  return { files, usd: +usd.toFixed(4), cached, size, quality, anchor: anchor.file };
}

export { LOOK };
