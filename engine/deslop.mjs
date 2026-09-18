// De-slop: make a generated frame read as a real phone photo.
//
// A port of the owner's deslop.py (2026-09-13), applied to the PHOTO layer
// before any text is drawn. The script had to find the white text with a
// bright-and-colourless mask and paste it back after the grain; here the
// caption is composited afterwards, so it is crisp by construction and a
// street lamp can never be mistaken for a letter.
//
//   1. off-centre crop + tilt     breaks the too-perfect composition
//   2. exposure / saturation      kills the "tastefully lit" look
//   3. white-balance cast         gym LEDs are green, bedroom lamps orange
//   4. shadow-weighted noise      real sensor grain, heavier in the darks
//   5. hard JPEG recompress       genuine blocking artefacts in the gradients
//
// The knobs were re-measured on 2026-09-13 against the reference corpus
// (tools/_measure.mjs over Carousel examples/reference-2026-09, gym family,
// 40 slides at 720 px): luminance 87, contrast std 60, saturation 0.26,
// flat-area noise 1.34, 60 % of pixels flat. The script's verbatim numbers
// gave the G1 baseline noise 4.5 (3.4× the reference), std 43 (too flat),
// saturation 0.18 (too washed) and luminance 60 (too dark). Real phone JPEGs
// are punchy and only lightly grainy; what makes them amateur is the
// framing, the light and the mess — so the grain is a quarter of the
// script's, the exposure drop a third, and the tilt and cast are new.
//
// Every random draw comes from the seed, so the same set re-renders byte-
// identically and two sets never share a crop. `strength` scales every step
// (1 = the measured knobs, 0 = untouched); the gym camera-roll runs at 1 and
// the daylight/aspirational worlds a little lighter.
import sharp from 'sharp';

/** The tuning knobs, measured (see the header). */
export const KNOBS = {
  brightness: 0.93,   // lower = darker; only applied to bright frames (see `expo`)
  saturation: 0.90,   // lower = more washed out
  contrast: 1.03,     // >1 adds — a phone's own pipeline adds local contrast
  noiseMono: 4.2,     // luminance grain strength  (script: 15)
  noiseChroma: 2.2,   // colour speckle strength   (script: 8)
  recompressQ: 60,    // lower = more visible blocking (script: 42)
  crop: { x0: [0.03, 0.09], y0: [0.01, 0.045], x1: [0.985, 1.0], y1: [0.93, 0.975] },
  tilt: { degrees: [0.6, 2.4], share: 0.55 },   // a tilted horizon on about half the frames
  cast: { amount: [2, 7] },                       // white-balance error, ±units of 255 on one axis
  highlight: 0.985,   // phone HDR clips the top of the range harder than a generated frame does
};

/* ── seeded randomness ─────────────────────────────────────────────────── */

function hash32(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Standard normal, Box–Muller, two draws per call cached. */
function gaussian(rng) {
  let spare = null;
  return () => {
    if (spare !== null) { const v = spare; spare = null; return v; }
    let u, v, s;
    do { u = rng() * 2 - 1; v = rng() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    spare = v * m;
    return u * m;
  };
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * De-slop one frame.
 *
 * @param {Buffer|string} input   a photo (any size; it comes back at width×height)
 * @param {object} o
 * @param {string|number} o.seed  anything; the same seed gives the same result
 * @param {number} [o.width]      output size (defaults to the input's)
 * @param {number} [o.height]
 * @param {number} [o.strength]   0..1, default 1
 * @param {object} [o.knobs]      overrides for KNOBS
 * @returns {Promise<Buffer>}     PNG
 */
export async function deslop(input, o = {}) {
  const K = { ...KNOBS, ...(o.knobs ?? {}) };
  const S = Math.max(0, Math.min(1, o.strength ?? 1));
  if (S === 0) return sharp(input).png().toBuffer();
  const rng = mulberry32(hash32(o.seed ?? 'deslop'));
  const gauss = gaussian(rng);
  const meta = await sharp(input).metadata();
  const W = o.width ?? meta.width, H = o.height ?? meta.height;

  // 1. off-centre crop, randomised per frame, then back to the canvas size.
  //    On about half the frames the crop is also rotated a degree or two —
  //    the reference gyms lean (set-09 slide 4, set-10 slide 2, gym-2 slide 5)
  //    because nobody levels a phone. The rotation is applied to the crop
  //    box and the box is inset so the corners never show.
  const u = ([a, b]) => a + rng() * (b - a);
  const x0 = Math.round(meta.width * u(K.crop.x0) * S);
  const y0 = Math.round(meta.height * u(K.crop.y0) * S);
  const x1 = Math.round(meta.width * (1 - (1 - u(K.crop.x1)) * S));
  const y1 = Math.round(meta.height * (1 - (1 - u(K.crop.y1)) * S));
  const tilted = rng() < K.tilt.share;
  const deg = tilted ? u(K.tilt.degrees) * (rng() < 0.5 ? -1 : 1) * S : 0;
  let stage = sharp(input).extract({ left: x0, top: y0, width: Math.max(8, x1 - x0), height: Math.max(8, y1 - y0) });
  if (deg) {
    const rad = Math.abs(deg) * Math.PI / 180;
    const cw = x1 - x0, ch = y1 - y0;
    // the largest axis-aligned box of the same aspect inside the rotated crop
    const shrink = 1 / (Math.cos(rad) + Math.max(cw / ch, ch / cw) * Math.sin(rad));
    const iw = Math.round(cw * shrink), ih = Math.round(ch * shrink);
    stage = sharp(await stage.rotate(deg, { background: '#000' }).toBuffer());
    const rm = await stage.metadata();
    stage = stage.extract({ left: Math.round((rm.width - iw) / 2), top: Math.round((rm.height - ih) / 2), width: iw, height: ih });
  }
  const { data, info } = await stage.resize(W, H, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });

  // 2. grade, with PIL's semantics: Brightness scales toward black, Color
  //    blends toward the L-mode grey, Contrast blends toward the image's mean grey.
  //    The exposure drop is for the "tastefully lit" frame; a frame that is
  //    already dark (a night street, a dim gym) gets none of it. Full drop
  //    from L≈120 up, nothing below L≈55, linear between.
  const n = data.length;
  let srcL = 0;
  for (let p = 0; p < n; p += 3) srcL += (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
  srcL /= n / 3;
  const expo = Math.max(0, Math.min(1, (srcL - 55) / 65));
  const br = 1 - (1 - K.brightness) * S * expo;
  const sat = 1 - (1 - K.saturation) * S;
  const con = 1 + (K.contrast - 1) * S;
  const meanL = srcL * br;
  // 3. a white-balance error on one axis: green/magenta (gym LEDs, office
  //    fluorescents) or blue/amber (bedroom lamps, windows). One per frame,
  //    small, so the set does not match itself the way a graded set does.
  const castAmt = u(K.cast.amount) * S * (rng() < 0.5 ? -1 : 1);
  const castAxis = rng() < 0.55 ? 'gm' : 'ba';
  const cr = castAxis === 'gm' ? -castAmt * 0.5 : castAmt * 0.6;
  const cg = castAxis === 'gm' ? castAmt : 0;
  const cb = castAxis === 'gm' ? -castAmt * 0.5 : -castAmt;
  // 4. shadow-weighted sensor noise: heavier where the (graded) pixel is dark
  const nm = K.noiseMono * S, nc = K.noiseChroma * S;
  // 5a. highlight roll: everything above the knee is pushed to white, the way
  //     a phone's tone map blows a window
  const knee = 255 * K.highlight;
  for (let p = 0; p < n; p += 3) {
    let r = data[p] * br, g = data[p + 1] * br, b = data[p + 2] * br;
    const L = (r * 299 + g * 587 + b * 114) / 1000;
    r = L + (r - L) * sat; g = L + (g - L) * sat; b = L + (b - L) * sat;
    r = meanL + (r - meanL) * con; g = meanL + (g - meanL) * con; b = meanL + (b - meanL) * con;
    r += cr; g += cg; b += cb;
    if (L > knee * 0.9) { const k = Math.min(1, (L - knee * 0.9) / (knee * 0.1)); r += (255 - r) * k * 0.6; g += (255 - g) * k * 0.6; b += (255 - b) * k * 0.6; }
    const lum = (r + g + b) / 3 / 255;
    const w = Math.pow(1 - Math.max(0, Math.min(1, lum)), 1.4);
    const mono = gauss() * nm;
    data[p] = clamp(Math.round(r + (mono + gauss() * nc) * w));
    data[p + 1] = clamp(Math.round(g + (mono + gauss() * nc) * w));
    data[p + 2] = clamp(Math.round(b + (mono + gauss() * nc) * w));
  }

  // 5b. hard recompress → real blocking artefacts; decoded back to PNG for the compositor
  const q = Math.round(100 - (100 - K.recompressQ) * S);
  const jpeg = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .jpeg({ quality: q, chromaSubsampling: '4:2:0', mozjpeg: false }).toBuffer();
  return sharp(jpeg).png().toBuffer();
}

/** How hard to de-slop a frame for a look. The camera-roll look is the full measured recipe. */
export function strengthFor(look) {
  return ({ phone: 1, clean: 0.7, sunlit: 0.7, none: 0.6 })[look] ?? 0.5;
}
