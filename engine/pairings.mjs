// Font pairings.
//
// The rule comes straight off the reference set: ONE LOUD FONT, ONE QUIET ONE.
// The loud face carries the claim, the quiet face carries everything else, and
// the contrast between them is the design — which is why a single house font
// used on every set makes every set look the same no matter how good it is.
//
// So a pairing is picked per SET, not per project. Within a set it is locked,
// because a carousel that changes typeface between slides reads as broken
// rather than varied. Across sets it rotates, and the rotation remembers what
// it has already used so two consecutive jobs never land on the same pair.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

/**
 * Each pairing names faces by kit key. `mood` is what makes the pick
 * meaningful rather than random — a finance brief and a streetwear brief should
 * not draw from the same shelf.
 */
export const PAIRINGS = [
  { id: 'switzer',    loud: 'sansBlack',      quiet: 'scriptItalic',   body: 'sans',        moods: ['bold', 'lifestyle', 'creator'],   note: 'Heavy grotesque under a handwritten aside — the reference cover.' },
  { id: 'vanguard',   loud: 'displayCond',    quiet: 'serifDisplay',   body: 'sansMed',     moods: ['bold', 'sport', 'fitness'],       note: 'Condensed black shouting under a quiet display serif.' },
  { id: 'times',      loud: 'serifDisplayIt', quiet: 'grotesk',        body: 'sans',        moods: ['editorial', 'fashion', 'mindset'],note: 'Huge italic serif against a plain grotesque.' },
  { id: 'epic',       loud: 'sansBlack',      quiet: 'sansMed',        body: 'sans',        moods: ['clean', 'tech', 'finance'],       note: 'One family, two weights. The safest pair there is.' },
  { id: 'balboa',     loud: 'anton',          quiet: 'script',         body: 'sansMed',     moods: ['bold', 'travel', 'lifestyle'],    note: 'Tall condensed caps with a casual hand above.' },
  { id: 'stix',       loud: 'serifFat',       quiet: 'groteskMed',     body: 'sans',        moods: ['editorial', 'luxury', 'beauty'],  note: 'Fat didone over a technical sans.' },
  { id: 'unbound',    loud: 'unbounded',      quiet: 'mono',           body: 'sansMed',     moods: ['tech', 'crypto', 'gaming'],       note: 'Wide geometric display with a mono aside.' },
  { id: 'syne',       loud: 'syne',           quiet: 'groteskMed',     body: 'sans',        moods: ['creator', 'design', 'agency'],    note: 'Quirky extra-bold with a neutral partner.' },
  { id: 'oswald',     loud: 'oswald',         quiet: 'bookSerif',      body: 'sansMed',     moods: ['sport', 'news', 'fitness'],       note: 'Newsstand condensed over a book serif.' },
  { id: 'fraunces',   loud: 'frauncesBlack',  quiet: 'groteskMed',     body: 'sans',        moods: ['editorial', 'food', 'wellness'],  note: 'Warm high-contrast serif, soft and loud at once.' },
  { id: 'garamond',   loud: 'playfairBlack',  quiet: 'garamondIt',     body: 'bookSerif',   moods: ['luxury', 'beauty', 'wellness'],   note: 'Display didone with an old-style italic.' },
  { id: 'manrope',    loud: 'manrope',        quiet: 'monoMed',        body: 'sansMed',     moods: ['clean', 'finance', 'saas'],       note: 'Rounded geometric with a mono caption rail.' },
  { id: 'bebas',      loud: 'bebas',          quiet: 'bookSerifIt',    body: 'sansMed',     moods: ['sport', 'street', 'fitness'],     note: 'Poster condensed with a literary italic.' },
  { id: 'abril',      loud: 'abril',          quiet: 'grotesk',        body: 'sans',        moods: ['fashion', 'beauty', 'editorial'], note: 'Fat display serif, magazine cover energy.' },
  // The phone-photo formats (feed, native) are not a pairing at all: every
  // reference set in Carousel examples/reference-2026-09 is typed in the
  // platform's own caption face — TikTok "Classic" (a Proxima Nova cut),
  // one weight, sentence case. Figtree is the closest open face. This entry
  // exists so a brand can still pin something else with assets.pairing, and
  // so the rotation history never records it (see pickPairing `record`).
  { id: 'phone',      loud: 'phoneSemi',      quiet: 'phoneSemi',      body: 'phoneSemi',   moods: ['phone', 'creator', 'fitness', 'trading'], note: 'The platform caption face. One weight, sentence case, thin outline.' },
];

/** Kit keys the pairings reference, mapped to real files. Merged into FACES. */
export const PAIRING_FACES = {
  sansBlack:      { file: 'ArchivoBlack-Regular',       family: 'Archivo Black',          weight: 400 },
  displayCond:    { file: 'ArchivoCondensed-Black',     family: 'Archivo ExtraCondensed', weight: 900 },
  anton:          { file: 'Anton-Regular',              family: 'Anton',                  weight: 400 },
  bebas:          { file: 'BebasNeue-Regular',          family: 'Bebas Neue',             weight: 400 },
  oswald:         { file: 'Oswald-Bold',                family: 'Oswald',                 weight: 700 },
  syne:           { file: 'Syne-ExtraBold',             family: 'Syne',                   weight: 800 },
  unbounded:      { file: 'Unbounded-Black',            family: 'Unbounded',              weight: 900 },
  abril:          { file: 'AbrilFatface-Regular',       family: 'Abril Fatface',          weight: 400 },
  serifFat:       { file: 'DMSerifDisplay-Regular',     family: 'DM Serif Display',       weight: 400 },
  serifDisplay:   { file: 'DMSerifDisplay-Regular',     family: 'DM Serif Display',       weight: 400 },
  serifDisplayIt: { file: 'DMSerifDisplay-Italic',      family: 'DM Serif Display',       weight: 400, style: 'italic' },
  frauncesBlack:  { file: 'Fraunces-Black',             family: 'Fraunces',               weight: 900 },
  frauncesIt:     { file: 'Fraunces-BlackItalic',       family: 'Fraunces',               weight: 900, style: 'italic' },
  playfairBlack:  { file: 'PlayfairDisplay-Black',      family: 'Playfair Display',       weight: 900 },
  manrope:        { file: 'Manrope-ExtraBold',          family: 'Manrope',                weight: 800 },
  manropeMed:     { file: 'Manrope-Medium',             family: 'Manrope',                weight: 500 },
  grotesk:        { file: 'SpaceGrotesk-Bold',          family: 'Space Grotesk',          weight: 700 },
  groteskMed:     { file: 'SpaceGrotesk-Medium',        family: 'Space Grotesk',          weight: 500 },
  outfitBlack:    { file: 'Outfit-Black',               family: 'Outfit',                 weight: 900 },
  outfitMed:      { file: 'Outfit-Medium',              family: 'Outfit',                 weight: 500 },
  bookSerif:      { file: 'LibreBaskerville-Regular',   family: 'Libre Baskerville',      weight: 400 },
  bookSerifIt:    { file: 'LibreBaskerville-Italic',    family: 'Libre Baskerville',      weight: 400, style: 'italic' },
  garamondIt:     { file: 'CormorantGaramond-Italic',   family: 'Cormorant Garamond',     weight: 400, style: 'italic' },
  script:         { file: 'Caveat-Bold',                family: 'Caveat',                 weight: 700 },
  scriptItalic:   { file: 'Caveat-Bold',                family: 'Caveat',                 weight: 700 },
  familjen:       { file: 'FamiljenGrotesk-Bold',       family: 'Familjen Grotesk',       weight: 700 },
  // the phone caption faces — see the `phone` pairing
  phoneMed:       { file: 'Figtree-Medium',             family: 'Figtree',                weight: 500 },
  phoneSemi:      { file: 'Figtree-SemiBold',           family: 'Figtree',                weight: 600 },
  phoneBold:      { file: 'Figtree-Bold',               family: 'Figtree',                weight: 700 },
  phoneAlt:       { file: 'Inter-SemiBold',             family: 'Inter',                  weight: 600 },
};

const STATE = 'gen/pairing-history.json';

/**
 * Where the rotation state lives: output/ on a laptop, /tmp/fc on a host whose
 * checkout is read-only (the same base lib/engine.ts workDirs() uses).
 */
function stateFile(root) {
  const base = process.env.VERCEL ? path.join(os.tmpdir(), 'fc') : path.join(root, 'output');
  return path.join(base, STATE);
}

function history(root) {
  const f = stateFile(root);
  if (!fs.existsSync(f)) return [];
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; }
}

/** Best effort: a rotation record must never fail a render (read-only disk, full disk). */
function remember(root, id) {
  try {
    const f = stateFile(root);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    const h = [id, ...history(root).filter((x) => x !== id)].slice(0, 8);
    fs.writeFileSync(f, JSON.stringify(h));
  } catch { /* the next set rotates from an empty history; nothing else changes */ }
}

/**
 * Pick a pairing for a set.
 *
 * Deterministic given the same seed, so a re-render of the same set is stable —
 * but biased away from whatever the last few sets used, so consecutive jobs in
 * the same niche do not all come out looking like one another.
 *
 * @param {object} o
 * @param {string} o.root
 * @param {string} [o.seed]   usually the campaign or set id
 * @param {string[]} [o.moods]
 * @param {string} [o.force]  pin a pairing by id (a brand with a house style)
 */
export function pickPairing({ root, seed = '', moods = [], force, record = true, allow = () => true }) {
  if (force) {
    const p = PAIRINGS.find((x) => x.id === force);
    if (!p) throw new Error(`unknown pairing "${force}" — have: ${PAIRINGS.map((x) => x.id).join(', ')}`);
    if (record) remember(root, p.id);
    return p;
  }
  const recent = history(root);
  const wanted = moods.map((m) => String(m).toLowerCase());

  // `phone` is only ever pinned (feed/native ask for it by name); it never
  // enters the rotation, so the designed styles keep their shelf
  const scored = PAIRINGS.filter((p) => p.id !== 'phone').filter(allow).map((p) => {
    let score = 0;
    if (wanted.length && p.moods.some((m) => wanted.includes(m))) score += 100;
    // the more recently a pairing was used, the harder it is pushed down —
    // and so is any pairing that shares its LOUD face, because "switzer"
    // after "epic" is Archivo Black after Archivo Black to the viewer
    const age = recent.indexOf(p.id);
    if (age >= 0) score -= (recent.length - age) * 30;
    const faceAge = recent.findIndex((id) => PAIRINGS.find((x) => x.id === id)?.loud === p.loud);
    if (faceAge >= 0 && faceAge !== age) score -= (recent.length - faceAge) * 24;
    // a stable per-seed jitter, so the pick varies between sets without being
    // random from run to run
    const h = crypto.createHash('sha256').update(`${seed}:${p.id}`).digest();
    score += h[0] / 255 * 20;
    return { p, score };
  }).sort((a, b) => b.score - a.score);

  const chosen = scored[0].p;
  if (record) remember(root, chosen.id);
  return chosen;
}

export const listPairings = () => PAIRINGS.map(({ id, loud, quiet, moods, note }) => ({ id, loud, quiet, moods, note }));
