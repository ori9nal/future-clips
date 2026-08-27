// fitText — the piece that decides whether output looks designed or looks generated.
//
// Real hmtx advance widths + kern pairs via opentype.js. Greedy word wrap at a
// candidate size. Binary search for the largest size in [min,max] whose wrapped
// block fits the box, with a descending linear sweep as a correctness backstop
// (wrap height is not strictly monotone in size once maxLines is in play).
//
// Returns null when nothing fits. Callers MUST regenerate shorter copy on null.
// Nothing here ever silently shrinks below `min` or lets a line exceed the box.

/** Advance width of one codepoint in font units, memoised on the face. */
function advanceOf(face, cp) {
  let a = face.adv.get(cp);
  if (a !== undefined) return a;
  const g = face.ot.charToGlyph(String.fromCodePoint(cp));
  a = g && g.advanceWidth != null ? g.advanceWidth : face.upm * 0.5;
  face.adv.set(cp, a);
  face.glyphOf.set(cp, g);
  return a;
}

function glyphOf(face, cp) {
  if (!face.glyphOf.has(cp)) advanceOf(face, cp);
  return face.glyphOf.get(cp);
}

/**
 * Width of a single line in px — sum of hmtx advances plus kern pairs.
 * @param letterSpacingPx absolute px added after every glyph except the last
 */
export function measureLine(face, text, size, letterSpacingPx = 0) {
  if (!text) return 0;
  const cps = [...text].map((c) => c.codePointAt(0));
  let units = 0;
  for (let i = 0; i < cps.length; i++) {
    units += advanceOf(face, cps[i]);
    if (i + 1 < cps.length) {
      const k = face.ot.getKerningValue(glyphOf(face, cps[i]), glyphOf(face, cps[i + 1]));
      if (k) units += k;
    }
  }
  return (units * size) / face.upm + letterSpacingPx * Math.max(0, cps.length - 1);
}

/**
 * Ink that escapes the advance box. Italic and swash faces paint past the
 * advance width of the final glyph and left of the origin on the first; measured
 * calibration showed Archivo Expanded 800 italic rendering 1.5% wider than its
 * advance sum. Real glyph bounding boxes close that gap exactly.
 */
export function inkOverhang(face, text, size) {
  const chars = [...String(text)].filter((c) => !/\s/.test(c));
  if (!chars.length) return { left: 0, right: 0 };
  const bboxOf = (ch) => {
    let e = face.bbox?.get(ch);
    if (e !== undefined) return e;
    if (!face.bbox) face.bbox = new Map();
    const g = face.ot.charToGlyph(ch);
    try {
      const b = g.getBoundingBox();
      e = { x1: b.x1, x2: b.x2, adv: g.advanceWidth ?? face.upm * 0.5 };
    } catch { e = { x1: 0, x2: 0, adv: g?.advanceWidth ?? face.upm * 0.5 }; }
    face.bbox.set(ch, e);
    return e;
  };
  const first = bboxOf(chars[0]);
  const last = bboxOf(chars[chars.length - 1]);
  return {
    left: (Math.max(0, -first.x1) * size) / face.upm,
    right: (Math.max(0, last.x2 - last.adv) * size) / face.upm,
  };
}

/**
 * The width fitText must respect: advance sum, plus escaping ink on both ends,
 * plus one extra letter-space (CSS emits letter-spacing after the final glyph
 * too, which widens satori's layout box even though it paints no ink).
 */
export function layoutWidth(face, text, size, letterSpacingPx = 0) {
  const o = inkOverhang(face, text, size);
  return measureLine(face, text, size, letterSpacingPx) + o.left + o.right + Math.abs(letterSpacingPx);
}

/** True when every codepoint in `text` has a real glyph in this face. */
export function hasGlyphs(face, text) {
  for (const ch of text) {
    if (/\s/.test(ch)) continue;
    const g = face.ot.charToGlyph(ch);
    if (!g || g.index === 0) return false;
  }
  return true;
}

/**
 * Greedy word wrap. Honours hard "\n" breaks. Returns null if any single word
 * is wider than the box (an unbreakable overflow — the caller must shorten copy).
 */
export function wrapText(face, text, size, maxWidth, letterSpacingPx = 0) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let cur = '';
    for (const word of words) {
      if (layoutWidth(face, word, size, letterSpacingPx) > maxWidth) return null; // unbreakable
      const cand = cur ? `${cur} ${word}` : word;
      if (layoutWidth(face, cand, size, letterSpacingPx) <= maxWidth) cur = cand;
      else { out.push(cur); cur = word; }
    }
    out.push(cur);
  }
  return out;
}

/**
 * Attach the numbers layout needs to place PAINTED ink rather than layout boxes:
 *   inkLeft/inkRight  how far glyphs escape the advance box horizontally
 *   paintedHeight     real vertical extent from the face's ascender/descender,
 *                     which exceeds the line box whenever lineHeight < 1
 */
function decorate(fit, face) {
  let l = 0, r = 0;
  for (const line of fit.lines) {
    const o = inkOverhang(face, line, fit.size);
    if (o.left > l) l = o.left;
    if (o.right > r) r = o.right;
  }
  fit.inkLeft = l;
  fit.inkRight = r;

  // Vertical extent from REAL glyph bounding boxes, not from the face's ascender
  // and descender. Those metrics reserve room for diacritics the copy never uses,
  // which inflates every block by ~30% and makes gaps that are visually fine read
  // as collisions. Baseline placement mirrors satori: the (ascent+descent) box is
  // centred inside each line box of height size*lineHeight.
  const upm = face.upm, size = fit.size;
  const asc = (face.ascender / upm) * size;
  const desc = (-face.descender / upm) * size;
  const halfLead = (size * fit.lineHeight - (asc + desc)) / 2;
  const first = verticalInk(face, fit.lines[0], size);
  const last = verticalInk(face, fit.lines[fit.lines.length - 1], size);
  const baseline0 = halfLead + asc;
  const baselineN = (fit.lines.length - 1) * size * fit.lineHeight + halfLead + asc;
  fit.inkTop = baseline0 - first.above;          // px from the block's top edge
  fit.inkBottom = baselineN + last.below;        // px from the block's top edge
  fit.paintedHeight = Math.max(1, fit.inkBottom - fit.inkTop);
  return fit;
}

/**
 * Negative leading is a poster idiom, but it is only safe when the lines have no
 * ink to collide. Round 3 rendered a lowercase claim at lineHeight 0.94 and the
 * descenders of one line crossed the ascenders of the next. This checks the real
 * ink of each adjacent pair, so all-caps can still be set tight while mixed-case
 * cannot be set tighter than its own glyphs allow.
 */
export function linesCrash(face, lines, size, lineHeight, minGap = 1) {
  return requiredLineHeight(face, lines, size, minGap) > lineHeight + 1e-9;
}

/**
 * The tightest leading these exact lines can take without their ink touching.
 * A designer setting a stack tight opens the leading just far enough for the one
 * pair that needs it; `autoLeading` does the same, so all-caps keeps its poster
 * stack while a lowercase line with a descender gets the room it actually needs.
 */
export function requiredLineHeight(face, lines, size, minGap = 1) {
  if (lines.length < 2) return 0;
  let need = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const below = verticalInk(face, lines[i], size).below;
    const above = verticalInk(face, lines[i + 1], size).above;
    need = Math.max(need, (below + above + minGap) / size);
  }
  return need;
}

/** Ink above and below the baseline for one line, from glyph bounding boxes. */
export function verticalInk(face, text, size) {
  if (!face.vbox) face.vbox = new Map();
  let above = 0, below = 0;
  for (const ch of String(text || '')) {
    if (/\s/.test(ch)) continue;
    let e = face.vbox.get(ch);
    if (e === undefined) {
      const g = face.ot.charToGlyph(ch);
      try { const b = g.getBoundingBox(); e = { y1: b.y1, y2: b.y2 }; }
      catch { e = { y1: 0, y2: face.capHeight }; }
      face.vbox.set(ch, e);
    }
    if (e.y2 > above) above = e.y2;
    if (-e.y1 > below) below = -e.y1;
  }
  if (!above && !below) { above = face.capHeight; below = 0; }
  return { above: (above / face.upm) * size, below: (below / face.upm) * size };
}

/**
 * @param {object} face      from fonts.resolveFace()
 * @param {string} text
 * @param {{w:number,h:number}} box
 * @param {object} opts
 *   min, max        integer px bounds (inclusive)
 *   lineHeight      unitless multiplier; block height = lines * size * lineHeight
 *   tracking        letter-spacing as a fraction of the em (e.g. -0.02, 0.14)
 *   maxLines        hard cap on wrapped line count
 * @returns {null | {size, lines, width, height, lineHeight, tracking, trackingPx}}
 */
export function fitText(face, text, box, opts = {}) {
  const min = Math.max(1, Math.floor(opts.min ?? 16));
  const max = Math.max(min, Math.floor(opts.max ?? 120));
  const lineHeight = opts.lineHeight ?? 1.0;
  const tracking = opts.tracking ?? 0;
  const maxLines = opts.maxLines ?? Infinity;
  if (!text || !String(text).trim()) return null;

  const attempt = (size) => {
    const lsPx = tracking * size;
    const lines = wrapText(face, text, size, box.w, lsPx);
    if (!lines) return null;
    if (lines.length > maxLines) return null;
    const lh = opts.autoLeading
      ? Math.max(lineHeight, requiredLineHeight(face, lines, size))
      : lineHeight;
    if (!opts.autoLeading && linesCrash(face, lines, size, lineHeight)) return null;
    const lineHeightUsed = lh;
    const height = lines.length * size * lineHeightUsed;
    if (height > box.h) return null;
    const width = Math.max(...lines.map((l) => layoutWidth(face, l, size, lsPx)));
    if (width > box.w) return null;
    return decorate({ size, lines, width, height, lineHeight: lineHeightUsed, tracking, trackingPx: lsPx,
      paraLast: lines.paraLast }, face);
  };

  // primary: binary search for the largest fitting size
  let lo = min, hi = max, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = attempt(mid);
    if (r) { best = r; lo = mid + 1; } else hi = mid - 1;
  }
  if (best) return best;

  // backstop: wrap height vs size is not strictly monotone when maxLines bites,
  // so a failed binary search is not proof that nothing fits. Sweep down.
  for (let s = max; s >= min; s--) {
    const r = attempt(s);
    if (r) return r;
  }
  return null; // caller regenerates shorter copy — we never ship overflow
}

/**
 * Fit a fixed number of pre-broken lines (used by stacked-caps poster layouts
 * where the line breaks are editorial decisions, not wrapping outcomes).
 */
export function fitLines(face, lines, box, opts = {}) {
  const min = Math.max(1, Math.floor(opts.min ?? 16));
  const max = Math.max(min, Math.floor(opts.max ?? 200));
  const lineHeight = opts.lineHeight ?? 0.88;
  const tracking = opts.tracking ?? 0;
  const clean = lines.filter((l) => l != null && String(l).length);
  if (!clean.length) return null;

  const attempt = (size) => {
    const lsPx = tracking * size;
    const lh = opts.autoLeading
      ? Math.max(lineHeight, requiredLineHeight(face, clean, size))
      : lineHeight;
    if (!opts.autoLeading && linesCrash(face, clean, size, lineHeight)) return null;
    const width = Math.max(...clean.map((l) => layoutWidth(face, l, size, lsPx)));
    const height = clean.length * size * lh;
    if (width > box.w || height > box.h) return null;
    return decorate({ size, lines: clean, width, height, lineHeight: lh, tracking, trackingPx: lsPx }, face);
  };

  let lo = min, hi = max, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = attempt(mid);
    if (r) { best = r; lo = mid + 1; } else hi = mid - 1;
  }
  return best;
}

/** Axis-aligned rectangle overlap, with an allowance for intentional tucking. */
export function rectsOverlap(a, b, tolerance = 0) {
  return (
    a.x < b.x + b.w - tolerance &&
    b.x < a.x + a.w - tolerance &&
    a.y < b.y + b.h - tolerance &&
    b.y < a.y + a.h - tolerance
  );
}

/** Area of the intersection of two rects (0 when disjoint). */
export function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}
