// Composite a slideshow `text_overlay` onto a generated image.
//
// The skill keeps typography out of the image on purpose — image models
// misspell, break kerning, and drift fonts between slides in one set. So the
// model reserves clean space and describes the text; this draws it with real
// fonts at a measured size.
//
// The hierarchy in the spec is RELATIVE (xl / l / m / s), not absolute. Fitting
// the whole block as a unit and scaling each line within it keeps the hook word
// dominant while still guaranteeing the block fits — a fixed px per size class
// would honour the hierarchy right up until the copy got one word longer.
import { loadFace } from './fonts.mjs';
import { layoutWidth, hasGlyphs } from './fit-text.mjs';
import { FACES, esc } from './styles/kit.mjs';

/** Relative scale per size class. The hook word must dominate. */
const SCALE = { xl: 1, l: 0.68, m: 0.46, s: 0.3 };

/** Weight class → a face that actually exists in the kit. */
const WEIGHT = {
  black: 'displayBlack', 'extra-bold': 'displayBlack', bold: 'sansBold',
  semibold: 'sansSemi', medium: 'sansMed', regular: 'sans', light: 'sans',
};

/** Where the block sits, as a fraction of canvas height. */
const POSITION = {
  'top': 0.05, 'upper': 0.08, 'upper-center': 0.10, 'upper-left': 0.10, 'upper-right': 0.10,
  'center': 0.36, 'middle': 0.36, 'middle-center': 0.36,
  'lower': 0.62, 'lower-center': 0.62, 'bottom': 0.70, 'bottom-center': 0.70,
  'bottom-left': 0.70, 'bottom-right': 0.70,
};

const anchorOf = (alignment, pos = '') => {
  if (alignment === 'left' || /-left$/.test(pos)) return 'start';
  if (alignment === 'right' || /-right$/.test(pos)) return 'end';
  return 'middle';
};

/**
 * @param {object} overlay  the skill's text_overlay object
 * @param {object} o        {w, h, margin, maxBlockFrac}
 * @returns {{svg:string, box:{x,y,w,h}}}
 */
export function overlaySvg(overlay, o) {
  const { w, h, margin = Math.round(w * 0.075) } = o;
  const lines = (overlay?.lines ?? []).filter((l) => l && String(l.text ?? '').trim());
  if (!lines.length) return { svg: '', box: null };

  const boxW = w - margin * 2;
  const maxBlockH = Math.round(h * (o.maxBlockFrac ?? 0.42));

  const resolved = lines.map((l) => {
    const faceKey = WEIGHT[String(l.weight ?? 'bold').toLowerCase()] ?? 'sansBold';
    const scale = SCALE[String(l.size ?? 'l').toLowerCase()] ?? SCALE.l;
    const face = loadFace(FACES[faceKey].file);
    if (!hasGlyphs(face, l.text)) throw new Error(`"${l.text}" has glyphs missing from ${FACES[faceKey].family}`);
    return { ...l, faceKey, scale, face, unit: layoutWidth(face, String(l.text), 100) / 100 };
  });

  // base size = the largest that keeps every line inside the measure AND the
  // stack inside the height budget
  const LH = 1.1, GAP = 0.16;
  const widthCap = Math.min(...resolved.map((r) => boxW / (r.unit * r.scale)));
  const heightUnit = resolved.reduce((s, r) => s + r.scale * LH, 0) + (resolved.length - 1) * GAP * 0.4;
  const base = Math.min(widthCap, maxBlockH / heightUnit, h * 0.16);

  const anchor = anchorOf(overlay.alignment, overlay.block_position);
  const ax = anchor === 'middle' ? w / 2 : anchor === 'end' ? w - margin : margin;
  const top = Math.round(h * (POSITION[String(overlay.block_position ?? 'upper-center').toLowerCase()] ?? 0.10));

  let svg = '', y = top;
  for (const r of resolved) {
    const size = Math.round(base * r.scale);
    const cap = r.face.capHeight / r.face.upm;
    y += size * cap;
    const f = FACES[r.faceKey];
    const fill = /^#[0-9a-f]{3,8}$/i.test(r.color ?? '') ? r.color : '#FFFFFF';
    const common = `font-family="${f.family}" font-weight="${f.weight}" font-size="${size}" text-anchor="${anchor}"`;
    if (r.shadow !== false && r.shadow !== undefined ? r.shadow : false) {
      // soft, offset, low contrast — the skill is explicit that this is a drop
      // shadow and not a hard outline
      svg += `<text x="${Math.round(ax + size * 0.035)}" y="${Math.round(y + size * 0.05)}" ${common} ` +
        `fill="#000000" opacity="0.34">${esc(r.text)}</text>`;
    }
    svg += `<text x="${Math.round(ax)}" y="${Math.round(y)}" ${common} fill="${fill}">${esc(r.text)}</text>`;
    y += size * (LH - cap) + size * GAP * 0.4;
  }

  return { svg, box: { x: margin, y: top, w: boxW, h: y - top } };
}
