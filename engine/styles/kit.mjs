// Shared drawing kit for style modules.
//
// A style is a renderer, not a rewrite — so the things every style needs
// (a ground, a fitted headline stack, a rule, a bullet list, a footer, a photo
// plate) live here once, and each style module spends its lines on what makes
// it that style rather than on re-solving text fitting.
//
// Everything that draws text goes through fit-text so the size is measured
// against the real font rather than guessed. A style that types a font size in
// by hand will overrun the moment the copy changes, which is the failure this
// whole engine exists to prevent.
import fs from 'node:fs';
import path from 'node:path';
import { loadFace } from '../fonts.mjs';
import { fitLines, layoutWidth, hasGlyphs, requiredLineHeight } from '../fit-text.mjs';
import { PAIRING_FACES } from '../pairings.mjs';

/* ── faces ──────────────────────────────────────────────────────────────── */

// file -> the family/weight resvg must be told to use. Subfamily naming is not
// consistent across foundries (Poppins SemiBold ships as its own family at
// weight 400), so this table is the single source of truth.
export const FACES = {
  displayBlack:   { file: 'ArchivoBlack-Regular',        family: 'Archivo Black',           weight: 400 },
  displayCond:    { file: 'ArchivoCondensed-Black',      family: 'Archivo ExtraCondensed',  weight: 900 },
  displayCondXB:  { file: 'ArchivoCondensed-ExtraBold',  family: 'Archivo ExtraCondensed',  weight: 800 },
  anton:          { file: 'Anton-Regular',               family: 'Anton',                   weight: 400 },
  sansBold:       { file: 'Archivo-Bold',                family: 'Archivo',                 weight: 700 },
  sansSemi:       { file: 'Archivo-SemiBold',            family: 'Archivo',                 weight: 600 },
  sansMed:        { file: 'Archivo-Medium',              family: 'Archivo',                 weight: 500 },
  sans:           { file: 'Archivo-Regular',             family: 'Archivo',                 weight: 400 },
  sansItalic:     { file: 'Archivo-Italic',              family: 'Archivo',                 weight: 400 },
  poppinsBold:    { file: 'Poppins-Bold',                family: 'Poppins',                 weight: 700 },
  poppinsSemi:    { file: 'Poppins-SemiBold',            family: 'Poppins SemiBold',        weight: 400 },
  serif:          { file: 'Newsreader-Regular',          family: 'Newsreader',              weight: 400 },
  serifItalic:    { file: 'Newsreader-Italic',           family: 'Newsreader',              weight: 400, style: 'italic' },
  serifSemi:      { file: 'Newsreader-SemiBold',         family: 'Newsreader',              weight: 600 },
  serifMedItalic: { file: 'Newsreader-MediumItalic',     family: 'Newsreader',              weight: 500, style: 'italic' },
  playfair:       { file: 'PlayfairDisplay-Bold',        family: 'Playfair Display',        weight: 700 },
  playfairItalic: { file: 'PlayfairDisplay-BoldItalic',  family: 'Playfair Display',        weight: 700, style: 'italic' },
  playfairBlack:  { file: 'PlayfairDisplay-Black',       family: 'Playfair Display',        weight: 900 },
  instrument:     { file: 'InstrumentSerif-Regular',     family: 'Instrument Serif',        weight: 400 },
  instrumentIt:   { file: 'InstrumentSerif-Italic',      family: 'Instrument Serif',        weight: 400, style: 'italic' },
  mono:           { file: 'JetBrainsMono-Medium',        family: 'JetBrains Mono',          weight: 500 },
  monoBold:       { file: 'JetBrainsMono-Bold',          family: 'JetBrains Mono',          weight: 700 },
  monoMed:        { file: 'JetBrainsMono-Medium',        family: 'JetBrains Mono',          weight: 500 },
  // every face a pairing can name, so a style can reference a pairing key
  // directly instead of the kit and the pairing table drifting apart
  ...PAIRING_FACES,
};

export function fontFiles(root) {
  const seen = new Set();
  return Object.values(FACES).map((f) => f.file).filter((f) => !seen.has(f) && seen.add(f))
    .map((f) => path.join(root, 'assets/fonts', `${f}.ttf`))
    .filter((p) => fs.existsSync(p));
}

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ── primitives ─────────────────────────────────────────────────────────── */

export const rect = (x, y, w, h, { r = 0, fill = '#000', op, stroke, sw } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}"` +
  `${op != null ? ` opacity="${op}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw ?? 2}"` : ''}/>`;

export const line = (x1, y1, x2, y2, { stroke = '#000', sw = 2, op } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"` +
  `${op != null ? ` opacity="${op}"` : ''}/>`;

export const circle = (cx, cy, r, { fill = '#000', op, stroke, sw } = {}) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"` +
  `${op != null ? ` opacity="${op}"` : ''}${stroke ? ` stroke="${stroke}" stroke-width="${sw ?? 2}"` : ''}/>`;

/** One line of text at an exact size. Use `stack` when the copy must fit a box. */
export function text(faceKey, x, y, s, { size = 40, fill = '#000', anchor = 'start', ls = 0, op } = {}) {
  const f = FACES[faceKey];
  if (!f) throw new Error(`unknown face "${faceKey}"`);
  return `<text x="${x}" y="${y}" font-family="${f.family}" font-weight="${f.weight}"` +
    `${f.style ? ` font-style="${f.style}"` : ''} font-size="${size}" fill="${fill}" ` +
    `text-anchor="${anchor}" letter-spacing="${ls}"${op != null ? ` opacity="${op}"` : ''}>${esc(s)}</text>`;
}

/**
 * A headline stack fitted to a box. Returns the svg plus the geometry the
 * caller needs to place whatever comes next — styles stack elements downward,
 * so every helper reports its own bottom rather than assuming a fixed step.
 */
export function stack(faceKey, lines, box, o = {}) {
  const f = FACES[faceKey];
  const face = loadFace(f.file);
  const clean = lines.filter((l) => l != null && String(l).length);
  for (const l of clean) {
    if (!hasGlyphs(face, l)) throw new Error(`"${l}" has glyphs missing from ${f.family}`);
  }
  const lineHeight = o.lineHeight ?? 1.06;
  const fit = fitLines(face, clean, box, {
    min: o.min ?? 18, max: o.max ?? 200, lineHeight,
    tracking: o.tracking ?? 0, autoLeading: o.autoLeading ?? true,
  });
  if (!fit) throw new Error(`does not fit ${box.w}x${box.h}: ${clean.join(' / ')}`);
  const lh = fit.lineHeight ?? lineHeight;
  const capRatio = face.capHeight / face.upm;
  const anchor = o.anchor ?? 'start';
  const ax = anchor === 'middle' ? box.x + box.w / 2 : anchor === 'end' ? box.x + box.w : box.x;

  let svg = '', y = box.y + fit.size * capRatio;
  const rows = [];
  for (const l of fit.lines) {
    const fill = typeof o.fill === 'function' ? o.fill(l, rows.length) : (o.fill ?? '#000');
    svg += text(faceKey, ax, Math.round(y), l, { size: fit.size, fill, anchor, ls: fit.trackingPx, op: o.op });
    rows.push({ text: l, y: Math.round(y), width: layoutWidth(face, l, fit.size) });
    y += fit.size * lh;
  }
  const height = fit.lines.length * fit.size * lh;
  return { svg, size: fit.size, lineHeight: lh, height, bottom: box.y + height, rows, widest: Math.max(...rows.map((r) => r.width)) };
}

/**
 * Body copy wrapped to a width at a fixed size, rather than fitted to a box.
 * Reading text should stay at a readable size and take the height it needs;
 * only display type scales to fill.
 */
export function paragraph(faceKey, body, x, y, w, o = {}) {
  const f = FACES[faceKey];
  const face = loadFace(f.file);
  const size = o.size ?? 30;
  const lh = Math.max(o.lineHeight ?? 1.45, requiredLineHeight(face, [body], size));
  const words = String(body).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (layoutWidth(face, next, size) > w && cur) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  let svg = '', cy = y + size * (face.capHeight / face.upm);
  for (const l of lines) {
    svg += text(faceKey, x, Math.round(cy), l, { size, fill: o.fill ?? '#111', op: o.op, anchor: o.anchor ?? 'start' });
    cy += size * lh;
  }
  return { svg, lines: lines.length, height: lines.length * size * lh, bottom: y + lines.length * size * lh };
}

/** A bullet or numbered list. Marker style is the style module's choice. */
export function list(faceKey, items, x, y, w, o = {}) {
  const size = o.size ?? 30, gap = o.gap ?? 20, indent = o.indent ?? 44;
  let svg = '', cy = y;
  items.forEach((item, i) => {
    const marker = o.marker === 'number' ? `${i + 1}.` : o.marker === 'none' ? null : (o.marker ?? '•');
    if (marker) {
      svg += text(o.markerFace ?? faceKey, x, Math.round(cy + size * 0.78), marker,
        { size: o.markerSize ?? size, fill: o.markerFill ?? o.fill ?? '#111' });
    }
    const p = paragraph(faceKey, item, x + (marker ? indent : 0), cy, w - (marker ? indent : 0),
      { size, fill: o.fill ?? '#111', lineHeight: o.lineHeight ?? 1.4 });
    svg += p.svg;
    cy = p.bottom + gap;
  });
  return { svg, bottom: cy - gap, height: cy - gap - y };
}

/**
 * A subline that might be three words or might be three sentences.
 *
 * `hook.sub` means different things to different styles — clinical treats it as
 * a standfirst, poster as a one-line aside — and the same campaign gets
 * rendered in both. So this picks a size band from the length and WRAPS, rather
 * than fitting a long paragraph down to nothing or refusing outright.
 */
export function aside(faceKey, body, x, y, w, o = {}) {
  const t = String(body);
  const size = t.length <= 46 ? (o.big ?? 46) : t.length <= 110 ? (o.mid ?? 34) : (o.small ?? 28);
  return paragraph(faceKey, t, x, y, w, { size, fill: o.fill, lineHeight: o.lineHeight ?? 1.4 });
}

/* ── photography ────────────────────────────────────────────────────────── */

/** Cover-crop a photo to the canvas (or a box) and return an <image> tag. */
export async function plate(sharp, src, w, h, cacheDir, { position } = {}) {
  // Layout maths produces fractional heights; sharp demands integers. Rounding
  // here fixes it for every style rather than at each call site.
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const key = `${path.basename(src).replace(/\.\w+$/, '')}_${w}x${h}`;
  const out = path.join(cacheDir, `_p${key}.png`);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    await sharp(src).resize(w, h, { fit: 'cover', position: position ?? sharp.strategy.attention }).png().toFile(out);
  }
  return out;
}

export const image = (file, x, y, w, h, { round, op } = {}) => {
  const ext = path.extname(file).toLowerCase() === '.png' ? 'png' : 'jpeg';
  const href = `data:image/${ext};base64,${fs.readFileSync(file).toString('base64')}`;
  const clip = round ? ` clip-path="inset(0 round ${round}px)"` : '';
  return `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" ` +
    `preserveAspectRatio="xMidYMid slice"${clip}${op != null ? ` opacity="${op}"` : ''}/>`;
};

/** A scrim so type stays legible over photography without flattening the shot. */
export const scrim = (x, y, w, h, { from = 'rgba(0,0,0,0.78)', to = 'rgba(0,0,0,0)', mid, midAt = 0.5, id = 'g', dir = 'down' } = {}) => {
  const [x1, y1, x2, y2] = dir === 'down' ? [0, 0, 0, 1] : dir === 'up' ? [0, 1, 0, 0] : [0, 0, 1, 0];
  // An optional middle stop, so a scrim can hold a floor across the band the
  // type occupies and still fade out — a two-stop gradient starting partway
  // down the frame leaves a visible hard edge where the rect begins.
  const midStop = mid ? `<stop offset="${midAt}" stop-color="${mid}"/>` : '';
  return `<defs><linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
    `<stop offset="0" stop-color="${from}"/>${midStop}<stop offset="1" stop-color="${to}"/></linearGradient></defs>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id})"/>`;
};

/** Paper grain. Flat grounds read as digital; a little tooth reads as printed. */
export const grain = (w, h, { op = 0.05, id = 'grain' } = {}) =>
  `<defs><filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>` +
  `<feColorMatrix type="saturate" values="0"/></filter></defs>` +
  `<rect width="${w}" height="${h}" filter="url(#${id})" opacity="${op}"/>`;
