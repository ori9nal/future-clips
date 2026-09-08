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
 * Break one string into lines that fit a measure at a given size.
 *
 * Caption copy is normally hand-broken, but generated copy arrives as
 * sentences — and a CTA written as a full sentence cannot fit one stroked line
 * at any readable size. Rather than refuse it, re-break it: greedy wrap, then
 * even out the last line so the block does not end on a single orphan word.
 */
export function breakToFit(face, s, width, size, { max = 3 } = {}) {
  const words = String(s).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (layoutWidth(face, next, size) > width && cur) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  // pull a word back from the penultimate line when the last is an orphan
  if (lines.length > 1 && lines[lines.length - 1].split(' ').length === 1) {
    const prev = lines[lines.length - 2].split(' ');
    if (prev.length > 2) {
      const moved = prev.pop();
      lines[lines.length - 2] = prev.join(' ');
      lines[lines.length - 1] = `${moved} ${lines[lines.length - 1]}`;
    }
  }
  return lines.slice(0, max);
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
/**
 * Score one rectangle of the picture: how busy it is, and how much of it is
 * skin. Used to place a caption over the area it will ACTUALLY occupy.
 *
 * Scoring fixed-height bands and then letting the text block grow past the
 * band was the bug: a band only guaranteed its own 158px were quiet, so a
 * three-line hook anchored in a quiet strip above a head still landed across
 * the face below it.
 */
export async function scoreRegion(img, { w, h, sharp, rect, skinWeight = 260 }) {
  const S = 160, sh = Math.round((S * h) / w);
  const { data, info } = await sharp(img).resize(S, sh, { fit: 'fill' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return scoreRect(data, info, { w, h }, rect, skinWeight);
}

function scoreRect(data, info, frame, rect, skinWeight) {
  const x0 = Math.max(0, Math.floor((rect.x / frame.w) * info.width));
  const x1 = Math.min(info.width, Math.ceil(((rect.x + rect.w) / frame.w) * info.width));
  const y0 = Math.max(0, Math.floor((rect.y / frame.h) * info.height));
  const y1 = Math.min(info.height, Math.ceil(((rect.y + rect.h) / frame.h) * info.height));
  const lum = [];
  let skin = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const p = (y * info.width + x) * 3;
      const r = data[p], g = data[p + 1], b = data[p + 2];
      lum.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
      n++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (r > 95 && g > 40 && b > 20 && mx - mn > 15 && Math.abs(r - g) > 15 && r > g && r > b) skin++;
    }
  }
  if (!n) return { range: 255, skin: 1, mean: 128, score: 1e6 };
  lum.sort((a, b) => a - b);
  const p10 = lum[Math.floor(lum.length * 0.1)], p90 = lum[Math.floor(lum.length * 0.9)];
  const skinShare = skin / n;
  // `mean` is returned as well as the spread. Callers that decide how dark a
  // scrim needs to be want average brightness, not contrast range — and two
  // styles were silently falling back to a default 128 because it was missing.
  const mean = lum.reduce((s, v) => s + v, 0) / lum.length;
  return {
    range: Math.round(p90 - p10), skin: +skinShare.toFixed(3), mean: +mean.toFixed(1),
    score: +((p90 - p10) + skinShare * skinWeight).toFixed(1),
  };
}

/** Slide a window of a known height through a zone and rank the positions. */
export async function placementsFor(img, { w, h, sharp, zone, blockH, margin = 64, step = 40, avoid = [], skinWeight = 260 }) {
  const S = 160, sh = Math.round((S * h) / w);
  const { data, info } = await sharp(img).resize(S, sh, { fit: 'fill' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = [];
  const last = zone[1] - blockH;
  for (let y = zone[0]; y <= last; y += step) {
    const rect = { x: margin, y, w: w - margin * 2, h: blockH };
    if (avoid.some((a) => rect.y < a.y + a.h && a.y < rect.y + rect.h)) continue;
    out.push({ ...rect, ...scoreRect(data, info, { w, h }, rect, skinWeight) });
  }
  return out.sort((a, b) => a.score - b.score);
}

export async function captionBands(img, { w, h, sharp, bands = 7, margin = 64, avoid = [], skinWeight = 260 }) {
  const S = 160, sh = Math.round((S * h) / w);
  const { data, info } = await sharp(img).resize(S, sh, { fit: 'fill' })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });

  const out = [];
  const bandH = Math.round((h * 0.74) / bands);
  for (let i = 0; i < bands; i++) {
    const by = Math.round(h * 0.06) + i * bandH;
    if (avoid.some((a) => by < a.y + a.h && a.y < by + bandH)) continue;
    const y0 = Math.max(0, Math.floor((by / h) * info.height));
    const y1 = Math.min(info.height, Math.ceil(((by + bandH) / h) * info.height));
    const lum = [];
    let skin = 0, n = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < info.width; x++) {
        const p = (y * info.width + x) * 3;
        const r = data[p], g = data[p + 1], b = data[p + 2];
        lum.push(0.2126 * r + 0.7152 * g + 0.0722 * b);
        n++;
        // Classic RGB skin rule. Crude, but a caption across someone's face is
        // the one placement that always looks wrong, and busy-ness alone cannot
        // see it — a face in flat light is one of the QUIETEST bands there is,
        // which is exactly how the money set put its hook across a man's eyes.
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        if (r > 95 && g > 40 && b > 20 && mx - mn > 15 && Math.abs(r - g) > 15 && r > g && r > b) skin++;
      }
    }
    if (!n) continue;
    lum.sort((a, b) => a - b);
    const mean = lum.reduce((s, v) => s + v, 0) / lum.length;
    const p10 = lum[Math.floor(lum.length * 0.1)];
    const p90 = lum[Math.floor(lum.length * 0.9)];
    const skinShare = skin / n;
    // A stroked caption survives almost any ground; what hurts is BUSY ground,
    // and what looks careless is a face. Range measures busy, skin measures face.
    const score = (p90 - p10) + skinShare * skinWeight;
    out.push({
      x: margin, y: by, w: w - margin * 2, h: bandH,
      mean: +mean.toFixed(1), range: Math.round(p90 - p10),
      skin: +skinShare.toFixed(3), score: +score.toFixed(1),
    });
  }
  return out.sort((a, b) => a.score - b.score);
}
