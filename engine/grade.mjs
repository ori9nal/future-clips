// Colour grading.
//
// There was none before this — the pipeline wrote whatever the source gave it,
// which is why sets built from mixed sources never looked like one set. A grade
// is what makes eight images from three places read as one post.
//
// Everything here is a per-channel lookup table applied in one pass, because
// sharp can take three 256-entry LUTs directly. That is fast, exact, and
// reversible on paper — as opposed to stacking modulate/linear calls, where the
// order silently changes the result and nothing is inspectable.
import sharp from 'sharp';

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * A named look. `lift` raises the floor (the faded-black film move), `gain`
 * scales the ceiling, `gamma` bends the midtones, and `split` tints shadows and
 * highlights in opposite directions — the single biggest contributor to
 * something reading as "graded" rather than "a photo".
 */
export const LOOKS = {
  none: null,

  /** No grade. A touch of grain and a hair of contrast, which is what a phone JPEG has. */
  phone: {
    lift: [0, 0, 0], gain: [1.0, 1.0, 1.0], gamma: [1.0, 1.0, 1.0],
    contrast: 0.04, saturation: 1.0,
    split: { shadows: [0, 0, 0], highlights: [0, 0, 0] },
    vignette: 0, grain: 5,
  },

  /** Warm highlights, cool shadows, slightly crushed black. The default film look. */
  cinematic: {
    lift: [0.045, 0.040, 0.062], gain: [1.02, 1.00, 0.96], gamma: [1.0, 1.0, 1.02],
    contrast: 0.18, saturation: 0.92,
    split: { shadows: [-6, -2, 14], highlights: [12, 6, -8] },
    vignette: 0.22, grain: 3,
  },

  /** Cold, hard, high contrast. Gym and night content. */
  steel: {
    lift: [0.02, 0.03, 0.05], gain: [0.98, 1.0, 1.04], gamma: [1.02, 1.0, 0.98],
    contrast: 0.26, saturation: 0.82,
    split: { shadows: [-8, -3, 16], highlights: [-2, 2, 8] },
    vignette: 0.28, grain: 4,
  },

  /** Warm, bright, gentle. Food, skincare, lifestyle. */
  sunlit: {
    lift: [0.05, 0.045, 0.03], gain: [1.04, 1.01, 0.97], gamma: [0.98, 1.0, 1.02],
    contrast: 0.10, saturation: 1.06,
    split: { shadows: [4, 0, -4], highlights: [14, 7, -6] },
    vignette: 0.12, grain: 2,
  },

  /** Near-neutral. Editorial and clinical, where the grade should not announce itself. */
  clean: {
    lift: [0.012, 0.012, 0.012], gain: [1.0, 1.0, 1.0], gamma: [1.0, 1.0, 1.0],
    contrast: 0.07, saturation: 0.97,
    split: { shadows: [0, 0, 3], highlights: [3, 2, 0] },
    vignette: 0.08, grain: 1.5,
  },

  /** Desaturated to near-mono with a cool cast. */
  ash: {
    lift: [0.03, 0.03, 0.035], gain: [1.0, 1.0, 1.0], gamma: [1.0, 1.0, 1.0],
    contrast: 0.20, saturation: 0.22,
    split: { shadows: [-4, -2, 8], highlights: [4, 4, 6] },
    vignette: 0.24, grain: 3.5,
  },
};

/** An S-curve that leaves 0 and 1 fixed, so contrast never clips the ends. */
const scurve = (x, amount) => (amount === 0 ? x : x + amount * Math.sin(2 * Math.PI * x) * -0.5 + 0);

function buildLut(look) {
  const luts = [[], [], []];
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < 256; i++) {
      let v = i / 255;

      v = look.lift[c] + v * (1 - look.lift[c]);          // lift the floor
      v *= look.gain[c];                                   // scale the ceiling
      v = Math.pow(Math.max(v, 0), look.gamma[c]);         // bend the midtones
      v = scurve(v, look.contrast);                        // contrast, ends fixed

      // split-tone: shadows and highlights pull apart, weighted by luminance so
      // the midtones stay where they are
      const shadowW = Math.pow(1 - v, 2), highW = Math.pow(v, 2);
      v += (look.split.shadows[c] / 255) * shadowW + (look.split.highlights[c] / 255) * highW;

      luts[c].push(clamp(Math.round(v * 255)));
    }
  }
  return luts;
}

/**
 * Grade an image.
 *
 * @param {Buffer|string} input
 * @param {string|object} look   a LOOKS key, or a look object
 * @param {object} o             {width, height}
 */
export async function grade(input, look, o = {}) {
  const L = typeof look === 'string' ? LOOKS[look] : look;
  if (!L) return sharp(input).toBuffer();

  const meta = await sharp(input).metadata();
  const W = o.width ?? meta.width, H = o.height ?? meta.height;

  const luts = buildLut(L);
  // Per-channel LUT via a 256x1 identity mapped through the curve, applied with
  // recomb-free `linear` is not expressive enough — so the curve is baked by
  // remapping raw bytes directly. One pass, no ordering surprises.
  const { data, info } = await sharp(input).resize(W, H, { fit: 'cover' }).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });

  for (let p = 0; p < data.length; p += 3) {
    const r = luts[0][data[p]], g = luts[1][data[p + 1]], b = luts[2][data[p + 2]];
    // saturation about the perceptual luminance of the graded pixel
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    data[p] = clamp(Math.round(lum + (r - lum) * L.saturation));
    data[p + 1] = clamp(Math.round(lum + (g - lum) * L.saturation));
    data[p + 2] = clamp(Math.round(lum + (b - lum) * L.saturation));
  }

  let img = sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } });

  if (L.vignette > 0) {
    // radial darkening, drawn as an SVG overlay so it costs one composite
    const svg = Buffer.from(
      `<svg width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="48%" r="72%">` +
      `<stop offset="55%" stop-color="#000" stop-opacity="0"/>` +
      `<stop offset="100%" stop-color="#000" stop-opacity="${L.vignette}"/>` +
      `</radialGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`);
    img = sharp(await img.png().toBuffer()).composite([{ input: svg, blend: 'over' }]);
  }

  if (L.grain > 0) {
    const noise = Buffer.from(
      `<svg width="${W}" height="${H}"><filter id="n">` +
      `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>` +
      `<feColorMatrix type="saturate" values="0"/></filter>` +
      `<rect width="${W}" height="${H}" filter="url(#n)" opacity="${(L.grain / 100).toFixed(3)}"/></svg>`);
    img = sharp(await img.png().toBuffer()).composite([{ input: noise, blend: 'overlay' }]);
  }

  return img.png().toBuffer();
}

/** The look that suits a style, when a campaign does not name one. */
export function lookFor(styleId) {
  return ({
    native: 'cinematic', mascot: 'none', bedrock: 'none',
    clinical: 'clean', editorial: 'ash', document: 'none',
    poster: 'steel', pastel: 'sunlit',
  })[styleId] ?? 'clean';
}
