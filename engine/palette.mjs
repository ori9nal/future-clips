// DRIFT brand kit + the colour maths the one-accent validator depends on.

export const BRAND = {
  name: 'DRIFT',
  handle: '@drift.sleep',
  wordmark: 'DRIFT',
  tagline: 'not another sleep tracker',
  colors: {
    ink: '#0A0E1A',      // deep night, near-black with a navy cast
    paper: '#F4F1EA',    // warm bone
    'accent-A': '#FFB020', // amber  — sunrise, waking, energy
    'accent-B': '#5B7FFF', // blue   — night, rest, depth
  },
};

export const ACCENTS = ['accent-A', 'accent-B'];

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

export const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();

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

export function labOf(hex) { const { r, g, b } = hexToRgb(hex); return rgbToLab(r, g, b); }
export function chromaOf(hex) { const [, a, b] = labOf(hex); return Math.hypot(a, b); }
export function hueOf(hex) { const [, a, b] = labOf(hex); let h = Math.atan2(b, a) * 180 / Math.PI; return h < 0 ? h + 360 : h; }
export function lightnessOf(hex) { return labOf(hex)[0]; }

/** Blend toward another colour in sRGB. t=0 -> a, t=1 -> b. */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

/** Same hue, different value — safe for gradients that must stay ONE cluster. */
export function shade(hex, amount) {
  return amount >= 0 ? mix(hex, '#FFFFFF', amount) : mix(hex, '#000000', -amount);
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Resolve a template colour token against the campaign palette.
 * Tokens: ink | paper | accent | white | black | ink-60 | accent-30 | #RRGGBB
 */
export function resolveColor(token, ctx) {
  if (!token) return ctx.ink;
  if (token.startsWith('#')) return token;
  const m = token.match(/^([a-z-]+?)(?:-(\d{1,3}))?$/);
  const base = m ? m[1] : token;
  const pct = m && m[2] ? Number(m[2]) / 100 : null;
  const table = {
    ink: ctx.ink,
    paper: ctx.paper,
    accent: ctx.accent,
    white: '#FFFFFF',
    black: '#000000',
    'accent-deep': shade(ctx.accent, -0.35),
    'accent-pale': shade(ctx.accent, 0.55),
    'ink-soft': mix(ctx.ink, ctx.paper, 0.42),
    'paper-soft': mix(ctx.paper, ctx.ink, 0.14),
  };
  const hex = table[base];
  if (!hex) throw new Error(`unknown colour token "${token}"`);
  if (pct == null) return hex;
  // "-NN" = NN% of the way from the plate colour to this colour (a tint, not alpha,
  // so the pixel histogram stays honest about how much accent is really present)
  return mix(ctx.plate ?? ctx.paper, hex, pct);
}

/** Palette bound to one accent choice. Never both accents in one carousel. */
export function makePalette(accentKey) {
  if (!ACCENTS.includes(accentKey)) throw new Error(`accent must be one of ${ACCENTS}`);
  return {
    accentKey,
    ink: BRAND.colors.ink,
    paper: BRAND.colors.paper,
    accent: BRAND.colors[accentKey],
    accentHue: hueOf(BRAND.colors[accentKey]),
  };
}

/**
 * Palette from an AGENCY-SUPPLIED brand kit rather than the built-in brand.
 *
 * This is the partner-campaign path: an agency hands over palette, logo, handle
 * and rules once, and every carousel for that campaign is bound to them. A kit
 * may declare several accents (picked per post index for divergence) or, for
 * the white/no-colour format the top performers use, an accent identical to ink
 * — which keeps the one-chromatic-cluster validator satisfied by construction
 * because there is no chromatic pixel to cluster.
 *
 * @param {{colors:{ink,paper,accent?|accents?}}} brand
 */
export function makePaletteFrom(brand, accentKey = null) {
  const c = brand?.colors;
  if (!c?.ink || !c?.paper) throw new Error('brand kit needs colors.ink and colors.paper');
  const accents = c.accents && Object.keys(c.accents).length ? c.accents : { 'accent-0': c.accent ?? c.ink };
  const keys = Object.keys(accents);
  const key = accentKey && accents[accentKey] ? accentKey : keys[0];
  const accent = accents[key];
  return {
    accentKey: key,
    ink: c.ink,
    paper: c.paper,
    accent,
    accentHue: hueOf(accent),
    // true when the kit deliberately has no colour at all — templates use this
    // to skip decorations that only make sense with an accent
    monochrome: accent.toUpperCase() === c.ink.toUpperCase(),
  };
}

export const accentKeysOf = (brand) =>
  Object.keys(brand?.colors?.accents || {}).length ? Object.keys(brand.colors.accents) : ['accent-0'];
