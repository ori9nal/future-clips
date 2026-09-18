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
//
// 2026-09-13: the prompts were rewritten against the reference corpus. The
// scene line (engine/scenes.mjs) now carries the whole camera situation, so
// the LOOK here is short; the GUARD forbids the photograph vocabulary by
// name; and the identity line holds the PERSON — face shape, hair, skin,
// build, body hair — and explicitly releases the wardrobe, the room and the
// framing, because "keep the same person" alone copies the hoodie into the
// boat shot.
import fs from 'node:fs';
import path from 'node:path';
import { generate, sizeFor } from './providers/image.mjs';
import { LIVES } from './scenes.mjs';

/** Photographic direction shared by every frame, so the set grades as one. */
const LOOK = {
  phone: 'A phone photo from someone\'s camera roll, not a photograph.',
  cinematic: 'Cinematic phone photo, 35mm, natural light, shallow depth of field, muted film grade, fine grain.',
  steel: 'Cinematic photo, cool blue-grey grade, hard directional light, deep shadows, high contrast, fine grain.',
  sunlit: 'Warm natural photo, golden window light, soft shadows, gentle contrast, airy and clean.',
  clean: 'Clean editorial photo, soft even daylight, neutral colour, minimal styling, plenty of negative space.',
  ash: 'Desaturated photo, near-monochrome, overcast light, muted greys, quiet and still.',
  // the Grow with Alex family: cinematic, a little surreal, one subject, deep colour, a lot of air
  alex: 'A cinematic editorial photograph, wide lens, deep saturated colour, golden or blue hour, film grain, one subject and a lot of sky or open ground around it, a little surreal, composed like a magazine cover.',
};

/**
 * What is forbidden, by name. The image model's default for "a man in a
 * gym" is a fitness catalogue: symmetrical face, softbox light, smooth skin,
 * centred, clean floor. Every one of those is a tell next to the reference.
 */
const GUARD = 'No text, no logos, no watermarks, no captions anywhere in the image. One person only. ' +
  'Not a photoshoot: no studio lighting, no softbox, no rim light, no bokeh, no golden-hour glow, no symmetry, no centred composition, ' +
  'no retouching, no smooth skin, no model looking at the camera, no professional photography, no render, no illustration.';

/**
 * The aspirational guard is different in kind: it forbids the thing that made
 * round one fail. No face, no emotional pose, no person as the subject — the
 * subject is the place or the object, shot the way a phone catches it.
 */
const ASPIRE_GUARD = 'A phone photo, not staged, not a stock photo, not a render. A person may appear from behind, hooded, or as a hand or a shoe — never a visible face, never posing. ' +
  'No text, no logos, no watermarks. No studio lighting, no bokeh, no HDR glow, no symmetry, no cinematic grade, no perfectly clean surfaces. ' +
  'Nothing is showroom-clean: a car has road dust, water spots and fingerprints on the paint; glass has smears; the ground has marks and litter.';

/**
 * The identity line. What must NOT change is the person; what must change
 * is everything else. Naming the released things does more work than
 * re-describing the person — the reference already carries the likeness.
 */
/**
 * F17 (rounds 0 and 3, 2026-09-18): "no smooth skin, no model" in the GUARD
 * still returned a symmetrical catalogue face on the hook. Negatives are weak;
 * naming the ordinary things is not. The anchor alone carries this, and every
 * later frame inherits the face from it.
 */
// 2026-09-18: written for any subject — the fashion, skin and GLP-1 families
// are a young woman (F30), so no stubble here; the subject line carries it.
const ORDINARY = 'An ordinary-looking person, not a model: some asymmetry in the face, a spot or two, tired eyes, a shine on the forehead, hair that needs a cut, the skin texture of a phone photo.';

const SAME_PERSON = 'The SAME PERSON as the reference image: same face shape, same hair, same skin tone, same build, same body hair, same tattoos if any.';
const RELEASE = 'Photographed on a DIFFERENT day: do not copy the reference\'s clothing, room, lighting, camera angle or framing.';

/**
 * The trading set's constant is a possession, not a person (engine/scenes.mjs
 * LIVES). Round 2 (2026-09-18) drew a Lamborghini on the hook and a different
 * saloon two slides later, because every aspirational frame was its own
 * generation. So when the hook names the life's car, it is drawn first and the
 * later frames that name the same car are edits of it.
 */
const SAME_CAR = 'The SAME CAR as in the reference image: same model, same colour, same wheels, same number plate. Photographed on a different day in a different place at a different time of day: do not copy the reference\'s angle, light or background.';

/**
 * F20 (round 7, 2026-09-18): an object scene ("nobody in the frame") sent as an
 * edit of the anchor with "the SAME PERSON as the reference" came back as the
 * person in a gym. A frame with nobody in it references nothing.
 */
const NOBODY = /nobody in the frame|no people|nobody in shot/i;
const OBJECT_GUARD = 'No text, no logos, no watermarks. No person in the frame, not even a hand. Not a photoshoot: no studio lighting, no softbox, no bokeh, no symmetry, no product-photography styling, no render.';

/** The editorial guard: designed imagery may be clean, but never text, never a stock-photo pose. */
const EDITORIAL_GUARD = 'No text, no letters, no logos, no watermarks, no captions anywhere in the image. If a person appears they are small in the frame or seen from behind, never looking at the camera, never posing. Not a stock photo, not a render, not an illustration.';

/** A scene that asks for the app screenshot on a phone (engine/scenes.mjs SHOTS.phone). */
const APPSHOT = /^An iPhone lying face up on/;

/**
 * The prompt for every frame of a set, without spending anything.
 *
 * Returned as a plan so the same words go out whichever lane runs them: the
 * realtime executor below calls the API frame by frame; the batch lane
 * (engine/providers/openai-batch.mjs) submits the anchor as one batch and,
 * when it lands, the remaining frames as a second batch conditioned on it.
 * Frames after the anchor need the anchor's FILE (the edit endpoint takes the
 * pixels), so `frames(anchorFile)` is a function of it rather than a list.
 *
 * `appScreen` is the app screenshot's path; a scene that is the phone-on-a-
 * bench shot is generated as an edit of THAT image rather than of the
 * anchor — the phone's screen has to show the real app, and the person is
 * not in the frame.
 */
export function planSet(o) {
  const {
    subject, scenes, look = 'phone', quality = 'medium', w = 1080, h = 1920, id = 'set',
    mode = 'subject', days = false, appScreen = null,
  } = o;
  const size = sizeFor(w, h);
  const style = LOOK[look] ?? LOOK.phone;

  const appFrame = (scene, i) => ({
    i, label: `${id}-app${i}`, refs: [appScreen],
    prompt: `${style} ${scene} The phone's screen shows EXACTLY the app screenshot in the reference image, the same layout and colours, legible. No text anywhere except on the phone screen. No person. Not a render: the phone is a real object on a real surface with a reflection on the glass.`,
  });

  if (mode === 'editorial') {
    // every frame its own generation; coherence comes from the look, the page and the type
    const indep = (scene, i) => (appScreen && APPSHOT.test(scene) ? appFrame(scene, i) : { i, label: `${id}-a${i}`, refs: [], prompt: `${style} ${scene} ${EDITORIAL_GUARD}` });
    return { mode, size, quality, anchor: null, frames: () => scenes.map(indep) };
  }
  if (mode === 'aspirational') {
    const indep = (scene, i) => (appScreen && APPSHOT.test(scene)
      ? appFrame(scene, i)
      : { i, label: `${id}-a${i}`, refs: [], prompt: `${style} ${scene} ${ASPIRE_GUARD}` });
    // the hook names the life's car → it is the anchor and the other car frames are edits of it
    const car = LIVES.map((L) => L.car).find((c) => String(scenes[0] ?? '').includes(c));
    if (!car) return { mode, size, quality, anchor: null, frames: () => scenes.map(indep) };
    const anchor = indep(scenes[0], 0);
    const frames = (anchorFile) => scenes.slice(1).map((scene, n) => {
      const i = n + 1;
      if (anchorFile && scene.includes(car) && !(appScreen && APPSHOT.test(scene))) {
        return { i, label: `${id}-a${i}`, refs: [anchorFile], prompt: `${style} ${SAME_CAR} ${scene} ${ASPIRE_GUARD}` };
      }
      return indep(scene, i);
    });
    return { mode, size, quality, anchor, frames, car };
  }

  const anchor = { i: 0, label: `${id}-anchor`, refs: [], prompt: `${style} ${subject} ${ORDINARY} ${scenes[0]} ${GUARD}` };
  const frames = (anchorFile) => scenes.slice(1).map((scene, n) => {
    const i = n + 1;
    if (appScreen && APPSHOT.test(scene)) return appFrame(scene, i);
    if (NOBODY.test(scene)) return { i, label: `${id}-o${i}`, refs: [], prompt: `${style} ${scene} ${OBJECT_GUARD}` };
    // A close-up is asked for by the scene, and "keep the same face" pulls
    // the model straight back to the anchor's full-body framing — round one
    // of the gym gauntlet rendered "a tight close-up of a bicep" as the same
    // mirror selfie four times. So a close-up keeps the person by skin, build
    // and clothing, and is told outright that the face is not in the frame.
    const closeUp = /no face|from behind|from the waist down|neck down|head out of frame|face is hidden|looking down (?:from|at) (?:his|her|their) own|covering (?:half |part of )?(?:her|his|the) face/i.test(scene);
    // `days` mode: the person is the constant, everything else changes.
    const keep = days
      ? (closeUp
        ? `${SAME_PERSON} ${RELEASE} ${scene} The face is not in the frame; the body part named fills the frame.`
        : `${SAME_PERSON} ${RELEASE} ${scene}`)
      : closeUp
        ? `Same person as the reference image — same skin tone, same build, same clothing and shoes — and the same gym and lighting, this is the same session. But the framing is DIFFERENT from the reference: ${scene} The face is NOT in the frame; the body part named fills the frame, shot close on a phone. Do not repeat the reference composition.`
        : `Keep the SAME PERSON from the reference image: same face, same hair, same body, same clothing, same shoes. Same location and same lighting as the reference — this is the same session. Do not restyle or age them. New scene: ${scene}`;
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
 * @param {string} [o.appScreen]  the app screenshot, for the phone-on-a-bench frame
 */
export async function generateSet(o) {
  const { root, cacheDir, anchorTries = 1 } = o;
  const plan = planSet(o);
  const { size, quality, mode } = plan;

  // Aspirational mode: every frame is its own generation with no reference
  // image and no recurring person. Coherence comes from the shared LIFE
  // (engine/scenes.mjs), not from a face — which is how the reference sets
  // are actually built.
  if (!plan.anchor) {
    const files = [];
    let usd = 0, cached = 0;
    for (const f of plan.frames()) {
      const r = await generate({ root, cacheDir, size, quality, label: f.label, refs: f.refs, prompt: f.prompt });
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
