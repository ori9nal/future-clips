// Cut a character sheet into individual matted poses.
//
// The sheet is drawn on a flat cream ground, so a colour key is both more exact
// and far cheaper than a learned matting model — and the earlier translucency
// gate exists precisely because learned matting failed on this kind of asset.
// Segmenting on columns of background finds the pose boundaries without needing
// to know how many poses were drawn.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const sheetFile = process.argv[2];
const OUT = path.join(ROOT, 'output/gen/character/poses');
if (!sheetFile || !fs.existsSync(sheetFile)) {
  console.error('usage: cut-character <sheet.png>');
  process.exit(1);
}

const { data, info } = await sharp(sheetFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// The ground colour is whatever the corners agree on.
const at = (x, y) => { const p = (y * W + x) * 3; return [data[p], data[p + 1], data[p + 2]]; };
const corners = [at(2, 2), at(W - 3, 2), at(2, H - 3), at(W - 3, H - 3)];
const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, k) => s + k[c], 0) / corners.length));
const dist = (p) => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]);
const TOL = 60;                       // generous: the ground is flat, the figure is dark

// column occupancy → pose boundaries
const occupied = new Array(W).fill(false);
for (let x = 0; x < W; x++) {
  let n = 0;
  for (let y = 0; y < H; y += 2) if (dist(at(x, y)) > TOL) n++;
  occupied[x] = n > 3;
}
const runs = [];
let start = null;
for (let x = 0; x < W; x++) {
  if (occupied[x] && start === null) start = x;
  if ((!occupied[x] || x === W - 1) && start !== null) {
    if (x - start > W * 0.04) runs.push([start, x]);      // ignore specks
    start = null;
  }
}
console.log(`ground rgb(${bg.join(',')}) · ${runs.length} poses found`);

fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (let i = 0; i < runs.length; i++) {
  const [x0, x1] = runs[i];
  // vertical extent of this pose only
  let y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = x0; x < x1; x++) {
      if (dist(at(x, y)) > TOL) { if (y < y0) y0 = y; if (y > y1) y1 = y; break; }
    }
  }
  const pad = 8;
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
  const w = Math.min(W - left, x1 - x0 + pad * 2), h = Math.min(H - top, y1 - y0 + pad * 2);

  // key the ground to transparent, with a soft edge so the outline is not jagged
  const crop = await sharp(sheetFile).extract({ left, top, width: w, height: h }).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(w * h * 4);
  let opaque = 0, partial = 0;
  for (let p = 0, q = 0; p < crop.data.length; p += 3, q += 4) {
    const d = Math.abs(crop.data[p] - bg[0]) + Math.abs(crop.data[p + 1] - bg[1]) + Math.abs(crop.data[p + 2] - bg[2]);
    const a = d <= TOL ? 0 : d >= TOL * 2 ? 255 : Math.round(((d - TOL) / TOL) * 255);
    rgba[q] = crop.data[p]; rgba[q + 1] = crop.data[p + 1]; rgba[q + 2] = crop.data[p + 2]; rgba[q + 3] = a;
    if (a === 255) opaque++; else if (a > 0) partial++;
  }
  const file = path.join(OUT, `pose-${i + 1}.png`);
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);

  // the same gate the mascot had to pass: mostly-hard edges, or the cutout will
  // show a halo the moment it lands on a coloured ground
  const translucency = partial / Math.max(1, opaque + partial);
  const coverage = (opaque + partial) / (w * h);
  const pass = translucency <= 0.06;
  console.log(`  pose ${i + 1}: ${w}x${h}  translucency ${translucency.toFixed(3)} ${pass ? 'PASS' : 'REJECT'}  coverage ${coverage.toFixed(2)}`);
  made.push({ file, pass });
}

// review strip on a mid grey, which shows halos that a white page hides
const TW = 300, TH = 420, comps = [];
for (let i = 0; i < made.length; i++) {
  comps.push({ input: await sharp(made[i].file).resize(TW - 20, TH - 20, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(), left: i * TW + 10, top: 10 });
}
await sharp({ create: { width: made.length * TW, height: TH, channels: 3, background: '#8a8a8a' } })
  .composite(comps).jpeg({ quality: 90 }).toFile(path.join(OUT, 'poses.jpg'));
console.log('review:', path.join(OUT, 'poses.jpg'));
