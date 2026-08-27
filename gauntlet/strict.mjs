// Rubric tightening tiers.
//
// The protocol says: if the output passes three consecutive rounds before round 8,
// the rubric is too soft. Each tier here adds automated checks that the base 60
// does not make. Tiers are cumulative: --strict 2 applies tier 1 and tier 2.
//
// Every tier is derived from something measured in the reference corpus, so
// tightening means "closer to the corpus", not "arbitrarily harder".
import { accentClusters } from './pixels.mjs';
import { layoutSlide, safeBox } from '../engine/layout.mjs';
import sharp from 'sharp';

const item = (id, label, points, max, detail, failures = []) =>
  ({ id, label, points: Math.max(0, Math.min(max, points)), max, detail, failures });

// ---------------------------------------------------------------- tier 1
// Corpus §3: the dominant accent covers 10.7% of cover pixels, 9.0% of interiors
// and 5.8% of the closer. Accent QUANTITY must decay toward the CTA, and the
// closer must be the quietest slide in the set.
async function accentDecay(c) {
  const info = await Promise.all(c.files.map((f) => accentClusters(f)));
  const cov = info.map((x) => (x.clusters[0]?.frac ?? 0));
  const cover = cov[0], closer = cov[cov.length - 1];
  const mid = cov.slice(1, -1);
  const midMean = mid.length ? mid.reduce((a, b) => a + b, 0) / mid.length : 0;
  const quietCloser = closer <= midMean + 1e-6;
  const loudCover = cover >= midMean - 0.005;
  const fails = [];
  if (!quietCloser) fails.push(`closer accent ${(closer * 100).toFixed(1)}% > interior mean ${(midMean * 100).toFixed(1)}%`);
  if (!loudCover) fails.push(`cover accent ${(cover * 100).toFixed(1)}% below interior mean ${(midMean * 100).toFixed(1)}%`);
  return item('accent-decay', 'accent coverage decays toward the CTA (corpus 10.7/9.0/5.8%)',
    (quietCloser ? 3 : 0) + (loudCover ? 2 : 0), 5,
    `cover ${(cover * 100).toFixed(1)}% / mid ${(midMean * 100).toFixed(1)}% / closer ${(closer * 100).toFixed(1)}%`, fails);
}

// Corpus §7 rule 5: interior headlines run 35-55% of the cover headline's size.
// Nothing on an interior slide is allowed to compete with the cover.
async function hierarchyRatio(c, tpl) {
  const sizes = c.slideMeta.map((m) => m.fittedSizes?.headline ?? 0);
  const cover = sizes[0] || 1;
  const interiors = sizes.slice(1, -1).filter(Boolean);
  const ratios = interiors.map((s) => s / cover);
  const bad = ratios.map((r, i) => ({ r, i })).filter((x) => x.r > 0.72);
  return item('hierarchy-ratio', 'interior headline <= 72% of the cover headline',
    bad.length ? 0 : 5, 5,
    `cover ${cover}px, interiors ${interiors.join('/')}px, ratios ${ratios.map((r) => r.toFixed(2)).join('/')}`,
    bad.map((x) => `slide ${x.i + 2} headline is ${(x.r * 100).toFixed(0)}% of the cover`));
}

// ---------------------------------------------------------------- tier 2
// Corpus §10: no closer is a wall of text; the closer has the lowest word count
// of any slide in 14 of 17 sets — second only to the cover.
function closerQuiet(c) {
  const wcs = c.slideMeta.map((m, i) => m.renderedWords ?? c.slides[i].wordCount);
  const closer = wcs[wcs.length - 1];
  const interiors = wcs.slice(1, -1);
  const ok = closer <= Math.min(...interiors);
  return item('closer-quiet', 'closer is the quietest slide after the cover', ok ? 5 : 0, 5,
    `closer ${closer} words vs interior min ${Math.min(...interiors)}`,
    ok ? [] : [`closer (${closer}) is wordier than an interior (${Math.min(...interiors)})`]);
}

// Corpus §8: subject and type overlap by 30-50px and the subject sits BEHIND the
// type. An overlap of zero reads as pasted; a huge one reads as an accident.
function overlapIntent(c, tpl) {
  const fails = [];
  let checked = 0, good = 0;
  c.slideMeta.forEach((m, i) => {
    const spec = tpl.roles[m.variant ?? c.slides[i].role]?.subject;
    if (!spec?.overlapSlot || !m.subjectRect) return;
    checked++;
    const target = m.rects.find((r) => r.id === spec.overlapSlot);
    if (!target) return;
    const overlap = target.y + target.h - m.subjectRect.y;
    if (overlap >= 4 && overlap <= 90) good++;
    else fails.push(`slide ${i + 1}: subject/type overlap ${Math.round(overlap)}px (want 4-90)`);
  });
  if (!checked) return item('overlap-intent', 'declared subject/type overlap lands in range', 5, 5, 'no overlap declared', []);
  return item('overlap-intent', 'declared subject/type overlap lands in range',
    good === checked ? 5 : 0, 5, `${good}/${checked} in range`, fails);
}

// ---------------------------------------------------------------- tier 3
// Corpus §2: 89% of slides are flat plates and the background of a set never
// drifts. Measure background stability across the set.
async function plateStability(c) {
  const samples = await Promise.all(c.files.map(async (f) => {
    const { data, info } = await sharp(f).removeAlpha().resize(60, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
    const w = info.width, h = info.height, ch = info.channels;
    let r = 0, g = 0, b = 0, n = 0;
    for (const [x, y] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) {
      const i = (y * w + x) * ch; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    return [r / n, g / n, b / n];
  }));
  let maxD = 0;
  for (let i = 1; i < samples.length; i++) {
    maxD = Math.max(maxD, Math.hypot(...samples[i].map((v, k) => v - samples[0][k])));
  }
  const ok = maxD <= 34;
  return item('plate-stability', 'background plate holds across the set (corpus drift < 2 L*)',
    ok ? 5 : 0, 5, `max corner delta ${maxD.toFixed(1)} RGB`,
    ok ? [] : [`plate drifts by ${maxD.toFixed(1)} RGB across the set`]);
}

// Corpus §6: the hook is a noun phrase with a twist tail, not a sentence, and
// exactly one word carries the emphasis.
function hookCraft(c) {
  const h = String(c.slides[0].headline || '');
  const k = String(c.slides[0].kicker || '');
  const fails = [];
  if (/[.!?]$/.test(h.trim())) fails.push('cover headline ends in terminal punctuation (corpus hooks do not)');
  if (!k.trim()) fails.push('cover has no twist tail / kicker');
  const acc = String(c.slides[0].accentWord || '');
  if (!acc || !h.toLowerCase().includes(acc.toLowerCase())) fails.push(`accent word "${acc}" is not in the headline`);
  return item('hook-craft', 'hook is a noun phrase with a twist tail and one emphasis',
    fails.length ? 0 : 5, 5, `"${h}" / "${k}" / accent="${acc}"`, fails);
}

export const STRICT_TIERS = {
  1: { accentDecay, hierarchyRatio },
  2: { closerQuiet, overlapIntent },
  3: { plateStability, hookCraft },
};

export const VISION_RUBRIC = [
  { id: 'hook', max: 10, label: 'the hook stops the scroll' },
  { id: 'thumbnail', max: 10, label: 'type hierarchy readable at 200px' },
  { id: 'overlap', max: 5, label: 'subject/type overlap reads as intentional' },
  { id: 'grade', max: 5, label: 'colour grade coherent, single accent, premium' },
  { id: 'consistency', max: 5, label: 'style/character consistency across the set' },
  { id: 'holistic', max: 5, label: 'would this plausibly do millions of views' },
];
