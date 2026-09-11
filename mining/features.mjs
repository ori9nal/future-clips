// Reference feature extraction — the measurement half of the reference miner.
//
// This is a permanent subsystem, not a research script: the same extractor runs
// on scraped posts (Apify) and on any local corpus, and its output maps 1:1 to
// the `reference_features` table. Template parameters are DERIVED from these
// distributions, never chosen by taste — if 90% of top posts are white, white
// is the default because the data said so.
//
// Everything here is measured on pixels except the field marked APPROXIMATE,
// which is a heuristic and is labelled as such wherever it surfaces. Caption
// fields (word count, hook text) come from the scrape, not from pixels.
import sharp from 'sharp';
import { rgbToLab, CHROMA_MIN } from '../engine/_attic/gauntlet/pixels.mjs';

const SAMPLE = 240;

async function raw(file, width = SAMPLE) {
  const { data, info } = await sharp(file).resize(width, null, { fit: 'inside' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height, ch: info.channels };
}

const lumaOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// ------------------------------------------------------------------ background
/**
 * Measured from the BORDER RING, not the whole frame: a full-frame mean is
 * dragged down by a large dark subject and would call a white-background post
 * "mid-grey".
 */
export async function backgroundFeatures(file) {
  const { data, W, H, ch } = await raw(file);
  const band = Math.max(2, Math.round(Math.min(W, H) * 0.06));
  let n = 0, sum = 0, sumSq = 0, whitePx = 0, darkPx = 0;
  const hist = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const onBorder = x < band || y < band || x >= W - band || y >= H - band;
      if (!onBorder) continue;
      const i = (y * W + x) * ch;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = lumaOf(r, g, b);
      sum += l; sumSq += l * l; n++;
      // A subject that BLEEDS off an edge puts its own dark pixels in the border
      // ring, which drags the mean down and inflates sd — so a mean/sd test
      // reports the 193k format (white ground, cutout off the bottom) as
      // "not white". Counting the share of genuinely white border pixels is
      // robust to that, because the subject only occupies part of one edge.
      const [, A, B2] = rgbToLab(r, g, b);
      if (l >= 242 && Math.hypot(A, B2) < 6) whitePx++;
      if (l <= 90) darkPx++;
      const k = (r >> 4) + ',' + (g >> 4) + ',' + (b >> 4);
      hist.set(k, (hist.get(k) || 0) + 1);
    }
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  const entry = [...hist.entries()].sort((a, b) => b[1] - a[1])[0];
  const [mr, mg, mb] = entry[0].split(',').map((v) => (+v) * 16 + 8);
  const [, modeA, modeB] = rgbToLab(mr, mg, mb);
  const modeChroma = Math.hypot(modeA, modeB);

  const whiteShare = whitePx / n;
  const darkShare = darkPx / n;
  return {
    borderLuma: +mean.toFixed(2),
    borderSd: +sd.toFixed(2),
    modeRgb: [mr, mg, mb],
    modeChroma: +modeChroma.toFixed(2),
    modeShare: +(entry[1] / n).toFixed(3),
    whiteShare: +whiteShare.toFixed(3),
    darkShare: +darkShare.toFixed(3),
    // Share-based, not mean-based, so a bleeding cutout cannot disqualify a
    // white ground. The mode must also be near-white, which rejects cream/bone.
    isWhite: whiteShare >= 0.70 && modeChroma < 6 && lumaOf(mr, mg, mb) >= 242,
    isNearWhite: whiteShare >= 0.55 && modeChroma < 10 && lumaOf(mr, mg, mb) >= 232,
    isDark: darkShare >= 0.70,
  };
}

// ----------------------------------------------------------------- chromatics
/**
 * How many DISTINCT colour events sit outside the neutral axis. The new gate is
 * "<=1 chromatic cluster"; measuring the corpus the same way is what tells us
 * whether the corpus actually agrees.
 */
export async function chromaticFeatures(file) {
  const { data, W, H, ch } = await raw(file);
  const n = W * H;
  const bins = new Map();
  let chromatic = 0;
  for (let i = 0; i < n; i++) {
    const p = i * ch;
    const [, A, B] = rgbToLab(data[p], data[p + 1], data[p + 2]);
    const C = Math.hypot(A, B);
    if (C < CHROMA_MIN) continue;
    chromatic++;
    const hue = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
    const b = Math.floor(hue / 30);
    bins.set(b, (bins.get(b) || 0) + 1);
  }
  const kept = [...bins.entries()]
    .map(([b, c]) => ({ hueBin: b * 30, share: c / n }))
    .filter((x) => x.share >= 0.008)
    .sort((a, b) => b.share - a.share);
  return {
    chromaticPct: +(100 * chromatic / n).toFixed(2),
    clusters: kept.length,
    topHues: kept.slice(0, 3).map((k) => ({ hue: k.hueBin, share: +k.share.toFixed(3) })),
  };
}

// --------------------------------------------------------------------- ink
/**
 * Ink = dark pixels on a light ground (or light on dark). Row bands of ink give
 * a line count and the geometry of the type block without OCR.
 */
export async function inkFeatures(file, bg) {
  const { data, W, H, ch } = await raw(file, 300);
  const background = bg || await backgroundFeatures(file);
  const isInk = (l) => (background.isDark ? l > 160 : l < 128);

  const rowInk = new Float64Array(H);
  let total = 0;
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      if (isInk(lumaOf(data[i], data[i + 1], data[i + 2]))) c++;
    }
    rowInk[y] = c / W; total += c;
  }
  // A row is "type" if it carries ink but is not a solid block — this is what
  // separates a headline row from a full-bleed photograph row.
  const bands = [];
  let start = -1;
  for (let y = 0; y < H; y++) {
    const t = rowInk[y] > 0.012 && rowInk[y] < 0.72;
    if (t && start < 0) start = y;
    if ((!t || y === H - 1) && start >= 0) {
      if (y - start >= 3) bands.push({ y0: start, y1: y, h: y - start });
      start = -1;
    }
  }
  const weight = bands.reduce((s, b) => s + b.h, 0);
  return {
    // normalised bands, exposed so stroke measurement can restrict itself to
    // type rather than to whatever the photograph is doing
    bands: bands.map((b) => ({ y0: +(b.y0 / H).toFixed(4), y1: +(b.y1 / H).toFixed(4), h: +(b.h / H).toFixed(4) })),
    inkPct: +(100 * total / (W * H)).toFixed(2),
    textBands: bands.length,
    tallestBandPct: bands.length ? +(100 * Math.max(...bands.map((b) => b.h)) / H).toFixed(1) : 0,
    // vertical centre of mass of the type: 0 = top, 1 = bottom. Tells us whether
    // the format sets the headline at the top (the 193k post) or the bottom.
    typeCentroid: weight ? +(bands.reduce((s, b) => s + ((b.y0 + b.y1) / 2) * b.h, 0) / weight / H).toFixed(3) : null,
    firstBandTop: bands.length ? +(bands[0].y0 / H).toFixed(3) : null,
  };
}

// ------------------------------------------------------------------- furniture
/**
 * Furniture lives in the bottom strip: a handle is a wide low run on the left,
 * an arrow a small compact mark on the right.
 */
export async function furnitureFeatures(file, bg) {
  const { data, W, H, ch } = await raw(file, 300);
  const background = bg || await backgroundFeatures(file);
  const isInk = (l) => (background.isDark ? l > 160 : l < 128);
  const cell = (x0, x1, y0, y1) => {
    let c = 0, n = 0, minX = 1e9, maxX = -1;
    for (let y = Math.round(y0 * H); y < Math.round(y1 * H); y++) {
      for (let x = Math.round(x0 * W); x < Math.round(x1 * W); x++) {
        const i = (y * W + x) * ch; n++;
        if (isInk(lumaOf(data[i], data[i + 1], data[i + 2]))) {
          c++; if (x < minX) minX = x; if (x > maxX) maxX = x;
        }
      }
    }
    return { density: c / Math.max(1, n), widthPct: maxX < 0 ? 0 : (maxX - minX) / W };
  };
  const bl = cell(0.03, 0.55, 0.88, 0.99);
  const br = cell(0.72, 0.99, 0.88, 0.99);
  return {
    handleLikely: bl.density > 0.004 && bl.widthPct > 0.06,
    arrowLikely: br.density > 0.003 && br.widthPct < 0.20,
    bottomLeftInk: +bl.density.toFixed(4),
    bottomRightInk: +br.density.toFixed(4),
  };
}

// ------------------------------------------------------- type style (APPROX)
/**
 * APPROXIMATE. Serif display carries high stroke contrast (thick stems, hairline
 * serifs); regular-weight sans is near-uniform. Measured as dispersion of
 * horizontal dark-run lengths. Useful in aggregate, unreliable per-slide, and
 * never used as a gate.
 */
export async function typeStyleApprox(file, bg, ink) {
  const { data, W, H, ch } = await raw(file, 400);
  const background = bg || await backgroundFeatures(file);
  const isInk = (l) => (background.isDark ? l > 160 : l < 128);

  // Measure ONLY inside detected text bands. Measuring the whole frame lets a
  // photograph dominate the run-length statistics, which reported most of a
  // photo-heavy corpus as "serif" — the runs were skin and shadow, not serifs.
  // A text line is a THIN band. Dropping tall bands removes photographic masses
  // that happen to fall inside the ink threshold.
  const bands = ((ink && ink.bands) || []).filter((b) => b.h < 0.15);
  const inBand = (y) => bands.length === 0 || bands.some((b) => y >= b.y0 * H && y <= b.y1 * H);

  const runs = [];
  for (let y = 0; y < H; y++) {
    if (!inBand(y)) continue;
    let run = 0;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * ch;
      if (isInk(lumaOf(data[i], data[i + 1], data[i + 2]))) run++;
      else { if (run > 0 && run < W * 0.25) runs.push(run); run = 0; }
    }
  }
  if (runs.length < 40) return { strokeMean: null, strokeCv: null, guess: 'unknown' };
  const mean = runs.reduce((a, b) => a + b, 0) / runs.length;
  const sd = Math.sqrt(runs.reduce((s, r) => s + (r - mean) ** 2, 0) / runs.length);
  const cv = sd / mean;
  return {
    strokeMean: +mean.toFixed(2),
    strokeCv: +cv.toFixed(3),
    guess: cv > 1.05 ? 'serif-or-mixed' : mean > 6.5 ? 'heavy-sans' : 'regular-sans',
  };
}

/** Everything that needs no matting. Cheap enough for every slide. */
export async function slideFeatures(file) {
  const bg = await backgroundFeatures(file);
  const ink = await inkFeatures(file, bg);
  const [chroma, furn, type] = await Promise.all([
    chromaticFeatures(file), furnitureFeatures(file, bg), typeStyleApprox(file, bg, ink),
  ]);
  const meta = await sharp(file).metadata();
  return {
    file, w: meta.width, h: meta.height, aspect: +(meta.width / meta.height).toFixed(3),
    bg, chroma, ink, furniture: furn, type,
  };
}
