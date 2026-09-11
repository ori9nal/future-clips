// SCREEN WARP — composite a flat UI render into a phone screen in a real photo.
//
// A phone photographed in the hand is a plane under perspective, so pasting a
// rectangle on it reads as a sticker. This maps the UI through the homography
// that takes the unit square to the screen's four corners, then puts the
// photo's own specular reflection BACK on top of the result. That last step is
// what sells it: a real screen under gym lighting has a highlight across the
// glass, and a UI without one looks like it was pasted in — because it was.
import sharp from 'sharp';

/**
 * Unit square -> quad. Closed form (Heckbert); avoids a 8x8 solve for the
 * only case we need.
 * @param {[number,number][]} q  [TL, TR, BR, BL] in destination pixels
 */
export function unitSquareToQuad(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0; b = x2 - x1; c = x0;
    d = y1 - y0; e = y2 - y1; f = y0;
    g = 0; h = 0;
  } else {
    const den = dx1 * dy2 - dy1 * dx2;
    g = (dx3 * dy2 - dy3 * dx2) / den;
    h = (dx1 * dy3 - dy1 * dx3) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  return [a, b, c, d, e, f, g, h, 1];
}

export function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error('degenerate screen quad');
  return [
    A / det, (c * h - b * i) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, (c * d - a * f) / det,
    C / det, (b * g - a * h) / det, (a * e - b * d) / det,
  ];
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * @param {object} o
 * @param {string|Buffer} o.photo      the photograph
 * @param {string|Buffer} o.ui         the flat UI render (any size; it is sampled)
 * @param {[number,number][]} o.quad   screen corners [TL,TR,BR,BL] in photo px
 * @param {number} [o.glass=0.85]      how much of the photo's own highlight to
 *                                     re-apply over the UI (0 = none)
 * @param {number} [o.dim=0.9]         brightness of the UI once "behind glass"
 * @param {number} [o.corner=0.035]    corner rounding as a fraction of screen w
 */
export async function warpScreen({ photo, ui, quad, glass = 0.85, dim = 0.9, corner = 0.035 }) {
  const P = await sharp(photo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const U = await sharp(ui).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: PW, height: PH } = P.info;
  const { width: UW, height: UH } = U.info;
  const pd = P.data, ud = U.data;

  const M = unitSquareToQuad(quad);
  const I = invert3(M);

  // Only walk the quad's bounding box.
  const xs = quad.map((p) => p[0]), ys = quad.map((p) => p[1]);
  const x0 = clamp(Math.floor(Math.min(...xs)) - 1, 0, PW);
  const x1 = clamp(Math.ceil(Math.max(...xs)) + 1, 0, PW);
  const y0 = clamp(Math.floor(Math.min(...ys)) - 1, 0, PH);
  const y1 = clamp(Math.ceil(Math.max(...ys)) + 1, 0, PH);

  const out = Buffer.from(pd); // start from the photo, paint the screen over it

  // Luminance of the untouched screen, used two ways: to find the specular
  // highlight, and to keep the photo's falloff so the UI is not uniformly lit.
  let lumaMin = 255, lumaMax = 0;
  const luma = new Float32Array((x1 - x0) * (y1 - y0));
  const inside = new Uint8Array((x1 - x0) * (y1 - y0));

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = (y - y0) * (x1 - x0) + (x - x0);
      const w = I[6] * (x + 0.5) + I[7] * (y + 0.5) + I[8];
      const u = (I[0] * (x + 0.5) + I[1] * (y + 0.5) + I[2]) / w;
      const v = (I[3] * (x + 0.5) + I[4] * (y + 0.5) + I[5]) / w;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      inside[k] = 1;
      const p = (y * PW + x) * 4;
      const L = 0.2126 * pd[p] + 0.7152 * pd[p + 1] + 0.0722 * pd[p + 2];
      luma[k] = L;
      if (L < lumaMin) lumaMin = L;
      if (L > lumaMax) lumaMax = L;
    }
  }
  const span = Math.max(1, lumaMax - lumaMin);

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const k = (y - y0) * (x1 - x0) + (x - x0);
      if (!inside[k]) continue;
      const w = I[6] * (x + 0.5) + I[7] * (y + 0.5) + I[8];
      const u = (I[0] * (x + 0.5) + I[1] * (y + 0.5) + I[2]) / w;
      const v = (I[3] * (x + 0.5) + I[4] * (y + 0.5) + I[5]) / w;

      // Rounded screen corners, measured in UV with the aspect corrected so the
      // radius is not an ellipse on a tall screen.
      const ar = UW / UH;
      const rx = corner, ry = corner * ar;
      const cu = u < rx ? rx : u > 1 - rx ? 1 - rx : u;
      const cv = v < ry ? ry : v > 1 - ry ? 1 - ry : v;
      const ddx = (u - cu) / rx, ddy = (v - cv) / ry;
      const d2 = ddx * ddx + ddy * ddy;
      let cov = 1;
      if (d2 > 1) continue;
      if (d2 > 0.64) cov = clamp((1 - Math.sqrt(d2)) / 0.2, 0, 1);

      // bilinear sample of the UI
      const sx = clamp(u * (UW - 1), 0, UW - 1), sy = clamp(v * (UH - 1), 0, UH - 1);
      const ix = Math.floor(sx), iy = Math.floor(sy);
      const fx = sx - ix, fy = sy - iy;
      const ix1 = Math.min(ix + 1, UW - 1), iy1 = Math.min(iy + 1, UH - 1);
      const s00 = (iy * UW + ix) * 4, s10 = (iy * UW + ix1) * 4;
      const s01 = (iy1 * UW + ix) * 4, s11 = (iy1 * UW + ix1) * 4;
      const px = (y * PW + x) * 4;

      // The photo's own light: normalised so the dark end of the screen stays
      // dark. Without this the UI is evenly lit and the phone looks flat.
      const shade = dim * (0.72 + 0.5 * ((luma[k] - lumaMin) / span));
      // Specular: only the top of the range is treated as reflection.
      const spec = glass * Math.max(0, (luma[k] - lumaMin) / span - 0.42) / 0.58;

      // The reflection is applied NEUTRAL, and damped where the photo pixel is
      // saturated. A specular highlight off glass is the colour of the room's
      // light, not of whatever the screen happened to be showing — blending the
      // photo's own channels pulled the original screen content back through
      // the new UI as a coloured smear.
      const pr = pd[px], pg = pd[px + 1], pb = pd[px + 2];
      const mx = Math.max(pr, pg, pb), mn = Math.min(pr, pg, pb);
      const sat = mx > 8 ? (mx - mn) / mx : 0;
      const highlight = luma[k] * spec * clamp(1 - sat * 2.4, 0, 1);

      for (let ch = 0; ch < 3; ch++) {
        const a0 = ud[s00 + ch] * (1 - fx) + ud[s10 + ch] * fx;
        const a1 = ud[s01 + ch] * (1 - fx) + ud[s11 + ch] * fx;
        let val = (a0 * (1 - fy) + a1 * fy) * shade;
        val = 255 - ((255 - val) * (255 - highlight)) / 255;   // screen blend
        out[px + ch] = clamp(Math.round(val * cov + pd[px + ch] * (1 - cov)), 0, 255);
      }
    }
  }

  return sharp(out, { raw: { width: PW, height: PH, channels: 4 } });
}

/**
 * Where a point on the UI lands in the photograph. Callout leader lines are
 * drawn from this, so a label that says "readiness 61" points at the actual
 * ring rather than at a spot someone eyeballed once and never re-checked.
 * @param {[number,number][]} quad
 * @param {number} u 0..1 across the UI   @param {number} v 0..1 down the UI
 */
export function projectUV(quad, u, v) {
  const M = unitSquareToQuad(quad);
  const w = M[6] * u + M[7] * v + M[8];
  return [(M[0] * u + M[1] * v + M[2]) / w, (M[3] * u + M[4] * v + M[5]) / w];
}

/** Draw the quad on the photo so a human can check it before committing. */
export async function debugQuad(photo, quad, file) {
  const pts = quad.map((p) => p.join(',')).join(' ');
  const meta = await sharp(photo).metadata();
  const svg = `<svg width="${meta.width}" height="${meta.height}">
    <polygon points="${pts}" fill="none" stroke="#00ff88" stroke-width="3"/>
    ${quad.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="#00ff88"/>
      <text x="${p[0] + 10}" y="${p[1] - 8}" fill="#00ff88" font-size="20" font-family="monospace">${'TL TR BR BL'.split(' ')[i]}</text>`).join('')}
  </svg>`;
  await sharp(photo).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toFile(file);
}
