// Pixel-level measurement for the automated rubric. Same LAB maths and same
// thresholds used to characterise the reference corpus (tools/color-probe.mjs),
// so "one accent hue" means the same thing for our output as for theirs.
import sharp from 'sharp';

function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
function fLab(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
export function rgbToLab(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = R * 0.4124 + G * 0.3576 + B * 0.1805;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = R * 0.0193 + G * 0.1192 + B * 0.9505;
  const fx = fLab(X / 0.95047), fy = fLab(Y), fz = fLab(Z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

export const CHROMA_MIN = 18;   // C* below this is the neutral axis
export const BIN_MIN = 0.008;   // a hue bin under 0.8% of pixels is noise, not a colour event

/** Chromatic clusters of one rendered slide, hue-binned at 20 degrees. */
export async function accentClusters(file, sampleWidth = 180) {
  const { data, info } = await sharp(file).removeAlpha()
    .resize(sampleWidth, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, ch = info.channels;
  const bins = Array.from({ length: 18 }, () => ({ n: 0, r: 0, g: 0, b: 0, C: 0 }));
  let chromatic = 0;
  for (let i = 0; i < n; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
    const [L, A, B] = rgbToLab(r, g, b);
    const C = Math.hypot(A, B);
    if (C < CHROMA_MIN) continue;
    chromatic++;
    let h = Math.atan2(B, A) * 180 / Math.PI; if (h < 0) h += 360;
    const e = bins[Math.floor(h / 20) % 18];
    e.n++; e.r += r; e.g += g; e.b += b; e.C += C;
  }
  const raw = bins.map((e, i) => (e.n ? {
    hueBin: i * 20, n: e.n, frac: e.n / n, meanC: e.C / e.n, hex: hex(e.r / e.n, e.g / e.n, e.b / e.n),
  } : null)).filter(Boolean).sort((a, b) => b.n - a.n);

  // merge adjacent bins — a single ink can straddle a 20-degree boundary
  const merged = [];
  for (const c of raw) {
    const near = merged.find((m) => Math.min(Math.abs(m.hueBin - c.hueBin), 360 - Math.abs(m.hueBin - c.hueBin)) <= 20);
    if (near) { near.n += c.n; near.frac += c.frac; } else merged.push({ ...c });
  }
  return {
    clusters: merged.filter((m) => m.frac >= BIN_MIN),
    chromaticFrac: chromatic / n,
    all: merged,
  };
}

/** Painted extent of the non-background pixels, for the safe-area check. */
export async function contentBBox(file, threshold = 14) {
  const { data, info } = await sharp(file).removeAlpha()
    .resize(270, null, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const at = (x, y) => { const i = (y * w + x) * c; return [data[i], data[i + 1], data[i + 2]]; };
  let br = 0, bg = 0, bb = 0, k = 0;
  for (const [cx, cy] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) {
    const [r, g, b] = at(cx, cy); br += r; bg += g; bb += b; k++;
  }
  br /= k; bg /= k; bb /= k;
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = at(x, y);
    if (Math.hypot(r - br, g - bg, b - bb) > threshold) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX / w, y: minY / h, w: (maxX - minX + 1) / w, h: (maxY - minY + 1) / h };
}

export async function dimensions(file) {
  const m = await sharp(file).metadata();
  return { w: m.width, h: m.height };
}
