// Semantic subject selection.
//
// Picking a cutout by walking the library guarantees variety and guarantees
// irrelevance: a slide reading "hard days hard, easy days easy" got whatever
// index 3 happened to be, which was a man in a business suit. The picture has to
// answer to the slide.
//
// Each library item carries the QUERY that found it ("sprinter running daylight
// full body"); each concept slide carries an `imageIntent` ("exhausted runner,
// low light"). Scoring intent against query text is a real semantic signal and
// costs nothing. It is not as good as a vision check on the actual pixels —
// which is what the brief asks for and what still needs a model — but it is the
// difference between "related" and "arbitrary".

const STOP = new Set([
  'a', 'an', 'the', 'of', 'on', 'in', 'at', 'to', 'for', 'with', 'and', 'or',
  'is', 'are', 'be', 'by', 'from', 'background', 'full', 'body', 'studio',
  'plain', 'isolated', 'white', 'shot', 'photo', 'image', 'person',
]);

/** Crude but effective stemmer: enough to tie "running" to "runner" to "run". */
function stem(w) {
  let s = w.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (s.length <= 3) return s;
  for (const suf of ['ing', 'ers', 'er', 'ed', 'es', 's']) {
    if (s.endsWith(suf) && s.length - suf.length >= 3) return s.slice(0, s.length - suf.length);
  }
  return s;
}

export function tokens(text) {
  return [...new Set(String(text || '')
    .split(/[^A-Za-z0-9]+/)
    .map(stem)
    .filter((w) => w.length > 2 && !STOP.has(w)))];
}

/**
 * Words that mean the same thing across an intent and a stock query. Kept small
 * and niche-agnostic on purpose — a large hand-built ontology is a liability,
 * and the real fix is a vision check rather than a bigger thesaurus.
 */
const SYNONYMS = [
  ['run', 'runner', 'jog', 'sprint', 'sprinter', 'marathon', 'race', 'racing'],
  ['lift', 'lifting', 'weight', 'barbell', 'dumbbell', 'gym', 'strength'],
  ['tire', 'tired', 'exhaust', 'exhausted', 'spent', 'collaps', 'rest', 'resting'],
  ['strong', 'muscular', 'athletic', 'fit', 'physique', 'shredded'],
  ['money', 'cash', 'wealth', 'rich', 'invest', 'trading', 'trader'],
  ['phone', 'smartphone', 'mobile', 'device'],
  ['watch', 'timepiece', 'wrist'],
  ['suit', 'business', 'professional', 'corporate', 'office'],
  ['win', 'winner', 'celebrat', 'victory', 'finish', 'medal'],
];
const SYN_INDEX = new Map();
for (const group of SYNONYMS) {
  const stems = group.map(stem);
  for (const s of stems) SYN_INDEX.set(s, stems);
}
const expand = (t) => new Set(t.flatMap((w) => SYN_INDEX.get(w) || [w]));

/**
 * Score one library item against a slide's image intent.
 * @returns 0..1
 */
export function scoreItem(item, intent) {
  const want = expand(tokens(intent));
  if (!want.size) return 0;
  const have = expand(tokens([item.query, item.credit?.author && '', item.id].filter(Boolean).join(' ')));
  if (!have.size) return 0;
  let hits = 0;
  for (const w of want) if (have.has(w)) hits++;
  return hits / want.size;
}

/**
 * Choose the best-matching unused item for an intent.
 *
 * `used` keeps one carousel from repeating a subject. When nothing matches
 * above `minScore` the caller is told so explicitly (`matched: false`) rather
 * than handed a silent fallback that looks like a choice — an unmatched slide
 * is a real defect and the quality gate needs to be able to see it.
 */
export function pickSubject(items, intent, { used = new Set(), minScore = 0.25, rng = null, topK = 4 } = {}) {
  const pool = items.filter((i) => !used.has(i.id));
  if (!pool.length) return null;

  const ranked = pool
    .map((item) => ({ item, score: scoreItem(item, intent) }))
    .sort((a, b) => b.score - a.score);

  // Argmax over a fixed library is fully deterministic: the same intent returns
  // the same photograph every time, so two carousels built from one concept are
  // illustrated identically. Measured across a 40-carousel spread, EVERY intent
  // resolved to exactly one subject and a single photo appeared 16 times.
  //
  // Sampling from the top K *qualifying* matches keeps the picture relevant
  // while letting the seed choose which relevant picture. K is capped by how
  // many actually clear the bar, so a lone good match is still taken.
  const qualifying = ranked.filter((r) => r.score >= minScore);
  if (qualifying.length) {
    const band = qualifying.slice(0, Math.max(1, topK));
    const pickIdx = rng ? rng.int(band.length) : 0;
    const chosen = band[pickIdx];
    return { item: chosen.item, score: +chosen.score.toFixed(3), matched: true, from: band.length };
  }

  // Nothing matched. Spread the fallback across the library rather than always
  // handing back pool[0], which is what made one subject appear 16 times.
  const idx = rng ? rng.int(pool.length) : 0;
  return { item: pool[idx], score: ranked[0] ? +ranked[0].score.toFixed(3) : 0, matched: false, from: 0 };
}
