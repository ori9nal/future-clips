// Character art for the BEDROCK format: one cel-shaded figure, generated per
// slide doing the exercise that slide teaches, with the working muscles
// tinted the brand's accent.
//
// Consistency comes from the edit endpoint — every pose is generated with the
// same reference figure passed in — and the cutout comes from a colour key,
// because the figure is drawn on a flat cream ground on purpose. A learned
// matting model was tried on this kind of asset before and failed; a corner
// sample and a distance threshold does not.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { generate } from './providers/image.mjs';

/** The figure as the reference sheet drew it. Every pose prompt restates it. */
export const FIGURE = 'flat vector cel-shaded illustration, thick clean black outlines, charcoal grey muscular male figure with hard-edged cel shading, spiky black hair, blank glowing white eyes and no other facial features, plain black shorts, plain black trainers, sticker style, limited flat palette';

/** Floor exercises want a wide frame; everything else a tall one. */
const wide = (pose) => /push.?up|plank|superman|crawl|lying|floor|burpee|sit.?up|crunch|bridge|hollow/i.test(pose);

/**
 * Key a flat-ground render to a transparent cutout, cropped to the figure.
 *
 * @returns {Promise<{file:string, w:number, h:number}>}
 */
export async function cutout(srcFile, outFile, { tol = 60 } = {}) {
  const { data, info } = await sharp(srcFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const at = (x, y) => { const p = (y * W + x) * 3; return [data[p], data[p + 1], data[p + 2]]; };
  const corners = [at(2, 2), at(W - 3, 2), at(2, H - 3), at(W - 3, H - 3)];
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, k) => s + k[c], 0) / corners.length));
  const dist = (p) => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]);

  // bounding box of everything that is not ground
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (dist(at(x, y)) > tol) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0 || y1 <= y0) throw new Error(`cutout: nothing but ground in ${srcFile}`);
  const pad = 6;
  const left = Math.max(0, x0 - pad), top = Math.max(0, y0 - pad);
  const w = Math.min(W - left, x1 - x0 + pad * 2), h = Math.min(H - top, y1 - y0 + pad * 2);

  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = ((top + y) * W + (left + x)) * 3, q = (y * w + x) * 4;
    const d = Math.abs(data[p] - bg[0]) + Math.abs(data[p + 1] - bg[1]) + Math.abs(data[p + 2] - bg[2]);
    const a = d <= tol ? 0 : d >= tol * 2 ? 255 : Math.round(((d - tol) / tol) * 255);
    rgba[q] = data[p]; rgba[q + 1] = data[p + 1]; rgba[q + 2] = data[p + 2]; rgba[q + 3] = a;
  }
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toFile(outFile);
  return { file: outFile, w, h, bg };
}

/**
 * Split a row of figures into separate cutouts by column occupancy — one
 * generation of "four figures in a row" is self-consistent by construction,
 * which four separate generations are not.
 */
export async function cutRow(srcFile, outDir, { tol = 60, expect = 4 } = {}) {
  const { data, info } = await sharp(srcFile).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const at = (x, y) => { const p = (y * W + x) * 3; return [data[p], data[p + 1], data[p + 2]]; };
  const corners = [at(2, 2), at(W - 3, 2), at(2, H - 3), at(W - 3, H - 3)];
  const bg = [0, 1, 2].map((c) => Math.round(corners.reduce((s, k) => s + k[c], 0) / corners.length));
  const dist = (p) => Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]);
  const occupied = new Array(W).fill(false);
  for (let x = 0; x < W; x++) { let n = 0; for (let y = 0; y < H; y += 2) if (dist(at(x, y)) > tol) n++; occupied[x] = n > 3; }
  const runs = []; let start = null;
  for (let x = 0; x < W; x++) {
    if (occupied[x] && start === null) start = x;
    if ((!occupied[x] || x === W - 1) && start !== null) { if (x - start > W * 0.03) runs.push([start, x]); start = null; }
  }
  // figures that touch merge into one run; fall back to equal columns
  const cols = runs.length === expect ? runs : Array.from({ length: expect }, (_, i) => [Math.round((W / expect) * i), Math.round((W / expect) * (i + 1))]);
  fs.mkdirSync(outDir, { recursive: true });
  const out = [];
  for (let i = 0; i < cols.length; i++) {
    const [a, b] = cols[i];
    const part = path.join(outDir, `_col${i}.png`);
    await sharp(srcFile).extract({ left: a, top: 0, width: b - a, height: H }).png().toFile(part);
    out.push(await cutout(part, path.join(outDir, `pose-${i + 1}.png`), { tol }));
  }
  return out;
}

/**
 * One figure doing one thing.
 *
 * @param {object} o
 * @param {string} o.root
 * @param {string} o.cacheDir
 * @param {string} o.refFile     the reference figure (a flat render, not a cutout)
 * @param {string} o.pose        "mid push-up, arms bent"
 * @param {string} [o.muscles]   "chest and triceps" — tinted the accent colour
 * @param {string} [o.accent]    hex, defaults to the BEDROCK red
 * @param {string} [o.quality]
 * @param {string} o.outFile
 */
export async function figure(o) {
  const { root, cacheDir, refFile, pose, muscles, accent = '#E0261B', quality = 'medium', outFile, label = 'figure' } = o;
  // Round one drew the figure twice per frame (a sequence, top and bottom)
  // and skipped the tint on five of seven slides. Both instructions now come
  // first and are stated as counts and colours, not adjectives.
  const tint = muscles
    ? ` MUSCLE HIGHLIGHT, required: colour the ${muscles} a solid flat ${accent} — filled, hard-edged, like an anatomy diagram — while every other part of the body stays charcoal grey.`
    : '';
  const prompt = `EXACTLY ONE figure, a single character, drawn once, nothing repeated. The SAME character as the reference image, ${FIGURE}. ` +
    `Full body in one pose: ${pose}.${tint} ` +
    'Flat solid cream background (#F2EADC) filling the whole image, no shadow on the ground, no text, no labels, no border, no other objects unless the pose names one.';
  const r = await generate({ root, cacheDir, size: wide(pose) ? '1536x1024' : '1024x1536', quality, refs: [refFile], prompt, label });
  const c = await cutout(r.file, outFile);
  return { ...c, usd: r.usd ?? 0, cached: !!r.cached };
}

/**
 * Four figures in one row, cut apart — the progression grid.
 */
export async function figureRow(o) {
  const { root, cacheDir, refFile, poses, muscles, accent = '#E0261B', quality = 'medium', outDir, label = 'row' } = o;
  const tint = muscles ? ` In every figure the ${muscles} are tinted a flat bright red (${accent}) as a muscle highlight.` : '';
  const prompt = `The SAME character as the reference image repeated ${poses.length} times in ONE ROW, evenly spaced, none touching, all the same size and style: ${FIGURE}. ` +
    `Left to right: ${poses.map((p, i) => `(${i + 1}) ${p}`).join('; ')}.${tint} ` +
    'Flat solid cream background (#F2EADC), no shadows, no text, no labels, no borders.';
  const r = await generate({ root, cacheDir, size: '1536x1024', quality, refs: [refFile], prompt, label });
  const parts = await cutRow(r.file, outDir, { expect: poses.length });
  return { parts, usd: r.usd ?? 0, cached: !!r.cached };
}
