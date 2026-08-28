// Matting: photograph -> cutout PNG with clean alpha.
//
// This is the most expensive operation in the whole pipeline (~7.5s of CPU on
// the bundled ONNX model), and it is also the most reusable: one source frame
// becomes a subject that dozens of carousels share. It is therefore cached hard
// by source hash. A cache hit costs a file read.
//
// The result feeds engine/compose.mjs `prepareSubject` unchanged — that path
// already trims, scales, grades, anchors, bleeds and reports its placed rect.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { keyFor, memo, readJson, writeJson, sha } from './cache.mjs';

const run = promisify(execFile);
const WORKER = fileURLToPath(new URL('./matte-worker.mjs', import.meta.url));

/**
 * Matte in a child process. The ONNX runtime and libvips cannot share a
 * process on Windows (see matte-worker.mjs), and matting only ever runs on a
 * cache miss, so ~100ms of spawn against ~7500ms of inference is free.
 */
async function matteViaWorker(bytes, ext) {
  const tmp = path.join(os.tmpdir(), 'carousel-matte');
  fs.mkdirSync(tmp, { recursive: true });
  const stem = sha(bytes).slice(0, 16);
  const inFile = path.join(tmp, `${stem}.${ext}`);
  const outFile = path.join(tmp, `${stem}.png`);
  fs.writeFileSync(inFile, bytes);
  try {
    await run(process.execPath, [WORKER, inFile, outFile], { maxBuffer: 1 << 26 });
    if (!fs.existsSync(outFile)) throw new Error('matte worker produced no output');
    return fs.readFileSync(outFile);
  } finally {
    for (const f of [inFile, outFile]) { try { fs.unlinkSync(f); } catch {} }
  }
}

/**
 * Foreground statistics on the matted PNG — "did we actually cut out a subject".
 * A matte that keeps 2% of the frame found nothing; one that keeps 96% failed to
 * separate and would composite as a rectangle.
 */
export async function alphaStats(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, n = W * H;
  let fg = 0, soft = 0, minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const a = data[(y * W + x) * 4 + 3];
      if (a > 16) {
        fg++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      if (a > 16 && a < 239) soft++;
    }
  }
  if (maxX < 0) return { coverage: 0, edgeSoftness: 0, bbox: null, w: W, h: H };
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  return {
    coverage: +(fg / n).toFixed(4),
    // fraction of foreground pixels that are partial — real hair/edges produce
    // some; a hard binary mask produces almost none and composites like a sticker
    edgeSoftness: +(soft / Math.max(1, fg)).toFixed(4),
    bbox: { x: minX, y: minY, w: bw, h: bh },
    fill: +(fg / (bw * bh)).toFixed(4), // how solid the subject is inside its bbox
    aspect: +(bw / bh).toFixed(3),
    w: W, h: H,
  };
}

export const CUTOUT_LIMITS = {
  coverage: [0.04, 0.82],  // found something, but did not keep the whole frame
  fill: [0.14, 0.97],      // not a rectangle, not a speck
};

export function judgeCutout(s) {
  const fail = [];
  if (!s.bbox) return { pass: false, fail: ['matte is empty — no subject found'] };
  const [c0, c1] = CUTOUT_LIMITS.coverage, [f0, f1] = CUTOUT_LIMITS.fill;
  if (s.coverage < c0) fail.push(`coverage ${s.coverage} < ${c0} (nothing found)`);
  if (s.coverage > c1) fail.push(`coverage ${s.coverage} > ${c1} (kept the whole frame)`);
  if (s.fill < f0) fail.push(`fill ${s.fill} < ${f0} (scattered fragments, not one subject)`);
  if (s.fill > f1) fail.push(`fill ${s.fill} > ${f1} (matte is a rectangle)`);
  return { pass: fail.length === 0, fail };
}

/**
 * Matte an image, cached by source bytes.
 * @returns {{ buf:Buffer, stats:object, verdict:object, hit:boolean, ms:number }}
 */
export async function cutout(file, opts = {}) {
  const bytes = Buffer.isBuffer(file) ? file : fs.readFileSync(file);
  const key = keyFor('cutout', bytes, { v: 1 });
  const t0 = Date.now();

  const ext = Buffer.isBuffer(file) ? 'jpg' : (String(file).toLowerCase().split('.').pop() || 'jpg');
  const { buf, hit } = await memo(key, '.png', async () => {
    const raw = await matteViaWorker(bytes, ext);
    // trim here so the cached artefact is already tight — every downstream
    // consumer wants the trimmed version and trimming is not free at 1080px.
    return await sharp(raw).ensureAlpha().trim({ threshold: 1 }).png({ compressionLevel: 9 }).toBuffer();
  });

  let stats = readJson(`${key}-stats`);
  if (!stats) { stats = await alphaStats(buf); writeJson(`${key}-stats`, stats); }

  return { buf, stats, verdict: judgeCutout(stats), hit, ms: Date.now() - t0, key };
}
