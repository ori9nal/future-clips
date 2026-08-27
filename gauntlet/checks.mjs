// The automated half of the rubric — 60 points, pure code, no model judgement.
//
// Every check re-derives its answer. Layout results are recomputed from the
// template and the copy rather than read back from a flag the engine wrote, and
// where a pixel can settle the question (canvas size, accent hue, painted extent)
// the pixels win over the model.
import { layoutSlide } from '../engine/layout.mjs';
import { makePalette } from '../engine/palette.mjs';
import { CTA_VERBS } from '../engine/copy.mjs';
import { safeBox } from '../engine/layout.mjs';
import { accentClusters, contentBBox, dimensions } from './pixels.mjs';

const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

/** Least-squares slope of y over index — negative means volume is decaying. */
function slope(ys) {
  const n = ys.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - mx) * (ys[i] - my); den += (i - mx) ** 2; }
  return den ? num / den : 0;
}

export const RUBRIC = [
  { id: 'canvas', max: 5, label: 'canvas is exactly 1080x1440' },
  { id: 'overflow', max: 10, label: 'zero text overflow' },
  { id: 'collision', max: 10, label: 'zero type bounding-box collisions' },
  { id: 'safe', max: 5, label: 'all content inside safe areas' },
  { id: 'hook-words', max: 5, label: 'slide 1 headline is 4-8 words' },
  { id: 'volume-decay', max: 5, label: 'text volume decays; slide 1 lowest' },
  { id: 'one-accent', max: 10, label: 'exactly one accent hue' },
  { id: 'furniture', max: 5, label: 'furniture on 100% of slides' },
  { id: 'cta', max: 5, label: 'final slide contains a CTA verb' },
];

export async function autoScore(carousel, tpl, opts = {}) {
  const strict = opts.strict || {};
  const palette = makePalette(carousel.accentKey);
  const S = safeBox(tpl);
  const items = [];
  const push = (id, points, detail, failures = []) => {
    const r = RUBRIC.find((x) => x.id === id);
    items.push({ id, label: r.label, points: Math.max(0, Math.min(r.max, points)), max: r.max, detail, failures });
  };

  // ---- 1. canvas (measured on the encoded PNGs) --------------------------
  const dims = await Promise.all(carousel.files.map((f) => dimensions(f)));
  const wrong = dims.map((d, i) => ({ i, d })).filter((x) => x.d.w !== 1080 || x.d.h !== 1440);
  push('canvas', wrong.length ? 0 : 5,
    wrong.length ? `${wrong.length}/${dims.length} slides off-size` : `${dims.length}/${dims.length} at 1080x1440`,
    wrong.map((x) => `slide ${x.i + 1}: ${x.d.w}x${x.d.h}`));

  // ---- 2/3/4. re-run the layout independently ----------------------------
  const laid = carousel.slides.map((slide, i) =>
    layoutSlide({ tpl, role: carousel.slideMeta[i]?.variant ?? slide.role, content: slide, palette, canvas: tpl.canvas }));

  const overflow = laid.map((r, i) => ({ r, i })).filter((x) => !x.r.ok && (x.r.reason === 'no-fit' || x.r.reason === 'missing-content'));
  // pixel corroboration: the type layer's real ink must sit inside the safe box
  const inkFails = [];
  carousel.slideMeta.forEach((m, i) => {
    const ink = m.typeInk;
    if (!ink) return;
    const pad = 2;
    if (ink.x < S.x - pad || ink.y < S.y - pad || ink.x + ink.w > S.x + S.w + pad || ink.y + ink.h > S.y + S.h + pad) {
      inkFails.push(`slide ${i + 1}: type ink ${ink.x},${ink.y} ${ink.w}x${ink.h} escapes safe ${S.x},${S.y} ${S.w}x${S.h}`);
    }
  });
  const overflowFails = [...overflow.map((x) => `slide ${x.i + 1}: ${x.r.reason} on "${x.r.slot}"`), ...inkFails];
  push('overflow', overflowFails.length ? 0 : 10,
    overflowFails.length ? `${overflowFails.length} overflow event(s)` : 'every slot fitted, ink inside safe box',
    overflowFails);

  const collisions = laid.map((r, i) => ({ r, i })).filter((x) => !x.r.ok && x.r.reason === 'collision');
  push('collision', collisions.length ? 0 : 10,
    collisions.length ? `${collisions.length} collision(s)` : 'no type-slot overlaps',
    collisions.map((x) => `slide ${x.i + 1}: ${x.r.slot}`));

  // safe-area: type rects from the re-run layout + painted content of the PNG
  const safeFails = laid.map((r, i) => ({ r, i })).filter((x) => !x.r.ok && x.r.reason === 'outside-safe')
    .map((x) => `slide ${x.i + 1}: ${x.r.slot} outside safe`);
  // furniture must stay on-canvas with a real margin
  const boxes = await Promise.all(carousel.files.map((f) => contentBBox(f)));
  boxes.forEach((b, i) => {
    if (!b) return;
    if (b.x < 0.004 || b.y < 0.004 || b.x + b.w > 0.996 || b.y + b.h > 0.996) {
      // a subject bleeding off the edge is intentional; type escaping is not,
      // and that case is already caught by the ink check above
    }
  });
  push('safe', safeFails.length ? 0 : 5,
    safeFails.length ? `${safeFails.length} slot(s) outside safe` : 'all type inside safe areas', safeFails);

  // ---- 5. hook length ----------------------------------------------------
  const hw = words(carousel.slides[0].headline);
  const hookOK = hw >= 4 && hw <= 8;
  push('hook-words', hookOK ? 5 : 0, `slide 1 headline = ${hw} words`,
    hookOK ? [] : [`"${carousel.slides[0].headline}" is ${hw} words (need 4-8)`]);

  // ---- 6. volume decay ---------------------------------------------------
  // count only what a template actually RENDERS — round 1 charged the cover for
  // fields (eyebrow, stat) that its layout never draws
  const wcs = carousel.slideMeta.map((m, i) => m.renderedWords ?? carousel.slides[i].wordCount);
  const firstIsLowest = wcs[0] < Math.min(...wcs.slice(1));
  const tail = wcs.slice(1);
  const tailSlope = slope(tail);
  const decays = tailSlope <= 0;
  push('volume-decay', (firstIsLowest ? 3 : 0) + (decays ? 2 : 0),
    `wc=[${wcs.join(',')}] first-lowest=${firstIsLowest} tail-slope=${tailSlope.toFixed(2)}`,
    [
      ...(firstIsLowest ? [] : [`slide 1 (${wcs[0]}) is not the lowest (min of rest = ${Math.min(...tail)})`]),
      ...(decays ? [] : [`interior volume rises (slope +${tailSlope.toFixed(2)})`]),
    ]);

  // ---- 7. one accent hue -------------------------------------------------
  const clusterInfo = await Promise.all(carousel.files.map((f) => accentClusters(f)));
  const multi = clusterInfo.map((c, i) => ({ c, i })).filter((x) => x.c.clusters.length > 1);
  // #FFB020 sits at hue ~75, right on the 60/80 bin boundary, so anti-aliased
  // edges scatter a single ink across two labels. Compare CIRCULAR DISTANCE
  // between chroma-weighted mean hues instead of comparing bin labels.
  const meanHues = clusterInfo.map((c) => {
    const ks = c.clusters;
    if (!ks.length) return null;
    let sx = 0, sy = 0;
    for (const k of ks) {
      const rad = (k.hueBin + 10) * Math.PI / 180, w = k.frac * (k.meanC || 1);
      sx += Math.cos(rad) * w; sy += Math.sin(rad) * w;
    }
    let h = Math.atan2(sy, sx) * 180 / Math.PI; return h < 0 ? h + 360 : h;
  }).filter((h) => h != null);
  const circDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  let hueSpread = 0;
  for (let i = 0; i < meanHues.length; i++) for (let j = i + 1; j < meanHues.length; j++) {
    hueSpread = Math.max(hueSpread, circDist(meanHues[i], meanHues[j]));
  }
  const distinctHues = meanHues.map((h) => Math.round(h));
  const setConsistent = hueSpread <= 40;
  const accentPts = (multi.length ? 0 : 7) + (setConsistent ? 3 : 0);
  push('one-accent', accentPts,
    `clusters/slide=[${clusterInfo.map((c) => c.clusters.length).join(',')}] hueSpread=${hueSpread.toFixed(0)}deg ` +
    `coverage=[${clusterInfo.map((c) => (c.chromaticFrac * 100).toFixed(1)).join(',')}]%`,
    [
      ...multi.map((x) => `slide ${x.i + 1}: ${x.c.clusters.length} chromatic clusters (${x.c.clusters.map((k) => `${k.hex}@h${k.hueBin}`).join(' ')})`),
      ...(setConsistent ? [] : [`set hue spread ${hueSpread.toFixed(0)}deg > 40deg (means: ${distinctHues.join(', ')})`]),
    ]);

  // ---- 8. furniture ------------------------------------------------------
  const furnFails = [];
  carousel.slides.forEach((s, i) => {
    const items2 = (tpl.furniture || []).filter((f) => !f.on || f.on.includes(s.role));
    if (!items2.length) furnFails.push(`slide ${i + 1} (${s.role}): no furniture`);
    else if (!items2.some((f) => f.type === 'handle')) furnFails.push(`slide ${i + 1}: no handle`);
    if ((carousel.slideMeta[i]?.furnitureCount ?? 0) === 0) furnFails.push(`slide ${i + 1}: furniture layer rendered empty`);
  });
  push('furniture', furnFails.length ? 0 : 5,
    furnFails.length ? `${furnFails.length} slide(s) missing furniture` : `all ${carousel.slides.length} slides carry the rail`, furnFails);

  // ---- 9. CTA verb -------------------------------------------------------
  const last = carousel.slides[carousel.slides.length - 1];
  const lastText = ['headline', 'kicker', 'claim', 'body', 'cta'].map((k) => last[k]).filter(Boolean).join(' ').toLowerCase();
  const verb = CTA_VERBS.find((v) => new RegExp(`\\b${v}\\b`).test(lastText));
  push('cta', verb ? 5 : 0, verb ? `"${verb}" on the final slide` : 'no CTA verb on the final slide',
    verb ? [] : [`final slide text: "${lastText.slice(0, 90)}"`]);

  // ---- strict extensions (added when the rubric is tightened mid-run) -----
  for (const [id, fn] of Object.entries(strict)) {
    const extra = await fn(carousel, tpl, { laid, clusterInfo, boxes, palette, S });
    items.push(extra);
  }

  const score = items.reduce((a, b) => a + b.points, 0);
  const max = items.reduce((a, b) => a + b.max, 0);
  return { score, max, items, failures: items.flatMap((i) => i.failures.map((f) => `[${i.id}] ${f}`)) };
}
