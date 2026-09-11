// Scene enforcement for the feed format.
//
// Two things the model cannot be trusted with, both learned the hard way:
//
//  1. WHAT is in the frame. Left alone it writes rain on a bus window because
//     the brief mentions blown accounts. So every scene is validated and a
//     dreary or repeated one is swapped from a bank of scenes known to render
//     like the reference.
//
//  2. Whether the frames belong TOGETHER. Round nine of the trading gauntlet
//     had a dark garage, an orange sunset, a teal pool and a bright penthouse
//     in one set — six postcards from six different days. The reference sets
//     are one world: one time of day, one palette, and for gym content one
//     location. So a WORLD is chosen once per set and appended to every scene,
//     and the bank is split by world so a "bright midday" set cannot draw a
//     night frame.

/** Words that mean the frame will be grey, sad, or indoors-in-a-bad-way. */
const DREARY = /\b(rain|raining|wet window|bus|train|tram|subway|bedroom|bed\b|caf[eé]|coffee shop|office|cubicle|sad|alone|lonely|tired|crying|hand over|head in hands|dim room|grey|gray|overcast|drizzle|commute|waiting room|hallway|corridor|stairwell)\b/i;

/**
 * A world is the shared light and palette of a set. It is appended verbatim to
 * every scene prompt, which is what makes six separate generations read as
 * one shoot. Bright worlds exist because the reference is not always dark —
 * set 01 is a sunset waterfront, set 14 a midday palm walk.
 */
export const WORLDS = {
  golden: {
    label: 'golden hour',
    prompt: 'Golden hour, low warm sun, long soft shadows, amber and honey tones, the whole frame warm and bright.',
    time: 'day', look: 'sunlit',
  },
  midday: {
    label: 'bright midday',
    prompt: 'Bright clear midday, strong sun, crisp shadows, saturated blues and clean whites, the whole frame bright.',
    time: 'day', look: 'clean',
  },
  bluehour: {
    label: 'blue hour',
    prompt: 'Blue hour just after sunset, deep blue sky, warm artificial lights just coming on, cool and warm together.',
    time: 'dusk', look: 'steel',
  },
  night: {
    label: 'night',
    prompt: 'Night, artificial light only, deep blacks, pools of warm light, reflections, the whole frame dark and rich.',
    time: 'night', look: 'cinematic',
  },
};

/**
 * Gym worlds. The reference gym sets are one gym, one session — that is their
 * coherence — so the world here is a LOCATION described once and appended to
 * every frame. Three gyms so consecutive sets are not the same room, and two
 * of the three are bright, because "always dark" was the complaint.
 */
export const GYMS = {
  bright: {
    label: 'bright commercial gym',
    prompt: 'The same gym in every frame: bright white walls, pale wood floor, chrome and black equipment, big windows with daylight pouring in, clean and airy, blue accents. Bright, clean, high-key.',
    time: 'gym', look: 'clean',
  },
  red: {
    label: 'red-lit gym',
    prompt: 'The same gym in every frame: black rubber floor, matte black racks, red LED strip lighting along the walls, mirrors on one side, cool overhead light with warm red accents.',
    time: 'gym', look: 'cinematic',
  },
  loft: {
    label: 'daylight loft gym',
    prompt: 'The same gym in every frame: a converted warehouse loft, exposed brick, tall industrial windows with warm afternoon daylight, black iron plates, wooden floor, chalk dust in the light. Warm and bright.',
    time: 'gym', look: 'sunlit',
  },
};

/**
 * Scene bank per niche. Each entry names the worlds it works in, so a set
 * locked to midday cannot draw a night-only frame. `kind` stops a set drawing
 * two of the same thing.
 */
export const BANK = {
  trading: [
    { kind: 'car',       worlds: ['night', 'dusk', 'day'], scene: 'A dark sports car parked on a city street, shot from low and behind, buildings in the background.' },
    { kind: 'pool',      worlds: ['day', 'night'],         scene: 'A hotel infinity pool with tall palm trees around it, a single lounger in the foreground, nobody in the water.' },
    { kind: 'penthouse', worlds: ['day', 'dusk'],          scene: 'A floor-to-ceiling window on a high floor, a dense city stretching to the horizon, light across a bare wooden floor.' },
    { kind: 'desk',      worlds: ['night', 'dusk'],        scene: 'A trading desk with three monitors showing candlestick charts, a mechanical keyboard, a glass of water, nobody at the desk.' },
    { kind: 'yacht',     worlds: ['day', 'dusk'],          scene: 'The bow of a yacht on calm open water, coastline in the distance, teak deck in the foreground.' },
    { kind: 'cabin',     worlds: ['day'],                  scene: 'A first-class airline window seat at cruising altitude, clouds below the wing.' },
    { kind: 'interior',  worlds: ['night', 'dusk'],        scene: 'The interior of a luxury car from the driver seat, dashboard glowing, the road ahead through the windscreen.' },
    { kind: 'rooftop',   worlds: ['dusk', 'day', 'night'], scene: 'A rooftop terrace above a city, glass balustrade, the skyline beyond, a single chair.' },
    { kind: 'watch',     worlds: ['day', 'night'],         scene: 'A steel watch and a phone resting on a marble table by a window, shallow depth of field.' },
    { kind: 'palms',     worlds: ['day'],                  scene: 'A palm-lined waterfront path, a city skyline far across the water, the path empty.' },
    { kind: 'lobby',     worlds: ['night', 'dusk'],        scene: 'A marble hotel lobby, warm downlights, a long empty corridor of polished stone, one plant.' },
    { kind: 'garage',    worlds: ['night'],                scene: 'A clean underground garage with one dark sports car under a single downlight, concrete floor.' },
    { kind: 'beach',     worlds: ['day'],                  scene: 'A white sand beach from the edge of a private villa deck, turquoise water, one sun lounger.' },
    { kind: 'street',    worlds: ['day'],                  scene: 'A wide clean boulevard lined with palms and white buildings, a convertible parked at the kerb.' },
  ],
  fitness: [
    { kind: 'mirror',   worlds: ['gym'], scene: 'A gym mirror selfie framing, phone held at chest height in front of the face, muscular torso in a fitted tee, the gym behind.' },
    { kind: 'arm',      worlds: ['gym'], scene: 'A close-up of a forearm and bicep mid-curl holding a dumbbell, veins visible, the gym out of focus behind.' },
    { kind: 'back',     worlds: ['gym'], scene: 'A shirtless back from behind at the cable station, lats flared, no face visible.' },
    { kind: 'rack',     worlds: ['gym'], scene: 'A loaded barbell on a squat rack, chalk on the bar, nobody in frame.' },
    { kind: 'bench',    worlds: ['gym'], scene: 'A flat bench and a pair of dumbbells on the floor, shot from low.' },
    { kind: 'cable',    worlds: ['gym'], scene: 'A close-up of a hand gripping a cable attachment, forearm tense, the weight stack blurred behind.' },
    { kind: 'abs',      worlds: ['gym'], scene: 'A torso from the neck down in a gym mirror, abs visible, grey shorts, phone held low, no face.' },
    { kind: 'shoulder', worlds: ['gym'], scene: 'A close-up of a shoulder and upper arm at the top of a lateral raise, dumbbell in hand, skin lit from the side.' },
    { kind: 'legs',     worlds: ['gym'], scene: 'Quads from the waist down at the bottom of a squat, the bar across the shoulders just out of frame.' },
    { kind: 'floor',    worlds: ['gym'], scene: 'Training shoes on the gym floor from above, a dumbbell beside them.' },
    { kind: 'shaker',   worlds: ['gym'], scene: 'A shaker bottle and wrist straps on a bench, gym equipment blurred behind.' },
    { kind: 'sled',     worlds: ['gym'], scene: 'A weighted sled on turf, chalk dust in the air.' },
  ],
};

/**
 * Gym frames follow the COPY, not a cursor. Reference set 08 is five bicep
 * exercises and five different close-ups of the same arm — the "no repeated
 * kind" rule that keeps a trading set from drawing two cars is exactly wrong
 * here. So a ranked item's heading is matched to the muscle it works and the
 * frame is that muscle mid-rep, tight, with the implement named.
 */
const ANATOMY = [
  { rx: /hammer|forearm|wrist|grip/i,                 scene: 'A tight close-up of a forearm and bicep mid hammer curl, dumbbell held neutral, veins visible, the arm filling the frame, no face.' },
  { rx: /preacher/i,                                  scene: 'A tight close-up of a bicep at the top of a preacher curl, arm on the pad, bar in hand, no face.' },
  { rx: /incline|dumbbell curl|db curl/i,             scene: 'A tight close-up of a bicep mid incline dumbbell curl, arm hanging back, dumbbell in hand, veins visible, no face.' },
  { rx: /cable curl|bayesian|cable/i,                 scene: 'A tight close-up of a bicep and forearm mid cable curl, the cable handle in hand, the weight stack blurred behind, no face.' },
  { rx: /spider|concentration/i,                      scene: 'A tight close-up of a bicep peaked mid concentration curl, elbow braced, dumbbell in hand, no face.' },
  { rx: /chin|pull.?up|pullup/i,                      scene: 'A back and arms from behind at the top of a chin-up, hands on the bar, lats and biceps tight, no face.' },
  { rx: /curl|bicep/i,                                scene: 'A tight close-up of a bicep mid barbell curl, bar in both hands, veins visible, the arm filling the frame, no face.' },
  { rx: /row|pulldown|lat|back|rear delt|erector/i,   scene: 'A shirtless back from behind mid row at the cable station, lats flared, no face.' },
  { rx: /calf|calves/i,                               scene: 'Calves from behind at the top of a standing calf raise, heels high, shot from low, no face.' },
  { rx: /tibialis|shin|ankle/i,                        scene: 'Shins and training shoes from the knee down, feet flexed up mid tibialis raise, shot from low, no face.' },
  { rx: /glute|hip thrust|hip/i,                       scene: 'Hips and hamstrings from the side at the top of a hip thrust, back on the bench, bar across the hips, no face.' },
  { rx: /squat|quad|leg|hamstring|adductor/i,          scene: 'Quads from the waist down at the bottom of a squat, bar across the shoulders just out of frame, shot from low.' },
  { rx: /bench|chest|press|push.?up|fly/i,            scene: 'A close-up of a chest and shoulder from the side mid dumbbell press, lying on the bench, dumbbell overhead, no face.' },
  { rx: /shoulder|delt|raise|overhead/i,              scene: 'A close-up of a shoulder and upper arm at the top of a lateral raise, dumbbell in hand, skin lit from the side, no face.' },
  { rx: /tricep|dip|skull|pushdown/i,                 scene: 'A close-up of the back of an upper arm mid tricep pushdown, rope in hand, the arm filling the frame, no face.' },
  { rx: /abs|core|plank|crunch/i,                     scene: 'A torso from the neck down in the gym mirror, abs visible, phone held low, no face.' },
  { rx: /neck|trap|shrug/i,                           scene: 'Neck and traps from behind mid shrug, dumbbells at the sides, no face.' },
  { rx: /sleep|rest|recover/i,                        scene: 'A shaker bottle, wrist straps and a phone on a bench, gym equipment blurred behind, nobody in frame.' },
  { rx: /log|track|write|app|note|phone/i,            scene: 'A phone propped on a dumbbell rack showing a notes screen, a wrist strap beside it, the gym blurred behind, nobody in frame.' },
  { rx: /food|meal|protein|eat|creatine|supplement/i, scene: 'A shaker bottle and a meal container on a gym bench, equipment blurred behind, nobody in frame.' },
];

/**
 * The anatomy frame a ranked heading wants. A heading the table does not
 * know still gets a close-up of the muscle it names rather than a random
 * bank frame — "6. Tibialis" rendered as a man sat on a bench on round four.
 */
export function anatomyFor(heading, { fallback = false } = {}) {
  const h = String(heading ?? '').trim();
  const hit = ANATOMY.find((a) => a.rx.test(h))?.scene ?? null;
  if (hit || !fallback || !h) return hit;
  // a short heading is a muscle or a lift; a long one is a claim ("Loading
  // phase is a myth") and gets a physique frame instead of nonsense
  if (h.split(/\s+/).length <= 3) {
    return `A tight close-up of the ${h.toLowerCase()} mid-rep, the working muscle filling the frame, shot on a phone in the gym, no face.`;
  }
  return null;
}

/** Physique frames for headings that name no muscle — a supplement set's "Timing does not matter". */
const PHYSIQUE = [
  'A torso from the neck down in the gym mirror, abs visible, phone held low, no face.',
  'A tight close-up of a bicep mid dumbbell curl, veins visible, the arm filling the frame, no face.',
  'A shirtless back from behind at the cable station, lats flared, no face.',
  'A shaker bottle and an open tub with a scoop on a gym bench, equipment blurred behind, nobody in frame.',
  'A close-up of a shoulder and upper arm at the top of a lateral raise, dumbbell in hand, no face.',
  // not "a hand holding a phone" — that renders as the same sat-down mirror
  // selfie the closer uses, and round five had the two side by side
  'Chalked hands gripping a loaded barbell on the floor, shot from above, forearms tense, no face.',
];

/** Map a campaign niche onto a bank. Unknown niches get trading, the broadest. */
export function bankFor(niche) {
  const n = String(niche ?? '').toLowerCase();
  if (/gym|fitness|calisthenic|physique|supplement|nutrition|health|muscle/.test(n)) return BANK.fitness;
  return BANK.trading;
}

const hash = (s) => { let h = 7; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) % 100003; return h; };

/**
 * Choose the world for a set. Deterministic per seed so a re-render is
 * stable, but a different seed (a different ask, a different set number)
 * lands a different world. Day wins two times in four for trading and two in
 * three for gym: the trading gauntlet was night nine rounds running, and the
 * reference is not.
 */
export function worldFor(niche, seed = '') {
  const bank = bankFor(niche);
  if (bank === BANK.fitness) {
    const ids = Object.keys(GYMS);
    const id = ids[hash(seed) % ids.length];
    return { id, ...GYMS[id] };
  }
  const ids = Object.keys(WORLDS);
  const id = ids[hash(seed) % ids.length];
  return { id, ...WORLDS[id] };
}

/** The `kind` a free-text scene most resembles, or null. */
function kindOf(scene, bank) {
  const s = String(scene).toLowerCase();
  for (const b of bank) if (s.includes(b.kind)) return b.kind;
  if (/porsche|ferrari|lamborghini|supercar|convertible|\bcar\b/.test(s)) return 'car';
  if (/pool/.test(s)) return 'pool';
  if (/window|skyline|city view/.test(s)) return 'penthouse';
  if (/monitor|desk|screen|chart/.test(s)) return 'desk';
  if (/boat|yacht|deck/.test(s)) return 'yacht';
  if (/beach|sand/.test(s)) return 'beach';
  if (/bicep|curl|forearm/.test(s)) return 'arm';
  if (/lat|pulldown|row\b/.test(s)) return 'back';
  if (/squat|quad|leg/.test(s)) return 'legs';
  if (/barbell|rack/.test(s)) return 'rack';
  return null;
}

/**
 * Enforce the scene list for one set.
 *
 * Picks a world, then fills every slot from the bank entries that belong to
 * that world — no kind repeated, the hook from the strongest kinds. The
 * model's own scene text is used only as a hint for which kind to prefer;
 * its wording is never sent to the image model, because that is how the
 * bus window got in.
 *
 * @returns {{scenes:string[], world:object, replaced:number[]}}
 */
export function enforce(scenes, { niche, appIndex = -1, seed = '', headings = [] } = {}) {
  const bank = bankFor(niche);
  const world = worldFor(niche, seed);

  if (bank === BANK.fitness) {
    // One lifter, one gym, one session. The hook is the mirror selfie (it is
    // also the anchor the other frames are edited from, so it must show the
    // outfit); every ranked frame is the muscle its heading names; the closer
    // is a second mirror frame, sat down. Kinds repeat on purpose.
    const mirror = bank.find((b) => b.kind === 'mirror').scene;
    const out = scenes.map((scene, i) => {
      let s;
      if (i === 0) s = mirror;
      else if (i === scenes.length - 1) s = 'A gym mirror selfie sat on a bench between sets, phone in front of the face, the gym behind.';
      else s = anatomyFor(headings[i - 1]) ?? anatomyFor(scene) ?? anatomyFor(headings[i - 1], { fallback: true })
        ?? PHYSIQUE[(i - 1 + hash(seed)) % PHYSIQUE.length];
      return `${s} ${world.prompt}`;
    });
    return { scenes: out, world, replaced: out.map((_, i) => i) };
  }

  const eligible = bank.filter((b) => b.worlds.includes(world.time));
  const usedKinds = new Set();
  let cursor = hash(seed + '|scene') % Math.max(1, eligible.length);

  const draw = (preferKinds = []) => {
    for (const k of preferKinds) {
      const b = eligible.find((e) => e.kind === k && !usedKinds.has(k));
      if (b) { usedKinds.add(b.kind); return b; }
    }
    for (let step = 0; step < eligible.length; step++) {
      const b = eligible[(cursor + step) % eligible.length];
      if (!usedKinds.has(b.kind)) { usedKinds.add(b.kind); cursor = (cursor + step + 1) % eligible.length; return b; }
    }
    return eligible[cursor % eligible.length];
  };

  // The hook comes from the strongest kinds, rotated by seed so consecutive
  // sets do not all open on the same car. For gym the mirror selfie leads:
  // it is the anchor frame, and it is the one that shows the outfit the rest
  // of the set has to keep.
  const STRONG = bank === BANK.fitness
    ? ['mirror', 'back', 'abs']
    : ['car', 'penthouse', 'beach', 'garage', 'pool', 'rooftop'];
  const r = hash(seed + '|hook') % STRONG.length;
  const hookOrder = [...STRONG.slice(r), ...STRONG.slice(0, r)];
  const out = scenes.map((scene, i) => {
    const hint = scene && !DREARY.test(scene) ? kindOf(scene, bank) : null;
    const b = i === 0 ? draw(hookOrder) : draw(hint ? [hint] : []);
    // the world is appended to every frame; this is the whole coherence mechanism
    return `${b.scene} ${world.prompt}`;
  });
  return { scenes: out, world, replaced: scenes.map((_, i) => i) };
}
