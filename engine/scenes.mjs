// Scene enforcement for the feed format.
//
// Telling the model "aspirational, not dreary" worked in one gauntlet round
// and failed in the next — same code, same brief. The brief's own guidance
// ("blown accounts, struggle to progress") pulls the writer toward rain on a
// bus window, and an advisory line in the prompt loses to it often enough that
// the imagery cannot be left to chance.
//
// So scenes are validated in code. A scene that reads as dreary, or that
// repeats a kind already used in the set, is replaced from a bank of scenes
// that are known to render the way the reference sets look. The model still
// writes the copy; it no longer gets to decide whether the picture is a
// Porsche or a train seat.

/** Words that mean the frame will be grey, sad, or indoors-in-a-bad-way. */
const DREARY = /\b(rain|raining|wet window|bus|train|tram|subway|bedroom|bed\b|caf[eé]|coffee shop|office|cubicle|sad|alone|lonely|tired|crying|hand over|head in hands|dim room|grey|gray|overcast|drizzle|commute|waiting room|hallway|corridor|stairwell)\b/i;

/**
 * Scene bank per niche. Each entry has a `kind` so a set never draws two of
 * the same kind, and a fully written scene line that has been seen to render
 * well — these are not templates, they are the actual prompts.
 */
export const BANK = {
  trading: [
    { kind: 'car', scene: 'A dark supercar parked on a wet city street at night, tail lights reflecting in the road, shot from low and behind, buildings glowing softly in the background.' },
    { kind: 'pool', scene: 'A hotel infinity pool at night lit turquoise from underwater, tall palm trees around it, a dark sky, a single lounger in the foreground.' },
    { kind: 'penthouse', scene: 'A floor-to-ceiling window on a high floor at golden hour, a dense city stretching to the horizon, warm light falling across a bare wooden floor.' },
    { kind: 'desk', scene: 'A trading desk at night with three monitors showing candlestick charts glowing in a dark room, a mechanical keyboard, a glass of water, no one at the desk.' },
    { kind: 'yacht', scene: 'The bow of a yacht cutting through calm dark blue water at dusk, coastline lights in the distance, teak deck in the foreground.' },
    { kind: 'cabin', scene: 'A first-class airline window seat at cruising altitude, soft cabin light, clouds glowing orange below the wing.' },
    { kind: 'interior', scene: 'The interior of a luxury car at night from the driver seat, dashboard lights glowing, city lights blurred through the windscreen.' },
    { kind: 'rooftop', scene: 'A rooftop terrace at blue hour above a city, glass balustrade, the skyline lit up, a single chair.' },
    { kind: 'watch', scene: 'A steel watch and a phone resting on a dark marble table by a window, late afternoon light, shallow depth of field.' },
    { kind: 'palms', scene: 'A palm-lined waterfront path at sunset, warm orange sky, a city skyline far across the water, the path empty.' },
    { kind: 'lobby', scene: 'A marble hotel lobby at night, warm downlights, a long empty corridor of polished stone, one plant.' },
    { kind: 'garage', scene: 'A clean underground garage with one dark sports car under a single downlight, concrete floor, everything else in shadow.' },
  ],
  fitness: [
    { kind: 'mirror', scene: 'A gym mirror selfie framing, phone held at chest height, dark gym behind with red accent lighting, the phone screen glowing.' },
    { kind: 'arm', scene: 'A close-up of a forearm and bicep mid-curl holding a dumbbell, veins visible, dark gym background out of focus.' },
    { kind: 'back', scene: 'A shirtless back from behind at the cable station, lats flared, gym lighting from above, no face visible.' },
    { kind: 'rack', scene: 'A loaded barbell on a squat rack in an empty gym, chalk on the bar, warm overhead light, rubber floor.' },
    { kind: 'bench', scene: 'A flat bench and a pair of dumbbells on the floor of a dark gym, one spotlight, everything else in shadow.' },
    { kind: 'cable', scene: 'A close-up of a hand gripping a cable attachment, forearm tense, the weight stack blurred behind.' },
    { kind: 'locker', scene: 'A gym locker room bench with a shaker bottle, a towel and headphones, cool light, nobody in frame.' },
    { kind: 'abs', scene: 'A torso from the neck down in a gym mirror, abs visible, grey shorts, phone held low, no face.' },
    { kind: 'dawn', scene: 'An empty gym floor at dawn, light coming through high windows onto rows of dumbbells.' },
    { kind: 'meal', scene: 'A meal prep container with chicken, rice and broccoli held in one hand, kitchen counter behind, overhead light.' },
    { kind: 'shoes', scene: 'Training shoes on a rubber gym floor from above, a dumbbell beside them, dramatic side light.' },
    { kind: 'sled', scene: 'A weighted sled on turf in an empty gym, chalk dust in the air, hard light from one side.' },
  ],
};

/** Map a campaign niche onto a bank. Unknown niches get trading, the broadest. */
export function bankFor(niche) {
  const n = String(niche ?? '').toLowerCase();
  if (/gym|fitness|calisthenic|physique|supplement|nutrition|health/.test(n)) return BANK.fitness;
  return BANK.trading;
}

/** The `kind` a free-text scene most resembles, or null. */
function kindOf(scene, bank) {
  const s = String(scene).toLowerCase();
  for (const b of bank) {
    const key = b.kind;
    if (s.includes(key)) return key;
  }
  if (/car|porsche|ferrari|lamborghini|supercar/.test(s)) return 'car';
  if (/pool/.test(s)) return 'pool';
  if (/window|skyline|city/.test(s)) return 'penthouse';
  if (/monitor|desk|screen|chart/.test(s)) return 'desk';
  if (/boat|yacht|deck|water/.test(s)) return 'yacht';
  return null;
}

/**
 * Enforce the scene list.
 *
 * Every scene the model wrote is kept if it is not dreary and its kind has
 * not already been used; otherwise it is replaced from the bank, again with
 * no repeated kind. The app slide is skipped — it renders an icon or a screen.
 *
 * @returns {{scenes:string[], replaced:number[]}}
 */
export function enforce(scenes, { niche, appIndex = -1, seed = '' } = {}) {
  const bank = bankFor(niche);
  const usedKinds = new Set();
  const replaced = [];

  // a stable starting offset per set, so two sets from one campaign do not
  // open on the same bank entry
  let cursor = 0;
  for (let i = 0; i < String(seed).length; i++) cursor = (cursor * 31 + seed.charCodeAt(i)) % bank.length;

  const out = scenes.map((scene, i) => {
    // The app slide is NOT skipped. With icon-on-pill it still shows a full
    // lifestyle frame behind the icon, and leaving its scene unenforced put a
    // bus window behind the TradeLens icon on round seven.
    // The hook is the frame that decides whether anyone swipes. It always
    // comes from the bank, and from the strongest kinds — a car or a skyline —
    // rather than whatever the model happened to write. Round five kept a
    // rain-on-a-bus-window hook because it contained no banned word.
    if (i === 0) {
      const strong = bank.filter((b) => ['car', 'penthouse', 'garage', 'mirror', 'back'].includes(b.kind));
      const pick = strong.length ? strong[cursor % strong.length] : bank[cursor % bank.length];
      usedKinds.add(pick.kind);
      cursor = (cursor + 1) % bank.length;
      replaced.push(0);
      return pick.scene;
    }
    const k = kindOf(scene, bank);
    const ok = scene && !DREARY.test(scene) && k && !usedKinds.has(k);
    if (ok) { usedKinds.add(k); return scene; }
    // walk the bank from the cursor for the next unused kind
    for (let step = 0; step < bank.length; step++) {
      const b = bank[(cursor + step) % bank.length];
      if (!usedKinds.has(b.kind)) {
        usedKinds.add(b.kind);
        cursor = (cursor + step + 1) % bank.length;
        replaced.push(i);
        return b.scene;
      }
    }
    return scene;
  });
  return { scenes: out, replaced };
}
