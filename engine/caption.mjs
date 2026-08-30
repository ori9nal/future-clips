// NATIVE CAPTIONS — the CapCut/TikTok caption, rendered properly.
//
// This is the format the gym niche actually runs, and it is deliberately NOT
// designed: a full-bleed photo off someone's phone, and white bold sans with a
// heavy black stroke sitting straight on top of it, centred. No colour blocks,
// no grid, no editorial typography. A carousel that looks designed reads as an
// ad and gets scrolled; one that looks like a person posting gets read.
//
// Three things have to be right or it stops looking native:
//
//  1. The stroke is painted BEHIND the fill. SVG's default is stroke over fill,
//     which eats into the letterforms and thickens the face — `paint-order`
//     fixes it, and without it a 14px stroke turns Poppins Bold into a blob.
//  2. Stroke width scales with the type size. A fixed stroke looks correct at
//     one size and wrong everywhere else.
//  3. Lines are centred individually, and the block sits where the picture is
//     quiet, not at a fixed y.
import { fitLines, layoutWidth, hasGlyphs } from './fit-text.mjs';

/**
 * One caption block: pre-broken lines, centred, stroked.
 *
 * @param {object} face      loaded face (fonts.mjs)
 * @param {string[]} lines   editorial line breaks — captions are hand-broken,
 *                           not wrapped, exactly as the reference sets are
 * @param {object} box       {x,y,w,h} the block must fit inside
 * @param {object} o
 * @param {string} o.family  SVG font-family
 * @param {number} o.weight
 * @param {number} [o.max]   max px size
 * @param {number} [o.strokeRatio=0.155]  stroke width as a fraction of size
 * @param {string} [o.fill='#FFFFFF']
 * @param {string} [o.stroke='#000000']
 * @param {number} [o.lineHeight=1.14]
 */
export function captionBlock(face, lines, box, o = {}) {
  const clean = lines.filter((l) => l != null && String(l).length);
  for (const l of clean) {
    if (!hasGlyphs(face, l)) throw new Error(`caption "${l}" has glyphs missing from ${o.family}`);
  }
  // autoLeading, not a fixed line height. Poppins' ascender+descender is about
  // 1.4em, so the flat collision check rejected EVERY size at the 1.14 leading
  // these captions want — the block simply reported "does not fit". autoLeading
  // measures the actual ink of these lines and lifts the leading only as far as
  // they need, which for caption case is barely at all.
  const lineHeight = o.lineHeight ?? 1.14;
  const ratio = o.strokeRatio ?? 0.155;

  // The stroke paints OUTSIDE the glyph, so a block sized to exactly fill the
  // box overruns it by one stroke width. Rejecting that (the first version)
  // threw on a 3px overrun after the fitter had done its job. Reserve the
  // stroke instead and re-fit: the reservation depends on the size, and the
  // size depends on the reservation, so iterate until it settles.
  let fit = null, sw = 0, pad = 0;
  for (let i = 0; i < 4; i++) {
    const f = fitLines(face, clean, { ...box, w: box.w - pad }, {
      min: o.min ?? 30, max: o.max ?? 96, lineHeight, tracking: 0, autoLeading: true,
    });
    if (!f) break;
    const s = f.size * ratio;
    const widest = Math.max(...f.lines.map((l) => layoutWidth(face, l, f.size)));
    if (widest + s <= box.w) { fit = f; sw = +s.toFixed(2); break; }
    pad = Math.ceil(s) + 2;
  }
  if (!fit) throw new Error(`caption does not fit: ${clean.join(' / ')}`);
  const lh = fit.lineHeight ?? lineHeight;

  const cx = box.x + box.w / 2;
  const capRatio = face.capHeight / face.upm;
  let y = box.y + fit.size * capRatio + sw / 2;
  let out = '';
  for (const line of fit.lines) {
    const esc = String(line).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // paint-order puts the stroke behind the fill; without it the stroke eats
    // into the letterform and the weight reads far heavier than the face is
    out += `<text x="${cx}" y="${Math.round(y)}" text-anchor="middle" ` +
      `font-family="${o.family}" font-weight="${o.weight}" font-size="${fit.size}" ` +
      `fill="${o.fill ?? '#FFFFFF'}" stroke="${o.stroke ?? '#000000'}" stroke-width="${sw}" ` +
      `stroke-linejoin="round" paint-order="stroke fill">${esc}</text>`;
    y += fit.size * lh;
  }
  return { svg: out, size: fit.size, stroke: sw, lineHeight: lh, height: fit.lines.length * fit.size * lh, bottom: y };
}

/**
 * Pick where a caption block goes: the quietest band of the picture that is not
 * across the subject's face.
 *
 * Native captions sit in whatever gap the photo happens to leave — sky above a
 * head, floor below the feet, the dark half of a gym. Scoring bands beats a
 * fixed y, which lands on a face as soon as the next photo is framed
 * differently.
 *
 * @returns {Array} bands scored, quietest first
 */
export async function captionBands(img, { w, h, sharp, bands = 7, margin = 64, avoid = [] }) {
  const S = 160, sh = Math.round((S * h) / w);
  const { data, info } = await sharp(img).resize(S, sh, { fit: 'fill' })
    .greyscale().raw().toBuffer({ resolveWithObject: true });

  const out = [];
  const bandH = Math.round((h * 0.74) / bands);
  for (let i = 0; i < bands; i++) {
    const by = Math.round(h * 0.06) + i * bandH;
    if (avoid.some((a) => by < a.y + a.h && a.y < by + bandH)) continue;
    const y0 = Math.max(0, Math.floor((by / h) * info.height));
    const y1 = Math.min(info.height, Math.ceil(((by + bandH) / h) * info.height));
    const vals = [];
    for (let y = y0; y < y1; y++) for (let x = 0; x < info.width; x++) vals.push(data[y * info.width + x]);
    if (!vals.length) continue;
    vals.sort((a, b) => a - b);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const p10 = vals[Math.floor(vals.length * 0.1)];
    const p90 = vals[Math.floor(vals.length * 0.9)];
    // A stroked caption survives almost any ground; what actually hurts is
    // BUSY ground. Range beats brightness as the measure of busy.
    out.push({ x: margin, y: by, w: w - margin * 2, h: bandH, mean: +mean.toFixed(1), range: p90 - p10, score: p90 - p10 });
  }
  return out.sort((a, b) => a.score - b.score);
}
