// Measure a candidate image BEFORE accepting it.
//
// The brief's rule: "woman sleeping" returns bright stock garbage; the query has
// to ask for lighting, and then the RESULT has to be verified — a query
// qualifier is a request, not a guarantee. Everything here is measured on
// pixels so a candidate cannot pass on its caption.
import sharp from 'sharp';

const SAMPLE = 256; // measure on a downscale: 256px is stable for all of these
                    // and ~40x cheaper than measuring the full plate.

/**
 * @returns {{ sharpness, luma, contrast, saturation, clipLow, clipHigh, w, h, aspect }}
 *   sharpness  variance of the Laplacian — focus/detail. Blurred stock ~<40.
 *   luma       mean luminance 0-255.
 *   contrast   stddev of luminance — flat plates are low.
 *   saturation mean |chroma|; a low-key frame that is also grey grades well.
 *   clipLow/High fraction of pixels crushed to 0 / blown to 255.
 */
export async function probeImage(input) {
  const img = sharp(input).resize(SAMPLE, SAMPLE, { fit: 'inside' });
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels, W = info.width, H = info.height, n = W * H;

  const lum = new Float64Array(n);
  let sat = 0, clipLow = 0, clipHigh = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = l;
    sat += (Math.max(r, g, b) - Math.min(r, g, b));
    if (l <= 2) clipLow++;
    if (l >= 253) clipHigh++;
  }

  let mean = 0;
  for (let i = 0; i < n; i++) mean += lum[i];
  mean /= n;
  let varr = 0;
  for (let i = 0; i < n; i++) { const d = lum[i] - mean; varr += d * d; }
  const contrast = Math.sqrt(varr / n);

  // 3x3 Laplacian on luminance; variance of the response is the focus measure.
  let lmean = 0; const lap = new Float64Array(n);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const v = -4 * lum[i] + lum[i - 1] + lum[i + 1] + lum[i - W] + lum[i + W];
      lap[i] = v; lmean += v;
    }
  }
  const inner = (W - 2) * (H - 2);
  lmean /= inner;
  let lvar = 0;
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) { const d = lap[y * W + x] - lmean; lvar += d * d; }

  const meta = await sharp(input).metadata();
  return {
    sharpness: +(lvar / inner).toFixed(2),
    luma: +mean.toFixed(2),
    contrast: +contrast.toFixed(2),
    saturation: +(sat / n).toFixed(2),
    clipLow: +(clipLow / n).toFixed(4),
    clipHigh: +(clipHigh / n).toFixed(4),
    w: meta.width, h: meta.height,
    aspect: +(meta.width / meta.height).toFixed(3),
  };
}

/**
 * Accept/reject against a mood. The engine grades everything down to B&W or a
 * two-stop duotone, so what matters is not the source hue but whether there is
 * modelling left after the crush: a blown-out frame has no shadow to push cool.
 */
export const MOODS = {
  // low-key portraiture — the default for anything that becomes a SUBJECT
  'low-key':  { luma: [18, 118], contrast: [26, 999], sharpness: 55, clipHigh: 0.06 },
  // a plate that will sit BEHIND type: mid, calm, not busy
  'plate':    { luma: [22, 150], contrast: [14, 78],  sharpness: 25, clipHigh: 0.10 },
  // bright editorial — bone-plate families
  'high-key': { luma: [140, 242], contrast: [18, 999], sharpness: 55, clipLow: 0.04 },
};

export function judge(p, mood = 'low-key') {
  const m = MOODS[mood] || MOODS['low-key'];
  const fail = [];
  if (p.luma < m.luma[0]) fail.push(`luma ${p.luma} < ${m.luma[0]} (too dark, no detail to grade)`);
  if (p.luma > m.luma[1]) fail.push(`luma ${p.luma} > ${m.luma[1]} (bright stock look)`);
  if (p.contrast < m.contrast[0]) fail.push(`contrast ${p.contrast} < ${m.contrast[0]} (flat)`);
  if (m.contrast[1] < 999 && p.contrast > m.contrast[1]) fail.push(`contrast ${p.contrast} > ${m.contrast[1]} (too busy behind type)`);
  if (p.sharpness < m.sharpness) fail.push(`sharpness ${p.sharpness} < ${m.sharpness} (soft)`);
  if (m.clipHigh != null && p.clipHigh > m.clipHigh) fail.push(`clipHigh ${p.clipHigh} > ${m.clipHigh} (blown highlights)`);
  if (m.clipLow != null && p.clipLow > m.clipLow) fail.push(`clipLow ${p.clipLow} > ${m.clipLow} (crushed blacks)`);
  return { pass: fail.length === 0, fail };
}

/** Rank survivors: prefer sharp, and prefer luminance near the mood's centre. */
export function score(p, mood = 'low-key') {
  const m = MOODS[mood] || MOODS['low-key'];
  const mid = (m.luma[0] + m.luma[1]) / 2;
  const lumaFit = 1 - Math.min(1, Math.abs(p.luma - mid) / ((m.luma[1] - m.luma[0]) / 2));
  const sharpFit = Math.min(1, p.sharpness / 400);
  const contrastFit = Math.min(1, p.contrast / 60);
  return +(0.45 * sharpFit + 0.35 * lumaFit + 0.20 * contrastFit).toFixed(4);
}
