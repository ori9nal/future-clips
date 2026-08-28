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

/**
 * Stray-blob detection. A matte often keeps a faint second person from the
 * background — a ghost that reads as a smudge once composited on white. Edge
 * and coverage checks both pass it, because it is neither a halo nor a change
 * in total area. Measured as the share of foreground held by the LARGEST
 * connected component: one clean subject is ~1.0, a subject plus a ghost is not.
 *
 * Two-pass connected components with union-find, on a downscaled mask.
 */
export async function componentStats(png) {
  const { data, info } = await sharp(png).ensureAlpha().resize(200, null, { fit: 'inside' })
    .raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, n = W * H;
  const label = new Int32Array(n).fill(-1);
  const parent = [];
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const on = (i) => data[i * 4 + 3] > 40;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!on(i)) continue;
      const up = y > 0 && on(i - W) ? label[i - W] : -1;
      const left = x > 0 && on(i - 1) ? label[i - 1] : -1;
      if (up < 0 && left < 0) { const id = parent.length; parent.push(id); label[i] = id; }
      else if (up >= 0 && left >= 0) { label[i] = up; union(up, left); }
      else label[i] = up >= 0 ? up : left;
    }
  }
  const sizes = new Map();
  let fg = 0;
  for (let i = 0; i < n; i++) {
    if (label[i] < 0) continue;
    fg++;
    const r = find(label[i]);
    sizes.set(r, (sizes.get(r) || 0) + 1);
  }
  if (!fg) return { components: 0, largestShare: 0 };
  const ordered = [...sizes.values()].sort((a, b) => b - a);
  return {
    // components holding at least 0.5% of the foreground — smaller than that is
    // antialiasing debris, not a ghost
    components: ordered.filter((s) => s / fg >= 0.005).length,
    largestShare: +(ordered[0] / fg).toFixed(4),
  };
}

/**
 * Halo detection. A matte cut from a bright background leaves a rim of
 * semi-transparent pixels carrying that background's colour; dropped on white it
 * reads as a glow, and on any other ground as a dirty edge. It is the single
 * most visible tell that an image was cut out by a machine.
 *
 * Measured as the luminance gap between the alpha TRANSITION band and the solid
 * interior. A clean edge has the transition band close to the subject's own
 * tone; a haloed edge is markedly brighter.
 */
export async function haloScore(png) {
  const { data, info } = await sharp(png).ensureAlpha().resize(400, null, { fit: 'inside' })
    .raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let edgeSum = 0, edgeN = 0, coreSum = 0, coreN = 0;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    const l = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    if (a >= 30 && a <= 200) { edgeSum += l; edgeN++; }
    else if (a > 240) { coreSum += l; coreN++; }
  }
  if (!edgeN || !coreN) return { halo: 0, darkFringe: 0, edgeLuma: null, coreLuma: null };
  const edgeLuma = edgeSum / edgeN, coreLuma = coreSum / coreN;
  const halo = (edgeLuma - coreLuma) / 255;
  return {
    // Signed: positive = edge brighter than the subject, negative = darker.
    halo: +halo.toFixed(4),
    // WHICH SIGN IS THE DEFECT DEPENDS ON THE GROUND WE COMPOSITE ONTO.
    // These cutouts land on white. A dark subject cut from a white background
    // necessarily leaves an edge brighter than its core, and on white that edge
    // is invisible — it blends into the page. The visible defect is the mirror
    // case: a subject cut from a DARK background keeps a dark rim, which reads
    // as a dirty outline against white.
    //
    // Gating on the bright case rejected 30 of 42 white-background candidates
    // while keeping dark-background ones measuring -0.40, i.e. exactly backwards.
    darkFringe: +Math.max(0, -halo).toFixed(4),
    edgeLuma: +edgeLuma.toFixed(1),
    coreLuma: +coreLuma.toFixed(1),
  };
}

/**
 * Delete stray components from a matte, keeping the subject.
 *
 * Rejecting a good photograph because the model kept a ghost of a bystander
 * throws away a usable asset; deleting the ghost keeps it. Runs at full
 * resolution so the alpha it writes is the alpha that composites, and re-trims
 * afterwards because removing a blob usually shrinks the bounding box.
 */
export async function cleanMatte(png, {
  minShare = 0.02, coreAlpha = 140, looseAlpha = 60,
  floor = 60, ceil = 200,
} = {}) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, n = W * H;

  // Alpha curve, applied BEFORE anything else.
  //
  // The ONNX matte does not output a clean binary mask: on a measured sample the
  // subject's body sat at alpha 181-254 (only 1,501 pixels of 432,795 were fully
  // opaque) while 31,368 pixels carried alpha 1-40 — a broad translucent haze of
  // retained background. On white that haze IS the visible ghost, and because it
  // is contiguous it also bridges unrelated regions into one component, which is
  // why component analysis alone could not remove it.
  //
  // Below `floor` -> nothing; above `ceil` -> solid; linear between. A real soft
  // edge crosses that band within a pixel or two, so hair and motion blur
  // survive while the haze does not.
  const span = Math.max(1, ceil - floor);
  let floored = 0;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (a > 0 && a <= floor) floored++;
    data[i * 4 + 3] = a <= floor ? 0 : a >= ceil ? 255 : Math.round(((a - floor) / span) * 255);
  }
  const label = new Int32Array(n).fill(-1);
  const parent = [];
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };

  // Components are found on the SOLID core, not the loose mask. A ghost —
  // a bystander the model half-kept — is semi-transparent throughout, so at the
  // loose threshold it often touches the real subject through a faint bridge and
  // reads as one component. At the core threshold it has no body at all, which
  // is exactly what distinguishes it from a subject.
  const on = (i) => data[i * 4 + 3] >= coreAlpha;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!on(i)) continue;
      const up = y > 0 && on(i - W) ? label[i - W] : -1;
      const left = x > 0 && on(i - 1) ? label[i - 1] : -1;
      if (up < 0 && left < 0) { const id = parent.length; parent.push(id); label[i] = id; }
      else if (up >= 0 && left >= 0) { label[i] = up; union(up, left); }
      else label[i] = up >= 0 ? up : left;
    }
  }
  const sizes = new Map();
  let fg = 0;
  for (let i = 0; i < n; i++) {
    if (label[i] < 0) continue;
    fg++;
    const r = find(label[i]);
    sizes.set(r, (sizes.get(r) || 0) + 1);
  }
  if (!fg) return { buf: png, removed: 0 };

  const keep = new Set([...sizes.entries()].filter(([, s]) => s / fg >= minShare).map(([r]) => r));

  // Grow the kept cores back out over the loose mask so real soft edges — hair,
  // motion blur, the antialiased rim — survive. Anything in the loose mask that
  // the flood never reaches had no core to grow from: that is the ghost.
  const keepMask = new Uint8Array(n);
  const stack = [];
  for (let i = 0; i < n; i++) if (label[i] >= 0 && keep.has(find(label[i]))) { keepMask[i] = 1; stack.push(i); }
  const loose = (i) => data[i * 4 + 3] > looseAlpha;
  while (stack.length) {
    const i = stack.pop();
    const x = i % W, y = (i / W) | 0;
    if (x > 0 && !keepMask[i - 1] && loose(i - 1)) { keepMask[i - 1] = 1; stack.push(i - 1); }
    if (x < W - 1 && !keepMask[i + 1] && loose(i + 1)) { keepMask[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && !keepMask[i - W] && loose(i - W)) { keepMask[i - W] = 1; stack.push(i - W); }
    if (y < H - 1 && !keepMask[i + W] && loose(i + W)) { keepMask[i + W] = 1; stack.push(i + W); }
  }

  let removed = 0;
  const out = Buffer.from(data);
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] <= looseAlpha) continue;
    if (!keepMask[i]) { out[i * 4 + 3] = 0; removed++; }
  }
  const buf = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .trim({ threshold: 1 }).png({ compressionLevel: 9 }).toBuffer();
  return { buf, removed, floored, removedShare: +((removed + floored) / (fg + floored)).toFixed(4) };
}

/**
 * Tone statistics of the SUBJECT only — measured through its own alpha, not over
 * the frame. A cutout sourced from low-key photography can be a near-black
 * silhouette: fine on a dark plate, wrong on a white ground, where it reads as a
 * blob rather than a person. The frame-level probe cannot see this because by
 * the time we have a cutout the background is gone.
 */
export async function subjectTone(png) {
  const { data, info } = await sharp(png).ensureAlpha().resize(300, null, { fit: 'inside' })
    .raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  const vals = [];
  for (let i = 0; i < n; i++) {
    if (data[i * 4 + 3] < 200) continue;
    vals.push(0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]);
  }
  if (vals.length < 200) return { toneMean: null, toneSpread: null, toneP5: null, toneP95: null };
  vals.sort((a, b) => a - b);
  const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))];
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return {
    toneMean: +mean.toFixed(1),
    toneP5: +q(0.05).toFixed(1),
    toneP95: +q(0.95).toFixed(1),
    toneSpread: +(q(0.95) - q(0.05)).toFixed(1),
  };
}

/**
 * Greyscale a cutout and stretch ITS OWN tonal range, so every subject in a set
 * lands in a comparable band. A fixed linear() cannot do this: the same curve
 * that flatters a daylight runner crushes a dark-gym boxer to a silhouette, and
 * a set mixing the two reads as inconsistent rather than as a series.
 *
 * `targetHigh` stops well short of 255 ON PURPOSE. These cutouts composite onto
 * a WHITE page, so any highlight pushed to near-white dissolves into it — a
 * light-clothed runner stretched to 238 lost their whole upper body to the
 * background. Capping the highlight keeps the subject reading as an object on
 * the page rather than a hole in it.
 */
export async function toBW(png, { targetLow = 18, targetHigh = 202 } = {}) {
  const tone = await subjectTone(png);
  const grey = sharp(png).greyscale();
  if (tone.toneP5 == null || tone.toneSpread < 8) return await grey.png({ compressionLevel: 9 }).toBuffer();
  const span = Math.max(12, tone.toneP95 - tone.toneP5);
  const a = (targetHigh - targetLow) / span;
  const b = targetLow - a * tone.toneP5;
  return await grey.linear(a, b).png({ compressionLevel: 9 }).toBuffer();
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
  // See haloScore: on a white ground the DARK fringe is the visible defect.
  if (s.darkFringe != null && s.darkFringe > 0.14) fail.push(`darkFringe ${s.darkFringe} > 0.14 (dark rim from a dark background, visible on white)`);
  // A very large bright halo still means the matte kept a lot of background.
  if (s.halo != null && s.halo > 0.55) fail.push(`halo ${s.halo} > 0.55 (matte kept substantial background)`);
  if (s.largestShare != null && s.largestShare < 0.90) fail.push(`largestShare ${s.largestShare} < 0.90 (stray blob / ghost subject)`);
  // Tone gates only apply once we have measured the subject through its alpha.
  // A silhouette is a legitimate asset on a dark plate and a defect on white,
  // which is the only ground this direction uses.
  if (s.toneMean != null && s.toneMean < 42) fail.push(`toneMean ${s.toneMean} < 42 (renders as a silhouette on white)`);
  if (s.toneSpread != null && s.toneSpread < 40) fail.push(`toneSpread ${s.toneSpread} < 40 (no modelling left in the subject)`);
  if (s.translucency != null && s.translucency > TRANSLUCENCY_MAX) fail.push(`translucency ${s.translucency} > ${TRANSLUCENCY_MAX} (subject is see-through on white)`);
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

  let stats = readJson(`${key}-stats-v2`);
  if (!stats) {
    stats = { ...(await alphaStats(buf)), ...(await haloScore(buf)), ...(await componentStats(buf)) };
    writeJson(`${key}-stats-v2`, stats);
  }

  return { buf, stats, verdict: judgeCutout(stats), hit, ms: Date.now() - t0, key };
}

/**
 * Perceptual hash of the matted subject (dHash, 8x8 over greyscale gradients).
 *
 * Stock searches return whole shoots: two adjacent Pexels ids are routinely the
 * same model, same outfit, same light. Those land in the library as separate
 * entries and then appear on consecutive slides, which reads as a mistake. Hash
 * distance catches them where an id comparison cannot.
 */
export async function perceptualHash(png) {
  const W = 9, H = 8;
  const { data } = await sharp(png)
    .flatten({ background: '#ffffff' })   // judge the subject as it composites
    .greyscale().resize(W, H, { fit: 'fill' })
    .raw().toBuffer({ resolveWithObject: true });
  let bits = '';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W - 1; x++)
      bits += data[y * W + x] < data[y * W + x + 1] ? '1' : '0';
  return bits;
}

export function hammingDistance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Distance below this means "the same shoot", not "a similar pose". */
export const DUPLICATE_DISTANCE = 8;

/**
 * How much of the subject is SEE-THROUGH.
 *
 * A backlit runner, motion blur, smoke or thin fabric leaves the matte with
 * partial alpha across the subject's interior, not just at its rim. Composited
 * on white that reads as a faded, half-erased figure — and none of the other
 * gates can see it: the edge is clean, the mean tone is fine, and a luminance
 * test finds nothing because the pixels that vanish are the ones it skips
 * (they are not solid enough to be sampled in the first place).
 *
 * Measured as the share of VISIBLE pixels that are not solid. A clean cutout is
 * a couple of percent — just the antialiased rim. Measured across a 15-subject
 * library the clean ones sat at 0.01-0.05 and the smoke-obscured boxer at 0.30.
 */
export async function translucency(png) {
  const { data, info } = await sharp(png).ensureAlpha().resize(240, null, { fit: 'inside' })
    .raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let visible = 0, partial = 0;
  for (let i = 0; i < n; i++) {
    const a = data[i * 4 + 3];
    if (a <= 40) continue;
    visible++;
    if (a < 210) partial++;
  }
  return { translucency: visible ? +(partial / visible).toFixed(4) : 1, visiblePx: visible };
}

export const TRANSLUCENCY_MAX = 0.06;
