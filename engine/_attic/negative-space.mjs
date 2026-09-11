// Where can type go on this photograph?
//
// The format is one person, full bleed, teaching text beside them. That only
// works if the type never lands on the body — and the body is in a different
// place in every frame. Eyeballing it is how you end up with a headline across
// someone's face on slide four.
//
// So: score candidate boxes by how empty they actually are. Mean luminance
// alone is not enough, because a box that is 90% black with one bright forearm
// through it scores well and reads terribly. The p95 catches that.
import sharp from 'sharp';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * @param {string|Buffer} img
 * @param {object} o
 * @param {number} o.w   frame width the boxes are expressed in
 * @param {number} o.h   frame height
 * @param {Array}  o.candidates  [{name,x,y,w,h}] in frame units
 * @returns {Promise<Array>} candidates scored, best first
 */
export async function scoreBoxes(img, { w, h, candidates }) {
  const S = 180;                       // score on a small copy; this is a gross measure
  const sh = Math.round((S * h) / w);
  const { data, info } = await sharp(img).resize(S, sh, { fit: 'fill' })
    .greyscale().raw().toBuffer({ resolveWithObject: true });

  const scored = candidates.map((c) => {
    const x0 = clamp(Math.floor((c.x / w) * info.width), 0, info.width - 1);
    const x1 = clamp(Math.ceil(((c.x + c.w) / w) * info.width), x0 + 1, info.width);
    const y0 = clamp(Math.floor((c.y / h) * info.height), 0, info.height - 1);
    const y1 = clamp(Math.ceil(((c.y + c.h) / h) * info.height), y0 + 1, info.height);
    const vals = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) vals.push(data[y * info.width + x]);
    vals.sort((a, b) => a - b);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const p95 = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.95))];
    const p50 = vals[Math.floor(vals.length * 0.5)];
    // a bright streak through an otherwise dark box is worse than a uniformly
    // dim box, so p95 is weighted heavily
    return { ...c, mean: +mean.toFixed(1), p50, p95, score: +(mean + 0.9 * p95).toFixed(1) };
  });

  return scored.sort((a, b) => a.score - b.score);
}

/**
 * Scrim strength for a box, from what is actually behind it. A fixed 40% wash
 * over an already-black corner just makes the frame muddy; over a lit shoulder
 * it is not enough. Returns 0 when the box is dark enough to need nothing.
 */
export function scrimFor(box, { target = 34 } = {}) {
  if (box.p95 <= target) return 0;
  return clamp((box.p95 - target) / 190, 0, 0.72);
}

/**
 * Candidate boxes for a 4:5 frame. Halves alone are too coarse: on a photo whose
 * subject sits centre-right, every half-frame box clips the body, and the
 * genuinely empty region — a band across the top, or a narrower column — is not
 * in the set to be chosen. Thirds and bands are here so the solver has somewhere
 * clean to go.
 */
export function candidatesFor(w, h, m = 46) {
  const halfW = Math.round(w * 0.52) - m;
  const thirdW = Math.round(w * 0.40) - m;
  const fullW = w - m * 2;
  return [
    { name: 'left-top',      x: m,             y: Math.round(h * 0.08), w: halfW,  h: Math.round(h * 0.46) },
    { name: 'right-top',     x: w - m - halfW, y: Math.round(h * 0.08), w: halfW,  h: Math.round(h * 0.46) },
    { name: 'left-bottom',   x: m,             y: Math.round(h * 0.44), w: halfW,  h: Math.round(h * 0.46) },
    { name: 'right-bottom',  x: w - m - halfW, y: Math.round(h * 0.44), w: halfW,  h: Math.round(h * 0.46) },
    { name: 'left-col',      x: m,             y: Math.round(h * 0.08), w: thirdW, h: Math.round(h * 0.60) },
    { name: 'right-col',     x: w - m - thirdW, y: Math.round(h * 0.08), w: thirdW, h: Math.round(h * 0.60) },
    { name: 'top-band',      x: m,             y: Math.round(h * 0.06), w: fullW,  h: Math.round(h * 0.34) },
    { name: 'bottom-band',   x: m,             y: Math.round(h * 0.56), w: fullW,  h: Math.round(h * 0.34) },
  ];
}
