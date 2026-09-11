// Subject measurement for the reference miner: is there a matted foreground,
// how much of the frame does it cover, and does it BLEED off an edge.
//
// Bleed is the single most characteristic property of the 193k format ("one
// B&W cutout bleeding off the bottom-right edge"), so it has to be measured
// rather than eyeballed. That needs an UNTRIMMED matte — engine/source/cutout
// trims for compositing, which destroys exactly the information we need here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { keyFor, memo, readJson, writeJson, sha } from '../engine/_attic/source/cache.mjs';

const run = promisify(execFile);
const WORKER = fileURLToPath(new URL('../engine/_attic/source/matte-worker.mjs', import.meta.url));

/** Untrimmed matte, cached. Runs in its own process (ONNX vs libvips). */
async function matteFull(file) {
  const bytes = fs.readFileSync(file);
  const key = keyFor('matte-full', bytes, { v: 1 });
  const { buf } = await memo(key, '.png', async () => {
    const tmp = path.join(os.tmpdir(), 'carousel-matte');
    fs.mkdirSync(tmp, { recursive: true });
    const stem = sha(bytes).slice(0, 16);
    const ext = String(file).toLowerCase().split('.').pop();
    const inFile = path.join(tmp, stem + '.' + ext);
    const outFile = path.join(tmp, stem + '-full.png');
    fs.writeFileSync(inFile, bytes);
    try {
      await run(process.execPath, [WORKER, inFile, outFile], { maxBuffer: 1 << 26 });
      return fs.readFileSync(outFile);
    } finally {
      for (const f of [inFile, outFile]) { try { fs.unlinkSync(f); } catch {} }
    }
  });
  return { buf, key };
}

const EDGE_TOL = 0.012;   // within 1.2% of a border counts as touching it
const EDGE_MIN_RUN = 0.05; // and it must run along >=5% of that border to be a bleed
                           // rather than a single stray pixel

/**
 * @returns {{hasSubject, coveragePct, bbox, bleedEdges, edgeRuns, centroid}}
 */
export async function subjectFeatures(file) {
  const { key } = await matteFull(file);
  const cached = readJson(key + '-subj');
  if (cached) return cached;

  const { buf } = await matteFull(file);
  const { data, info } = await sharp(buf).ensureAlpha()
    .resize(300, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, n = W * H;

  let fg = 0, minX = W, maxX = -1, minY = H, maxY = -1, cx = 0, cy = 0;
  const tolX = Math.max(1, Math.round(W * EDGE_TOL));
  const tolY = Math.max(1, Math.round(H * EDGE_TOL));
  let top = 0, bottom = 0, left = 0, right = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] <= 16) continue;
      fg++; cx += x; cy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (y < tolY) top++;
      if (y >= H - tolY) bottom++;
      if (x < tolX) left++;
      if (x >= W - tolX) right++;
    }
  }

  if (maxX < 0) {
    const empty = { hasSubject: false, coveragePct: 0, bbox: null, bleedEdges: [], edgeRuns: {}, centroid: null };
    writeJson(key + '-subj', empty);
    return empty;
  }

  // normalise each edge count by the strip area, so "how much of this border is
  // covered" is comparable across edges of different lengths
  const runs = {
    top: +(top / (W * tolY)).toFixed(3),
    bottom: +(bottom / (W * tolY)).toFixed(3),
    left: +(left / (H * tolX)).toFixed(3),
    right: +(right / (H * tolX)).toFixed(3),
  };
  const bleedEdges = Object.entries(runs).filter(([, v]) => v >= EDGE_MIN_RUN).map(([k]) => k);

  const out = {
    hasSubject: fg / n >= 0.03,
    coveragePct: +(100 * fg / n).toFixed(2),
    bbox: {
      x: +(minX / W).toFixed(3), y: +(minY / H).toFixed(3),
      w: +((maxX - minX + 1) / W).toFixed(3), h: +((maxY - minY + 1) / H).toFixed(3),
    },
    bleedEdges,
    edgeRuns: runs,
    centroid: { x: +(cx / fg / W).toFixed(3), y: +(cy / fg / H).toFixed(3) },
  };
  writeJson(key + '-subj', out);
  return out;
}
