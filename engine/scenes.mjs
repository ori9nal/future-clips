// Scene enforcement for the phone-photo formats (feed, native).
//
// Two things the model cannot be trusted with, both learned the hard way:
//
//  1. WHAT is in the frame. Left alone it writes rain on a bus window because
//     the brief mentions blown accounts. So every scene is validated and a
//     dreary or repeated one is swapped from a bank of scenes known to render
//     like the reference.
//
//  2. HOW the frame was taken. Left alone the image model returns a
//     photograph: catalogue-lit, centred, symmetrical, smooth skin. The
//     reference corpus (Carousel examples/, 237 slides, surveyed 2026-09-13)
//     is phone photos, and what makes them phone photos is not grain — it is
//     the camera SITUATION: who held the phone, where they stood, what got
//     cut off, what is on the floor. So a scene here is a SHOT TYPE (mirror,
//     pov, crop, friend, object, phone) filled in with the subject, plus one
//     or two framing mistakes, plus the camera line for the family.
//
// Measured off the 70 gym-family slides: mirror selfie 27 %, close crop with
// no head 20 %, friend-shot mid-distance 16 %, POV looking down at own body
// 13 %, the phone photographed with the app open 13 %, objects 8 %, outdoors
// 7 %. A clear face straight to camera appears on 8 of 70. The same person
// wears something different in nearly every frame. Off the 40 wealth slides:
// car exterior 18 %, a person from behind / hooded / face hidden 18 %,
// desk-and-monitors or penthouse window 18 %, pool / palms / dusk 18 %, plane
// seat or laptop on a tray 10 %, car interior POV 8 %, boat 8 %; 37 % of the
// frames are daylight.

/** Words that mean the frame will be grey, sad, or indoors-in-a-bad-way. */
const DREARY = /\b(rain|raining|wet window|bus|train|tram|subway|caf[eé]|coffee shop|office|cubicle|sad|alone|lonely|tired|crying|hand over|head in hands|grey|gray|overcast|drizzle|commute|waiting room)\b/i;

/* ── the camera line: what returns a phone photo, not a photograph ────── */

/**
 * One line per family, appended to every frame. Written as the situation a
 * phone was in, never as a filter ("grainy", "soft" read as a look and the
 * model paints a look). The forbid-list names the studio vocabulary the
 * model reaches for by default.
 */
export const CAMERA = {
  gym: 'Taken on an iPhone, straight off the camera roll, unedited: auto exposure so the window or the ceiling lights blow out, overhead gym LED light with a slight green cast, real skin with pores and veins and an uneven tan, a little motion softness, ordinary clutter in the background (a water bottle, a towel, a bag on the floor, another member mid-set). Not a photoshoot: no studio light, no softbox, no rim light, no bokeh, no golden hour, no symmetry, no retouching, no model pose, no colour grade, nobody smiling at the lens.',
  wealth: 'Taken on an iPhone by the owner or a friend, straight off the camera roll: auto exposure, streetlights and screens blowing out at night, a slight tilt, reflections in glass, part of the phone or a finger sometimes in the frame edge, ordinary clutter (a charger cable, a bag, a coffee cup, a receipt on the seat). Not a photoshoot and not a render: no studio light, no bokeh, no HDR glow, no symmetry, no cinematic grade, no perfectly clean surfaces.',
  food: 'Taken on an iPhone in a real kitchen, straight off the camera roll, flash on or the ceiling light overhead, shot from standing height at a slight angle, the counter cluttered (a pack of rice, a kitchen roll, a phone, a spoon on the side), plates that do not match, unedited. Not food photography: no styling, no soft window light, no bokeh, no garnish, no top-down flat lay, no colour grade.',
};

/** Kept for importers; the gym camera line under its old name. */
export const PHONE_LOOK = CAMERA.gym;

/**
 * Framing mistakes, one or two per frame, rotated by seed. Each is something
 * counted in the corpus: cut-off heads on 28 of 70 gym slides, tilted floors
 * on about 15, a stranger in the background on about 12, flash in a mirror
 * on 5, fingers or the phone edge in shot on 6.
 */
export const MISTAKES = {
  // `on` lists the shot types a mistake makes sense for; a flash in the
  // mirror on a POV shot is a contradiction the model resolves badly
  gym: [
    { text: 'the top of the head is cut off by the frame',                 on: ['mirror', 'friend', 'outdoors'] },
    { text: 'the floor tilts a few degrees',                               on: ['mirror', 'friend', 'crop', 'object', 'outdoors', 'pov'] },
    { text: 'the phone and the fingers holding it cover part of the face', on: ['mirror'] },
    { text: 'the flash is on and flares in the mirror',                    on: ['mirror', 'mirror-dim'] },
    { text: 'a smudge and fingerprints on the mirror',                     on: ['mirror', 'mirror-dim'] },
    { text: 'shot slightly from below, the ceiling lights in frame',       on: ['friend', 'crop', 'mirror'] },
    { text: 'the subject is off-centre, more floor than needed at the bottom', on: ['mirror', 'friend', 'crop', 'outdoors'] },
    { text: 'motion blur on the moving arm',                               on: ['crop', 'pov', 'friend'] },
    { text: 'someone else walks through the background mid-set',           on: ['mirror', 'friend', 'crop'] },
    { text: 'a water bottle and a towel on the floor in the foreground',   on: ['mirror', 'friend', 'crop', 'object'] },
    { text: 'the window behind is completely blown out',                   on: ['mirror', 'friend', 'crop', 'outdoors'] },
    { text: 'the framing is loose and casual, lots of room around the subject', on: ['friend', 'object', 'outdoors'] },
    { text: 'the near edge is too close to the lens and goes soft',        on: ['pov', 'object', 'crop'] },
    { text: 'the phone case and a bit of the thumb in the corner',         on: ['pov'] },
  ],
  // `on` lists the kinds a mistake belongs to: round 4 (2026-09-18) put a
  // traffic cone on a penthouse terrace
  wealth: [
    { text: 'the horizon tilts a few degrees' },
    { text: 'a reflection of the phone in the window',                   on: ['interior', 'penthouse', 'plane', 'rooftop', 'lounge', 'desk'] },
    { text: 'part of a finger at the edge of the frame' },
    { text: 'the streetlights bloom and the shadows are crushed',        on: ['car', 'behind', 'street', 'garage', 'petrol', 'rooftop', 'interior'] },
    { text: 'the subject is off-centre, a lot of empty road or sky',     on: ['car', 'behind', 'street', 'petrol', 'boat', 'pool'] },
    { text: 'a traffic cone, a bin or a parked van in the background',  on: ['car', 'behind', 'street', 'garage', 'petrol'] },
    { text: 'the flash reflects off the paint',                         on: ['car', 'garage', 'petrol', 'watch'] },
    { text: 'a hand or a shoe in the bottom of the frame',              on: ['car', 'street', 'pool', 'boat', 'feetup', 'desk', 'behind', 'watch'] },
    { text: 'the framing is loose, shot quickly while walking past',    on: ['car', 'behind', 'street', 'garage'] },
  ],
  food: [
    'the plate is cut off by the edge of the frame',
    'the flash blows out the rim of the plate',
    'the counter tilts a few degrees',
    'a thumb at the edge of the frame',
    'the tap and a dirty pan in the background',
    'the phone is too close and the near edge is soft',
    'a kitchen roll and a pack of rice in the background',
    'shot standing, looking down at an angle, not from directly above',
  ],
};

/* ── gym: one person, many days, six kinds of shot ───────────────────── */

/**
 * A world is the shared light and palette of a set. Kept for the trading
 * format's day/night mix and for callers that read `look`.
 */
export const WORLDS = {
  golden: { label: 'late afternoon', prompt: 'Late afternoon, low sun, long shadows, warm but ordinary daylight.', time: 'day', look: 'phone' },
  midday: { label: 'midday', prompt: 'Bright midday, hard sun, deep shadows, the sky nearly white where the phone exposed for the ground.', time: 'day', look: 'phone' },
  bluehour: { label: 'dusk', prompt: 'Dusk, the sky still blue, the first lights on, the phone struggling with both.', time: 'dusk', look: 'phone' },
  night: { label: 'night', prompt: 'Night, streetlights and screens only, the phone pushing the exposure so the lights bloom and the blacks go grainy.', time: 'night', look: 'phone' },
};

/**
 * What he wears, one per frame, never repeated inside a set. The corpus
 * shows a new outfit in almost every gym frame (set-05: grey sweatpants,
 * white joggers, black tee, headphones; gym-2: four different shorts).
 */
export const OUTFITS = [
  'a black oversized hoodie and grey sweatpants',
  'shirtless in grey sweatpants',
  'a white t-shirt and black shorts',
  'a grey stringer tank and navy shorts',
  'a black compression tee and black joggers',
  'shirtless in black shorts with a cap on backwards',
  'a maroon t-shirt with the sleeves pushed up',
  'a grey hoodie with the hood up',
  'a plain white tee and light grey shorts',
  'a navy tee and camo shorts',
];

/** Rooms, one per frame where the shot type has a room. */
export const ROOMS = [
  'a busy commercial gym with a wall of mirrors and a dumbbell rack',
  'a gym locker room with tiled walls, grey lockers and soap dispensers on the counter',
  'an old iron gym with rubber floors, red plates and a low ceiling',
  'a small hotel gym with two treadmills and a big window',
  'a bedroom doorway with a full-length mirror and a lamp on',
  'a garage gym with a squat rack and a concrete floor',
  'a gym with black walls and posters, a bench and a water bottle on the floor',
  'a bright gym with skylights, cable stations and a squat rack',
];

/**
 * The six shot types. `frame(o)` writes the scene for a heading; `face`
 * says whether the anchor's face is in it (only the anchor and one friend
 * shot show a face, and never straight to camera).
 */
export const SHOTS = {
  mirror: {
    face: 'partly',
    // a part seen from behind is shot with the back to the mirror and the
    // phone over one shoulder (set-13 "4. Rear Delts"), never chest-height
    frame: ({ outfit, room, body, behind }) => (behind
      ? `Mirror selfie in ${room}: standing with his back to the mirror, the phone held up over one shoulder pointing at the mirror, ${outfit}, ${body} tensed, face turned away from the camera, the room reflected behind.`
      : `Mirror selfie in ${room}: the phone held at chest height in one hand, looking down at the screen not at the camera, ${outfit}, ${body ? `${body} tensed, ` : ''}the room reflected behind.`),
  },
  'mirror-dim': {
    face: 'no',
    frame: ({ outfit }) => `Dim mirror selfie in a bedroom doorway at night, one lamp on, the phone held in front of the face so the face is hidden, ${outfit}, the hallway dark behind.`,
  },
  pov: {
    face: 'no',
    frame: ({ body, outfit }) => `Looking down from his own eye level at his own ${body ?? 'forearm'}: it fills the lower half of the frame, ${outfit} visible, his thighs and the gym floor below, the room out of focus at the top. No face.`,
  },
  crop: {
    face: 'no',
    frame: ({ body, outfit, room }) => `A tight phone photo of his ${body ?? 'arm mid rep'}, the head out of frame, ${outfit}, ${room} behind, shot by a training partner from a metre away. No face.`,
  },
  friend: {
    face: 'turned',
    frame: ({ move, outfit, room }) => `Shot by a friend from a few metres away in ${room}: him ${move ?? 'mid set'}, head turned away or down, ${outfit}, other people and equipment around, nobody looking at the camera.`,
  },
  object: {
    face: 'no',
    frame: ({ thing }) => `${thing ?? 'A shaker bottle, wrist straps and a set of keys on a gym bench'}, shot on a phone from standing height, nobody in the frame.`,
  },
  outdoors: {
    face: 'turned',
    frame: ({ outfit, place }) => `${place ?? 'On a small boat on open water at midday, sat on the edge'}, ${outfit}, head turned away, shot by a friend on a phone.`,
  },
  phone: {
    face: 'no',
    frame: ({ surface }) => `An iPhone lying face up on ${surface ?? 'a black gym bench'}, shot from above at an angle on another phone, the screen lit and showing the app, a bit of screen glare, the surface and a bit of the room around it, nobody in the frame.`,
  },
};

/** Legacy DAYS bank — kept for importers; the shot types above supersede it. */
export const DAYS = [
  { kind: 'gym-hoodie',  scene: SHOTS.mirror.frame({ outfit: OUTFITS[0], room: ROOMS[0] }) },
  { kind: 'locker',      scene: SHOTS.mirror.frame({ outfit: OUTFITS[1], room: ROOMS[1] }) },
  { kind: 'boat',        scene: SHOTS.outdoors.frame({ outfit: 'shirtless in black shorts' }) },
  { kind: 'home-mirror', scene: SHOTS['mirror-dim'].frame({ outfit: OUTFITS[5] }) },
  { kind: 'arm',         scene: SHOTS.pov.frame({ body: 'forearm mid hammer curl', outfit: OUTFITS[6] }) },
  { kind: 'back',        scene: SHOTS.crop.frame({ body: 'back at the cable station', outfit: 'shirtless', room: ROOMS[2] }) },
];

/** Outdoor places for the closer or a lifestyle beat, rotated by seed. */
const PLACES = [
  'On a small boat on open blue water at midday, sat on the edge',
  'On a beach with a towel round the waist, sunbeds behind',
  'Hanging from an outdoor pull-up bar in a park under a white sky',
  'In the driver seat of a parked car after training, the window down',
  'On a hotel rooftop by the pool, sunglasses on',
  'Walking through a car park at night under sodium lights',
];

/** Objects for a heading that names no muscle. */
const THINGS = [
  'A row of supplement tubs on a white kitchen counter, labels facing every direction',
  'A meal in a plastic container on a gym bench, fork in it, shaker beside it',
  'Training shoes and a set of keys and headphones on the gym floor, shot looking down at his own feet',
  'The worn leather pad of a preacher curl bench, close and off-centre',
  'A shaker bottle, wrist straps and a phone on a bench, equipment behind',
  'A chalk-covered barbell on the floor, plates loaded, shot from standing',
];

/**
 * Gym worlds — kept for the `session` mode a brand can ask for by name, but
 * the default gym set is one person across many days.
 */
export const GYMS = {
  bright: { label: 'bright commercial gym', prompt: 'The same gym in every frame: white walls, pale floor, chrome and black equipment, big windows blown out by daylight.', time: 'gym', look: 'phone' },
  red:    { label: 'red-lit gym',           prompt: 'The same gym in every frame: black rubber floor, matte black racks, red LED strips, mirrors on one side.', time: 'gym', look: 'phone' },
  loft:   { label: 'loft gym',              prompt: 'The same gym in every frame: exposed brick, tall windows, black iron plates, a wooden floor, chalk on everything.', time: 'gym', look: 'phone' },
};

/**
 * A ranked heading → what body part and what movement the frame shows.
 * Reference set 08 is five bicep exercises and five different close-ups of
 * the same arm, each a different shot type: top-down at the machine, a
 * flex against a white wall, looking down at his own lap, the arm from the
 * shoulder in the gym, the mirror.
 */
const ANATOMY = [
  // "grip" alone matched "Wide grip pull ups" and "Wide grip lat pulldown" (round 10, 2026-09-18)
  { rx: /hammer|forearm|wrist|\bgrip (?:strength|work|training)\b/i, body: 'forearm and bicep mid hammer curl, the dumbbell held neutral', move: 'mid hammer curl with a dumbbell' },
  { rx: /preacher/i,                                  body: 'bicep at the top of a preacher curl, arm on the pad', move: 'on the preacher curl bench mid rep' },
  { rx: /incline|dumbbell curl|db curl/i,             body: 'bicep mid incline dumbbell curl, the arm hanging back', move: 'on an incline bench mid dumbbell curl' },
  // "cable" alone matched "Seated cable row" ahead of the row entry (round 3, 2026-09-18)
  { rx: /cable curl|bayesian/i,                       body: 'bicep and forearm mid cable curl, the handle in hand', move: 'at the cable station mid curl' },
  { rx: /spider|concentration/i,                      body: 'bicep peaked mid concentration curl, elbow braced', move: 'sat on a bench mid concentration curl' },
  { rx: /chin|pull.?up|pullup/i,                      body: 'back and arms at the top of a chin-up', move: 'at the top of a chin-up on the bar' },
  { rx: /curl|bicep/i,                                body: 'bicep flexed mid curl, veins up', move: 'mid barbell curl' },
  { rx: /row|pulldown|lat\b|lats|back|rear delt|erector/i, body: 'back from behind mid row, lats out', move: 'mid cable row, back to the camera', noPov: true },
  { rx: /calf|calves/i,                               body: 'calves from behind at the top of a calf raise', move: 'on the calf raise machine', noPov: true },
  { rx: /tibialis|shin|ankle/i,                       body: 'shins and training shoes mid tibialis raise', move: 'sat doing tibialis raises' },
  { rx: /glute|hip thrust|hip/i,                      body: 'hips at the top of a hip thrust, bar across the lap', move: 'mid hip thrust on the bench' },
  // round 5 (2026-09-18): "Barbell RDLs" matched nothing and "Hanging leg raises" matched the squat line
  { rx: /rdl|romanian|deadlift|hinge|good morning/i,  body: 'hamstrings and glutes from behind at the bottom of a Romanian deadlift, the bar at the shins', move: 'mid Romanian deadlift, the bar at the shins', noPov: true },
  { rx: /abs|core|plank|crunch|oblique|leg raise|hanging/i, body: 'torso from the neck down, shirt lifted, abs tensed', move: 'mid hanging leg raise' },
  { rx: /squat|quad|leg\b|legs|hamstring|adductor|lunge|split/i, body: 'quads from the waist down at the bottom of a squat', move: 'at the bottom of a squat in the rack' },
  { rx: /bench|chest|press|push.?up|fly|pec/i,        body: 'chest and shoulder from the side mid dumbbell press on the bench', move: 'mid dumbbell press on the flat bench', noPov: true },
  { rx: /shoulder|delt|raise|overhead|lateral/i,      body: 'shoulder and upper arm at the top of a lateral raise', move: 'mid lateral raise with dumbbells' },
  { rx: /tricep|dip|skull|pushdown/i,                 body: 'back of the upper arm mid tricep pushdown, rope in hand', move: 'at the cable mid tricep pushdown' },
  { rx: /neck|trap|shrug/i,                           body: 'neck and traps from behind mid shrug', move: 'mid dumbbell shrug', noPov: true },
  { rx: /deload|rest|sleep|recover/i,                 thing: THINGS[4] },
  { rx: /log|track|write|app|note|phone|number|guess/i, thing: 'A phone propped against a water bottle on a bench showing a notes app, wrist straps beside it' },
  { rx: /food|meal|protein|eat|creatine|supplement|diet|carb|calorie/i, thing: THINGS[0] },
];

/**
 * The anatomy a ranked heading wants, as a scene line. Kept for importers.
 * A heading the table does not know still gets a close-up of what it names.
 */
export function anatomyFor(heading, { fallback = false } = {}) {
  const h = String(heading ?? '').trim();
  const hit = ANATOMY.find((a) => a.rx.test(h));
  if (hit) return hit.thing ? SHOTS.object.frame({ thing: hit.thing }) : SHOTS.crop.frame({ body: hit.body, outfit: OUTFITS[2], room: ROOMS[0] });
  if (!fallback || !h) return null;
  if (h.split(/\s+/).length <= 3) return SHOTS.crop.frame({ body: `${h.toLowerCase()} mid rep`, outfit: OUTFITS[2], room: ROOMS[0] });
  return null;
}

const anatomyOf = (heading) => ANATOMY.find((a) => a.rx.test(String(heading ?? '')));

/* ── wealth: one life, day and night, no face ────────────────────────── */

/**
 * One LIFE per set — the car, the city, the watch — named in two or three
 * frames so the set belongs to one person even though nobody is in it. The
 * reference reuses the same five photos across three posts (sets 02, 03,
 * 12); the possessions are the coherence, not the light.
 */
export const LIVES = [
  { car: 'a matte black Lamborghini', city: 'Dubai', watch: 'a steel Rolex', hoodie: 'a black hoodie' },
  { car: 'a grey Porsche 911', city: 'Miami', watch: 'a black Richard Mille', hoodie: 'a grey hoodie' },
  { car: 'a white Mercedes G-Wagon', city: 'London', watch: 'a gold Rolex', hoodie: 'a navy puffer jacket' },
  { car: 'a dark blue BMW M4', city: 'Monaco', watch: 'an Audemars Piguet', hoodie: 'a black zip-up jacket' },
];

export const BANK = {
  trading: [
    { kind: 'car',       times: ['night', 'dusk', 'day'], scene: (L) => `${L.car} parked on a city street in ${L.city}, shot from low behind the rear quarter on a phone, the owner's shoe in the corner of the frame` },
    { kind: 'behind',    times: ['night', 'dusk', 'day'], scene: (L) => `A man in ${L.hoodie} from behind, hood up, walking away towards ${L.car}, face never visible` },
    { kind: 'interior',  times: ['night', 'dusk'],        scene: (L) => `From the passenger seat: a hand on the steering wheel wearing ${L.watch}, the dash lit, the road ahead through the windscreen, the phone reflected faintly in the glass` },
    { kind: 'desk',      times: ['night', 'dusk', 'day'], scene: () => `A cluttered desk with two monitors of candlestick charts, a laptop, a mug and a charger cable, a chair pushed back, shot from the doorway on a phone` },
    { kind: 'feetup',    times: ['night', 'day'],         scene: () => `Looking down at his own socked feet up on a desk, a laptop with a chart open on his lap, the room behind out of focus` },
    { kind: 'pool',      times: ['day', 'night'],         scene: () => `A hotel pool with palm trees, a few loungers with towels left on them, other guests in the distance, shot on a phone from the edge` },
    { kind: 'penthouse', times: ['day', 'dusk'],          scene: (L) => `A floor-to-ceiling window on a high floor over ${L.city}, a sofa and a coffee cup in the foreground, the phone's reflection in the glass` },
    { kind: 'plane',     times: ['day'],                  scene: () => `A laptop with a chart open on an airline tray table, the window and the wing beside it, a plastic cup of water` },
    { kind: 'lounge',    times: ['night', 'dusk'],        scene: (L) => `A man in ${L.hoodie} lying on a hotel sofa looking at his phone, face hidden by the hood, the room lit by a lamp` },
    { kind: 'boat',      times: ['day'],                  scene: () => `The back of a boat on open water, a jet ski tied alongside, a cooler and a towel on the deck, shot on a phone in hard sun` },
    { kind: 'street',    times: ['day', 'dusk'],          scene: (L) => `A palm-lined waterfront in ${L.city}, people walking, a bike rack, shot on a phone at eye level` },
    { kind: 'garage',    times: ['night'],                scene: (L) => `${L.car} in an underground car park, a pillar and a bin in shot, the flash reflecting off the paint` },
    { kind: 'watch',     times: ['day', 'night'],         scene: (L) => `${L.watch} on a wrist resting on a car door, shot by the owner with the other hand, the street behind` },
    { kind: 'rooftop',   times: ['dusk', 'night'],        scene: (L) => `A rooftop terrace over ${L.city} at night, a glass rail, a drink on the ledge, someone's back at the edge of the frame` },
    { kind: 'petrol',    times: ['night'],                scene: (L) => `${L.car} at a petrol station at night under the canopy lights, a man in ${L.hoodie} half out of frame filling it` },
  ],
  // kept so bankFor() keeps its shape; the gym format is built by shot type below
  fitness: [
    { kind: 'mirror', worlds: ['gym'], scene: SHOTS.mirror.frame({ outfit: OUTFITS[0], room: ROOMS[0] }) },
    { kind: 'arm',    worlds: ['gym'], scene: SHOTS.pov.frame({ body: 'forearm mid curl', outfit: OUTFITS[2] }) },
    { kind: 'back',   worlds: ['gym'], scene: SHOTS.crop.frame({ body: 'back at the cable station', outfit: 'shirtless', room: ROOMS[2] }) },
  ],
  food: [
    { kind: 'plate',      scene: () => `A plate of food on a cluttered kitchen counter, shot standing at a slight angle with the flash on, a fork already in it` },
    { kind: 'containers', scene: () => `Five meal-prep containers in a row on a kitchen table, one lid off, rice and chicken visible, a pack of rice and a roll of foil behind` },
    { kind: 'pan',        scene: () => `Looking down at a pan on the hob with mince browning, a wooden spoon in it, the hob dirty, steam blowing out the highlights` },
    { kind: 'fridge',     scene: () => `An open fridge shelf stacked with meal-prep containers and a carton of eggs, shot with the flash on` },
    { kind: 'board',      scene: () => `A chopping board mid-prep on the counter, chicken thighs and a knife, a phone and a kitchen roll beside it` },
    { kind: 'scale',      scene: () => `A kitchen scale with a bowl of rice on it, the number readable, the counter cluttered around it` },
    { kind: 'cook',       scene: () => `Shot from the kitchen doorway by a flatmate: a man in a t-shirt and shorts at the hob with his back to the camera, the kitchen lived-in` },
    { kind: 'hands',      scene: () => `His own hands spooning rice into a container, shot looking down, the tray of chicken beside it` },
    { kind: 'car',        scene: () => `Eating from a meal-prep container in the driver seat of a parked car, shot looking down at the container and the steering wheel` },
    { kind: 'phone',      scene: () => `A phone on the kitchen counter next to a container, the screen showing a notes list, a spoon beside it` },
    { kind: 'oven',       scene: () => `Two trays of chicken thighs coming out of the oven, oven glove on, shot on a phone, the kitchen light harsh` },
    { kind: 'bag',        scene: () => `A gym bag open on the floor with two containers and a shaker in it, shot looking down` },
  ],
};

/** Map a campaign niche onto a bank. Unknown niches get trading, the broadest. */
export function bankFor(niche) {
  const n = String(niche ?? '').toLowerCase();
  if (/gym|fitness|calisthenic|physique|supplement|creatine|muscle|lifting/.test(n)) return BANK.fitness;
  if (/food|meal|nutrition|kitchen|cook|recipe|diet/.test(n)) return BANK.food;
  return BANK.trading;
}

const hash = (s) => { let h = 7; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) % 100003; return h; };
const pick = (arr, seed) => arr[hash(seed) % arr.length];

/** A seeded shuffle, so a set draws each outfit/room/mistake once before repeating. */
function dealer(arr, seed) {
  const pool = [...arr];
  let n = 0;
  return () => {
    if (!pool.length) pool.push(...arr);
    return pool.splice(hash(`${seed}|${n++}`) % pool.length, 1)[0];
  };
}

/**
 * Choose the world for a set. Deterministic per seed. For the wealth format
 * the world is now a per-frame time (see enforce); this returns the family
 * so callers that read `look` keep working.
 */
export function worldFor(niche, seed = '') {
  const bank = bankFor(niche);
  if (bank === BANK.fitness) return { id: 'life', label: 'his camera roll', look: 'phone' };
  if (bank === BANK.food) return { id: 'kitchen', label: 'his kitchen', look: 'phone' };
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
  if (/window|skyline|city view|penthouse/.test(s)) return 'penthouse';
  if (/monitor|desk|screen|chart/.test(s)) return 'desk';
  if (/boat|yacht|deck|jet ?ski/.test(s)) return 'boat';
  if (/plane|flight|airport|window seat/.test(s)) return 'plane';
  if (/plate|dinner|lunch|bowl/.test(s)) return 'plate';
  if (/container|tupperware|tray/.test(s)) return 'containers';
  if (/fridge/.test(s)) return 'fridge';
  if (/pan|hob|stove|cook/.test(s)) return 'pan';
  return null;
}

/** The shot the model asked for, when it used the vocabulary it was given. */
function shotHint(scene) {
  const m = /^\s*(mirror-dim|mirror|pov|crop|friend|object|outdoors|phone)\b/i.exec(String(scene ?? ''));
  return m ? m[1].toLowerCase() : null;
}

/**
 * Enforce the scene list for one set.
 *
 * @param {string[]} scenes   the model's scene lines, hook first, closer last
 * @param {object} o
 * @param {string} o.niche
 * @param {number} [o.appIndex]   slide index (0-based) that shows the app, or -1
 * @param {string} [o.seed]
 * @param {string[]} [o.headings] ranked headings, so gym frames follow the copy
 * @param {boolean} [o.closerIsOne] the closer is the number-one item (a rep, not a lifestyle beat)
 * @returns {{scenes:string[], world:object, replaced:number[], shots:string[], life?:object}}
 */
export function enforce(scenes, { niche, appIndex = -1, seed = '', headings = [], closerIsOne = false } = {}) {
  const bank = bankFor(niche);
  const world = worldFor(niche, seed);
  const n = scenes.length;

  if (bank === BANK.fitness) return enforceGym(scenes, { appIndex, seed, headings, closerIsOne, world });
  if (bank === BANK.food) return enforceFood(scenes, { appIndex, seed, world });

  /* wealth: one life, a mix of day and night, no repeated kind */
  const life = pick(LIVES, seed + '|life');
  const dealt = dealer(MISTAKES.wealth, seed + '|mis');
  const mistake = (kind) => { for (let k = 0; k < 40; k++) { const m = dealt(); if (!m.on || m.on.includes(kind)) return m.text; } return ''; };
  // at least 40 % daylight: the reference is 37 %, and "always dark" was
  // the owner's complaint. The hook takes the seed's world; the rest deal
  // day and night alternately from a seeded start.
  const dayFirst = hash(seed + '|day') % 2 === 0;
  const times = scenes.map((_, i) => (i === 0 ? world.time : ((i + (dayFirst ? 0 : 1)) % 2 === 0 ? 'day' : pick(['night', 'dusk'], seed + i))));
  const used = new Set();
  const draw = (time, prefer = []) => {
    const ok = bank.filter((b) => b.times.includes(time) && !used.has(b.kind));
    const pool = ok.length ? ok : bank.filter((b) => !used.has(b.kind));
    for (const k of prefer) { const b = pool.find((e) => e.kind === k); if (b) { used.add(b.kind); return b; } }
    const b = pool[hash(seed + '|' + used.size) % pool.length] ?? bank[0];
    used.add(b.kind);
    return b;
  };
  const STRONG = ['car', 'behind', 'petrol', 'garage', 'interior'];
  const r = hash(seed + '|hook') % STRONG.length;
  const hookOrder = [...STRONG.slice(r), ...STRONG.slice(0, r)];
  const shots = [];
  const out = scenes.map((scene, i) => {
    const hint = scene && !DREARY.test(scene) ? kindOf(scene, bank) : null;
    const b = i === 0 ? draw(times[0], hookOrder) : draw(times[i], hint ? [hint] : []);
    shots.push(b.kind);
    const w = WORLDS[times[i] === 'day' ? (hash(seed + i) % 2 ? 'midday' : 'golden') : times[i] === 'dusk' ? 'bluehour' : 'night'];
    return `${b.scene(life)}. ${w.prompt} ${mistake(b.kind)}. ${CAMERA.wealth}`;
  });
  return { scenes: out, world: { ...world, look: 'phone' }, replaced: scenes.map((_, i) => i), shots, life, times };
}

/**
 * The gym set: one person across many days, every frame a different shot
 * type. The anchor (slide 1) is the mirror selfie that carries the face;
 * after that the shot type rotates — crop, pov, friend, mirror-dim, object,
 * outdoors — never the same type twice in a row, each with its own outfit,
 * room and mistake. The frame follows the heading: a heading that names a
 * muscle shows that muscle in that shot type; a lesson or a habit gets a
 * day in his life instead.
 */
function enforceGym(scenes, { appIndex, seed, headings, closerIsOne, world }) {
  const n = scenes.length;
  const outfit = dealer(OUTFITS, seed + '|fit');
  const room = dealer(ROOMS.filter((r) => !/bedroom/.test(r)), seed + '|room');
  const place = dealer(PLACES, seed + '|place');
  const thing = dealer(THINGS, seed + '|thing');
  const dealt = dealer(MISTAKES.gym, seed + '|mis');
  // two mistakes that fit the shot type: draw until they do
  const mistakesFor = (type) => { const got = []; for (let k = 0; k < 40 && got.length < 2; k++) { const m = dealt(); if (m.on.includes(type) && !got.includes(m.text)) got.push(m.text); } return got; };
  // the rotation, measured off the corpus: crops and POVs lead, friend
  // shots and a second (dim) mirror follow; the closer is a lifestyle beat
  const ROTA = ['crop', 'pov', 'friend', 'mirror-dim', 'crop', 'pov', 'friend', 'object', 'crop'];
  const start = hash(seed + '|rota') % 3;
  const shots = [];
  const out = scenes.map((scene, i) => {
    let type, line;
    const heading = i > 0 && i < n - 1 ? headings[i - 1] : null;
    const anat = anatomyOf(heading) ?? anatomyOf(scene);
    const hinted = shotHint(scene);
    if (i === 0) {
      type = 'mirror';
      line = SHOTS.mirror.frame({ outfit: outfit(), room: room(), body: null });
    } else if (i === appIndex) {
      type = 'phone';
      line = SHOTS.phone.frame({ surface: pick(['a black gym bench', 'a granite kitchen counter', 'the rubber gym floor next to a dumbbell', 'a wooden table'], seed + '|surf') });
    } else if (i === n - 1 && !closerIsOne) {
      // set-08 closes on a dim bedroom mirror selfie; an outdoors beat sent as an
      // edit of the gym anchor came back as a gym twice (rounds 5 and 7,
      // 2026-09-18), so the closer is the mirror unless the model asked for outdoors
      if (hinted === 'outdoors') {
        type = 'outdoors';
        const pl = place();
        line = SHOTS.outdoors.frame({ outfit: /beach|boat|pool|water/i.test(pl) ? 'shirtless in swim shorts' : outfit(), place: pl });
      } else {
        type = 'mirror-dim';
        line = SHOTS['mirror-dim'].frame({ outfit: outfit() });
      }
    } else {
      const prev = shots[shots.length - 1];
      type = hinted && hinted !== prev && SHOTS[hinted] ? hinted : ROTA[(start + i) % ROTA.length];
      if (type === prev) type = ROTA[(start + i + 1) % ROTA.length];
      // a heading that names a muscle must show it: the dim mirror and the
      // outdoors beat cannot, so they go to a lesson or a habit instead
      if (anat?.body && /^(mirror-dim|object|outdoors)$/.test(type)) type = prev === 'crop' ? 'pov' : prev === 'pov' ? 'friend' : 'crop';
      // a part seen from behind or from the side (the back, calves, traps, the
      // chest mid press) cannot be a POV of one's own body: round 0 (2026-09-18)
      // asked for "looking down at his own back from behind mid row" and the
      // model drew a thigh. Those parts go to a crop or a friend shot.
      // the mirror variant with the back to the glass was ignored too (round 8
      // slide 7 drew a front selfie for "rows"): a behind part is a crop or a friend shot, full stop
      if (anat?.noPov && (type === 'pov' || type === 'mirror')) type = prev === 'crop' ? 'friend' : 'crop';
      if (anat?.thing) { type = 'object'; line = SHOTS.object.frame({ thing: anat.thing }); }
      else if (type === 'object') line = SHOTS.object.frame({ thing: thing() });
      else if (type === 'friend') line = SHOTS.friend.frame({ move: anat?.move, outfit: outfit(), room: room() });
      else if (type === 'mirror-dim') line = SHOTS['mirror-dim'].frame({ outfit: outfit() });
      else if (type === 'pov') line = SHOTS.pov.frame({ body: anat?.body ?? 'forearm, the phone in the other hand', outfit: outfit() });
      else if (type === 'mirror') line = SHOTS.mirror.frame({ outfit: outfit(), room: room(), body: anat?.body, behind: !!anat?.noPov });
      else line = SHOTS.crop.frame({ body: anat?.body ?? 'arm and shoulder', outfit: outfit(), room: room() });
    }
    shots.push(type);
    const mis = type === 'phone' ? '' : ` ${mistakesFor(type).join(', ')}.`;
    return `${line}${mis} ${CAMERA.gym}`;
  });
  return { scenes: out, world, replaced: out.map((_, i) => i), shots };
}

/** The kitchen set: mostly objects, two frames with the cook in them, never the same kind twice. */
function enforceFood(scenes, { appIndex, seed, world }) {
  const bank = BANK.food;
  const mistake = dealer(MISTAKES.food, seed + '|mis');
  const used = new Set();
  const draw = (prefer = []) => {
    const pool = bank.filter((b) => !used.has(b.kind));
    for (const k of prefer) { const b = pool.find((e) => e.kind === k); if (b) { used.add(b.kind); return b; } }
    const b = pool[hash(seed + '|' + used.size) % pool.length] ?? bank[0];
    used.add(b.kind);
    return b;
  };
  const hookOrder = pick([['containers', 'plate', 'oven'], ['plate', 'containers', 'cook'], ['oven', 'containers', 'plate']], seed + '|hook');
  const shots = [];
  const out = scenes.map((scene, i) => {
    const hint = scene && !DREARY.test(scene) ? kindOf(scene, bank) : null;
    const b = i === 0 ? draw(hookOrder) : i === appIndex ? draw(['phone']) : i === scenes.length - 1 ? draw(['bag', 'car', 'cook']) : draw(hint ? [hint] : []);
    shots.push(b.kind);
    return `${b.scene()}. ${mistake()}. ${CAMERA.food}`;
  });
  return { scenes: out, world, replaced: out.map((_, i) => i), shots };
}

/**
 * The art direction for one set, in one place. lanes.mjs and make-set.mjs
 * both used to work this out inline and had drifted; now they call this.
 *
 * @returns {{scenes, world, look, mode, days, subject, shots, appIndex}}
 */
export function direct({ spec, content, styleId, seed = '', look: wantLook, mode: wantMode }) {
  const bank = bankFor(spec.niche);
  const isGym = bank === BANK.fitness, isFood = bank === BANK.food;
  const phone = styleId === 'feed' || styleId === 'native';
  let scenes = [content.hook?.scene, ...(content.ranked ?? []).map((r) => r.scene), content.closer?.scene]
    .map((sc, i) => sc || `the person, scene ${i + 1}`);
  let appIndex = 1 + (content.ranked ?? []).findIndex((r) => r.showsApp);
  // no ranked slide shows the app but the brief wants it: toRenderable puts
  // the screen on the closer, so the closer's frame is the phone shot
  if (appIndex <= 0 && spec.assets?.app_screen && spec.requirements?.must_show_app) appIndex = scenes.length - 1;
  const ONE = /^\s*(#|no\.?|number)?\s*(1|one)\s*[—–:.\-]\s*/i;
  const closerIsOne = ONE.test(String(content.closer?.lines?.[0] ?? ''));
  let world = null, shots = null, life = null;
  let look = wantLook ?? spec.assets?.look ?? 'phone';
  if (phone) {
    const e = enforce(scenes, { niche: spec.niche, appIndex: appIndex > 0 ? appIndex : -1, seed, headings: (content.ranked ?? []).map((r) => r.name), closerIsOne });
    scenes = e.scenes; world = e.world; shots = e.shots; life = e.life ?? null;
    // the phone formats are never graded: the reference is straight off the
    // camera roll, and the de-slop pass supplies the phone's own artefacts
    if (!wantLook) look = 'phone';
  }
  // the rail style draws the Grow with Alex family: cinematic editorial
  // photographs with no recurring person and no phone-photo pass
  if (styleId === 'rail') {
    return { scenes, world: { id: 'editorial', label: 'editorial', look: 'alex' }, look: wantLook ?? 'alex', mode: 'editorial', days: false, subject: 'none', shots: null, life: null, appIndex: appIndex > 0 ? appIndex : -1, isGym, isFood };
  }
  const mode = wantMode ?? (phone && !isGym ? 'aspirational' : 'subject');
  // one person across many days is the rule for every phone format that
  // holds a subject — the same outfit across a set was rated "too AI"
  const days = phone && mode === 'subject';
  const subject = content.subject && content.subject !== 'none' ? content.subject : 'A lean muscular man in his early twenties, short dark hair, light stubble.';
  return { scenes, world, look, mode, days, subject, shots, life, appIndex: appIndex > 0 ? appIndex : -1, isGym, isFood };
}
