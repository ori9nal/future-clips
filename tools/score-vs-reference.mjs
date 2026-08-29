// Score our output against a reference set on the axes that actually separate
// them. Deliberately harsh: every measure is normalised against the REFERENCE's
// own value, so the reference scores ~10 by construction and we score whatever
// we honestly are. There is no curve.
//
//   node tools/score-vs-reference.mjs <ourDir> [--ref reference/growithalex]
//
// What it cannot see: whether the photograph is of the right thing. That needs
// a vision model, and it is the largest remaining gap.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { rgbToLab, CHROMA_MIN } from '../gauntlet/pixels.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const OURS = process.argv[2] || 'output/depth';
const REF = arg('--ref', 'reference/growithalex');

const IMG = /\.(jpe?g|png|webp)$/i;
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

async function raw(file, width = 300) {
  const { data, info } = await sharp(file).resize(width, null, { fit: 'inside' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, ch: info.channels };
}

/**
 * Everything measurable about one slide that bears on "does this look designed".
 */
async function measure(file) {
  const { data, W, H, ch } = await raw(file);
  const n = W * H;

  // --- tone -----------------------------------------------------------------
  const L = new Float64Array(n);
  let chroma = 0, satSum = 0;
  const hues = new Map();
  for (let i = 0; i < n; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
    L[i] = lum(r, g, b);
    satSum += Math.max(r, g, b) - Math.min(r, g, b);
    const [, A, B] = rgbToLab(r, g, b);
    const C = Math.hypot(A, B);
    if (C >= CHROMA_MIN) {
      chroma++;
      const h = Math.floor((((Math.atan2(B, A) * 180) / Math.PI + 360) % 360) / 30);
      hues.set(h, (hues.get(h) || 0) + 1);
    }
  }
  const sorted = Float64Array.from(L).sort();
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  const tonalRange = q(0.97) - q(0.03);

  // --- edge density: a proxy for visual incident (layers, texture, detail) ---
  let edge = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (Math.abs(-4 * L[i] + L[i - 1] + L[i + 1] + L[i - W] + L[i + W]) > 40) edge++;
    }
  }

  // --- type scale: heights of ink bands ------------------------------------
  // Bands are contiguous rows carrying ink. The tallest is the display, the
  // shortest a caption or rail. Their ratio is the scale contrast that makes a
  // layout read as designed rather than as a form.
  const dark = q(0.35) < 128;
  const isInk = (v) => (dark ? v > 190 : v < 110);
  const bands = [];
  let start = -1;
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x++) if (isInk(L[y * W + x])) c++;
    const frac = c / W;
    const on = frac > 0.015 && frac < 0.78;
    if (on && start < 0) start = y;
    if ((!on || y === H - 1) && start >= 0) {
      if (y - start >= 2) bands.push(y - start);
      start = -1;
    }
  }
  bands.sort((a, b) => b - a);
  const scaleRatio = bands.length >= 2 ? bands[0] / bands[bands.length - 1] : 1;
  const displayPct = bands.length ? (100 * bands[0]) / H : 0;

  return {
    file: path.basename(file),
    chromaPct: +((100 * chroma) / n).toFixed(2),
    hueClusters: [...hues.values()].filter((v) => v / n >= 0.008).length,
    saturation: +(satSum / n).toFixed(1),
    tonalRange: +tonalRange.toFixed(1),
    edgePct: +((100 * edge) / n).toFixed(2),
    scaleRatio: +scaleRatio.toFixed(2),
    displayPct: +displayPct.toFixed(1),
    bands: bands.length,
    // thumbprint for set-variety
    _thumb: await sharp(file).resize(24, 30, { fit: 'fill' }).greyscale().raw().toBuffer(),
  };
}

/** Mean pairwise difference between slides — how varied a SET is. */
function setVariety(rows) {
  if (rows.length < 2) return 0;
  let sum = 0, k = 0;
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]._thumb, b = rows[j]._thumb;
      let d = 0;
      for (let p = 0; p < a.length; p++) d += Math.abs(a[p] - b[p]);
      sum += d / a.length; k++;
    }
  }
  return +(sum / k).toFixed(1);
}

async function scoreDir(dir) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (IMG.test(e.name) && !/SHEET|SET|SPREAD|COVERS/i.test(e.name)) files.push(p);
    }
  };
  walk(dir);
  if (!files.length) throw new Error(`no images under ${dir}`);
  const rows = [];
  for (const f of files) rows.push(await measure(f));
  const mean = (k) => +(rows.reduce((s, r) => s + r[k], 0) / rows.length).toFixed(2);
  return {
    dir, n: rows.length,
    scaleRatio: mean('scaleRatio'),
    displayPct: mean('displayPct'),
    chromaPct: mean('chromaPct'),
    saturation: mean('saturation'),
    tonalRange: mean('tonalRange'),
    edgePct: mean('edgePct'),
    hueClusters: mean('hueClusters'),
    variety: setVariety(rows),
    rows,
  };
}

const AXES = [
  ['scaleRatio', 'type scale contrast (biggest ink band ÷ smallest)'],
  ['displayPct', 'display type as % of frame height'],
  ['saturation', 'colour saturation'],
  ['tonalRange', 'tonal range (p97 − p03)'],
  ['edgePct', 'visual incident / detail density'],
  ['variety', 'variety across the set'],
];

const ref = await scoreDir(REF);
const ours = await scoreDir(OURS);

console.log(`REFERENCE  ${ref.dir}  (${ref.n} slides)`);
console.log(`OURS       ${ours.dir}  (${ours.n} slides)\n`);
console.log('axis'.padEnd(46) + 'ref'.padStart(9) + 'ours'.padStart(9) + '   score');
console.log('-'.repeat(76));

let total = 0;
for (const [k, label] of AXES) {
  const r = ref[k], o = ours[k];
  // harsh: no credit for exceeding, full penalty for falling short
  const ratio = r === 0 ? 1 : Math.min(o / r, 1);
  const score = +(ratio * 10).toFixed(1);
  total += score;
  const bar = '#'.repeat(Math.round(score)) + '.'.repeat(10 - Math.round(score));
  console.log(label.padEnd(46) + String(r).padStart(9) + String(o).padStart(9) + `   ${String(score).padStart(4)}/10 ${bar}`);
}
const avg = +(total / AXES.length).toFixed(1);
console.log('-'.repeat(76));
console.log(`MEASURED TOTAL${String(avg).padStart(56)}/10`);
console.log(`
NOT MEASURED — and each is worth more than everything above:
  · is the photograph OF the right thing        (needs a vision model)
  · is the idea any good                        (needs the idea engine)
  · does the set read as one art direction      (needs a human or a judge model)
A high measured score with a wrong subject is still a bad carousel.`);
