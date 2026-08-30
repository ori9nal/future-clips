// NOON — SPF, honestly. A skincare teaching carousel.
//
// Deliberately the opposite of the gym set on every axis that was called out:
// bright rather than near-black, a different colour ground on every frame, and
// six different compositions rather than one layout repeated six times. The
// design language is editorial collage — hard-cut photographic shapes on flat
// colour, oversized grotesque shouting, a high-contrast serif italic answering
// it. Nothing here is a chart pretending to be a picture.
//
// Photography is masked into geometry rather than matted. Matting these frames
// was tried and rejected: every candidate failed the translucency gate at
// 0.20-0.97 against a 0.06 limit — bright skin against a bright background
// gives the model no edge to find, and the results were see-through. A hard cut
// shape is what collage actually is, and it is exact.
//
// The teaching is standard public sunscreen guidance — the 2 mg/cm² testing
// dose, the two-finger rule, FDA water-resistance labelling, the commonly
// missed areas. The brand is fictional and makes no claim of its own.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { loadFace } from '../../engine/fonts.mjs';
import { fitLines, fitText, layoutWidth, hasGlyphs } from '../../engine/fit-text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FACES = path.join(ROOT, 'output/skin/face');
const OUT = path.join(ROOT, 'output/noon');

export const W = 1080, H = 1350;

export const C = {
  paper: '#FBF8F2', ink: '#141210',
  sun: '#FFC93C', blue: '#2D5BFF', pink: '#FF4F8B', mint: '#7FE0C0',
};

export const CAMPAIGN = {
  brand: 'NOON', product: 'daily SPF 50', handle: '@noon.spf',
  rules: { required_mention: '@noon.spf', banned_claims: ['guaranteed', 'waterproof', 'sunblock', 'all day protection'] },
  credit: 'Photography: Pexels',
};

/* ── type ───────────────────────────────────────────────────────────────── */

const FACE = {
  shout:  { file: 'BricolageGrotesque-ExtraBold', family: 'Bricolage Grotesque 96pt', weight: 800 },
  shoutB: { file: 'BricolageGrotesque-Bold',      family: 'Bricolage Grotesque 96pt', weight: 700 },
  body:   { file: 'BricolageGrotesque-Medium',    family: 'Bricolage Grotesque',      weight: 500 },
  serif:  { file: 'InstrumentSerif-Regular',      family: 'Instrument Serif',         weight: 400 },
  serifI: { file: 'InstrumentSerif-Italic',       family: 'Instrument Serif',         weight: 400, style: 'italic' },
  mono:   { file: 'JetBrainsMono-Bold',           family: 'JetBrains Mono',           weight: 700 },
};
const faceOf = (k) => loadFace(FACE[k].file);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function T(kind, x, y, s, { size = 30, fill = C.ink, anchor = 'start', ls = 0, op = 1, rot = 0 } = {}) {
  const f = FACE[kind];
  // A glyph the face does not have makes resvg fall the ENTIRE run back to the
  // default family, with no warning. Instrument Serif has no superscript two,
  // so "2 mg/cm^2" silently rendered in the grotesque next to a serif sibling.
  if (!hasGlyphs(faceOf(kind), s)) {
    throw new Error(`"${s}" has glyphs missing from ${f.family} — it would silently fall back`);
  }
  const tr = rot ? ` transform="rotate(${rot} ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}" font-family="${f.family}" font-weight="${f.weight}"` +
    `${f.style ? ` font-style="${f.style}"` : ''} font-size="${size}" fill="${fill}" ` +
    `text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}"${tr}>${esc(s)}</text>`;
}

const R = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

function stack(kind, lines, box, opts = {}) {
  const face = faceOf(kind);
  const fit = fitLines(face, lines, box, { min: 24, max: opts.max ?? 220, lineHeight: opts.lineHeight ?? 0.9, tracking: opts.tracking ?? -0.01 });
  if (!fit) throw new Error(`${kind} headline does not fit: ${lines.join(' / ')}`);
  let out = '', y = box.y + fit.size * (face.capHeight / face.upm);
  for (const line of fit.lines) {
    const x = opts.anchor === 'middle' ? box.x + box.w / 2 : opts.anchor === 'end' ? box.x + box.w : box.x;
    out += T(kind, x, Math.round(y), line, { size: fit.size, fill: opts.fill ?? C.ink, anchor: opts.anchor ?? 'start', ls: fit.trackingPx });
    y += fit.size * fit.lineHeight;
  }
  return { svg: out, size: fit.size, bottom: y - fit.size * fit.lineHeight + fit.size * 0.28 };
}

function para(kind, text, box, opts = {}) {
  const face = faceOf(kind);
  const fit = fitText(face, text, box, { min: opts.min ?? 20, max: opts.max ?? 34, lineHeight: opts.lineHeight ?? 1.34, tracking: 0 });
  if (!fit) throw new Error(`${kind} body does not fit: ${text.slice(0, 46)}`);
  let out = '', y = box.y + fit.size * (face.capHeight / face.upm);
  for (const line of fit.lines) {
    out += T(kind, box.x, Math.round(y), line, { size: fit.size, fill: opts.fill ?? C.ink, op: opts.op ?? 1 });
    y += fit.size * fit.lineHeight;
  }
  return { svg: out, size: fit.size, bottom: y };
}

/** Assert a laid-out block clears a limit rather than shipping the overflow. */
function fits(bottom, limit, what) {
  if (bottom > limit) throw new Error(`${what} overflows: ${Math.round(bottom)} > ${limit}`);
  return bottom;
}

/**
 * Assert a text box does not sit under something opaque. fitText guarantees the
 * copy fits its own box and says nothing about what else is on the slide — so a
 * paragraph ran happily underneath a photograph, losing the end of every line.
 */
function clearOf(box, obstacles, what) {
  for (const o of obstacles) {
    if (box.x < o.x + o.w && o.x < box.x + box.w && box.y < o.y + o.h && o.y < box.y + box.h) {
      throw new Error(`${what} overlaps an element at ${o.x},${o.y} ${o.w}x${o.h}`);
    }
  }
  return box;
}

/* ── collage furniture ──────────────────────────────────────────────────── */

let uid = 0;

/**
 * Photography cut into a shape. Collage cuts hard edges; that is the whole
 * look, and unlike matting it cannot half-fail.
 */
function photo(file, shape, x, y, w, h, { rot = 0 } = {}) {
  const id = `c${++uid}`;
  let d;
  if (shape === 'circle') d = `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) / 2}"/>`;
  else if (shape === 'arch') d = `<path d="M ${x} ${y + w / 2} a ${w / 2} ${w / 2} 0 0 1 ${w} 0 L ${x + w} ${y + h} L ${x} ${y + h} Z"/>`;
  else if (shape === 'angle') d = `<path d="M ${x} ${y + 54} L ${x + w} ${y} L ${x + w} ${y + h - 54} L ${x} ${y + h} Z"/>`;
  else d = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${shape === 'soft' ? 26 : 0}"/>`;
  const tr = rot ? ` transform="rotate(${rot} ${x + w / 2} ${y + h / 2})"` : '';
  return `<defs><clipPath id="${id}">${d}</clipPath></defs>` +
    `<g clip-path="url(#${id})"${tr}><image href="data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}" ` +
    `x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/></g>`;
}

/** A field of dots. Used as data, not decoration — the dose comparison. */
function dots(x, y, w, h, cols, rows, r, fill, { op = 1 } = {}) {
  let s = '';
  const dx = w / cols, dy = h / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    s += `<circle cx="${(x + dx * (i + 0.5)).toFixed(1)}" cy="${(y + dy * (j + 0.5)).toFixed(1)}" r="${r}" fill="${fill}" opacity="${op}"/>`;
  }
  return s;
}

/**
 * A sticker: rotated pill with mono type. The collage voice.
 *
 * Its width comes from the label, so a long label silently walked off the right
 * edge and through a headline. The bounds are now checked against the frame,
 * with the rotation's corner lift included.
 */
function sticker(x, y, label, { fill = C.ink, text = C.paper, rot = -4, size = 24 } = {}) {
  const face = faceOf('mono');
  const w = layoutWidth(face, label, size) + 56;
  const lift = Math.abs(Math.sin((rot * Math.PI) / 180)) * (w / 2);
  if (x < 20 || x + w + lift > W - 20) {
    throw new Error(`sticker "${label}" (${Math.round(w)}px at x=${x}) does not fit the frame`);
  }
  return `<g transform="rotate(${rot} ${x + w / 2} ${y + 26})">` +
    R(x, y, Math.round(w), 52, 26, fill) +
    T('mono', x + w / 2, y + 35, label, { size, fill: text, anchor: 'middle' }) + '</g>';
}

const furniture = (n, total, fg) =>
  T('mono', 54, H - 54, `${String(n).padStart(2, '0')}/${String(total).padStart(2, '0')}`, { size: 23, fill: fg, op: 0.62 }) +
  T('mono', W - 54, H - 54, CAMPAIGN.handle, { size: 23, fill: fg, anchor: 'end', op: 0.62 });

const P = (id) => path.join(FACES, `${id}.jpg`);

/* ── content ────────────────────────────────────────────────────────────── */

// Commonly missed areas, per standard dermatology guidance. The headline counts
// this array so the two cannot drift.
// Coordinates are read off the actual crop, not guessed: the first pass put
// EARS on an eyebrow and pointed BACKS OF HANDS at a piece of fabric, because
// there are no hands in this frame. Anything not visible in the photograph is
// listed rather than pinned — a leader line to nothing is worse than no line.
export const MISSED = [
  { label: 'HAIRLINE & PART', at: [0.50, 0.18], side: 'left' },
  { label: 'EYELIDS',         at: [0.67, 0.435], side: 'right' },
  { label: 'EARS',            at: [0.87, 0.60], side: 'right' },
  { label: 'LIPS',            at: [0.55, 0.68], side: 'left' },
  { label: 'JAW & NECK',      at: [0.72, 0.79], side: 'right' },
  { label: 'BACKS OF HANDS',  pin: false },
];
const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/* ── slides ─────────────────────────────────────────────────────────────── */

function slide1() {
  const s = [R(0, 0, W, H, 0, C.sun)];
  // a circle bleeding off the right, cut hard
  s.push(photo(P(8058674), 'circle', 560, 300, 720, 720));
  s.push(`<circle cx="920" cy="660" r="360" fill="none" stroke="${C.ink}" stroke-width="5"/>`);

  s.push(T('mono', 54, 92, 'NOON — SPF, HONESTLY', { size: 24, ls: 4 }));
  s.push(R(54, 112, 88, 5, 0, C.ink));

  const head = stack('shout', ['YOU APPLY', 'A QUARTER'], { x: 54, y: 168, w: 620, h: 400 }, { max: 210 });
  s.push(head.svg);
  const sub = stack('serifI', ['of the SPF', 'on the label'], { x: 58, y: head.bottom + 18, w: 520, h: 240 }, { max: 104, lineHeight: 0.94, tracking: 0 });
  s.push(sub.svg);

  s.push(sticker(56, sub.bottom + 48, 'THREE FIXES · NONE COST ANYTHING', { rot: -3 }));
  s.push(T('serif', 54, H - 150, 'NOON', { size: 92 }));
  s.push(furniture(1, 6, C.ink));
  fits(sub.bottom + 100, H - 200, 'slide 1 stack');
  return s.join('');
}

function slide2() {
  const s = [R(0, 0, W, H, 0, C.paper)];
  s.push(T('mono', 54, 92, '01 — THE MEASURE', { size: 24, ls: 4, fill: C.blue }));
  const head = stack('shout', ['SPF IS TESTED', 'AT A DOSE YOU', 'HAVE NEVER USED'], { x: 54, y: 132, w: 972, h: 330 }, { max: 118 });
  s.push(head.svg);

  // Two dose fields. The dot count IS the number, so the picture cannot lie.
  const boxY = head.bottom + 60, boxH = 300;
  s.push(R(54, boxY, 470, boxH, 20, C.blue));
  s.push(dots(84, boxY + 74, 410, 200, 16, 8, 5.4, C.paper));
  s.push(T('mono', 84, boxY + 46, 'LAB DOSE', { size: 23, fill: C.paper, ls: 3 }));
  // the superscript lives in the mono face; Instrument Serif has no glyph for it
  s.push(T('serif', 84, boxY + boxH + 62, '2 mg', { size: 54, fill: C.blue }));
  s.push(T('mono', 84, boxY + boxH + 96, 'PER CM² OF SKIN', { size: 21, fill: C.ink, op: 0.6, ls: 2 }));

  s.push(R(556, boxY, 470, boxH, 20, C.pink));
  s.push(dots(586, boxY + 74, 410, 200, 8, 4, 5.4, C.paper));
  s.push(T('mono', 586, boxY + 46, 'WHAT PEOPLE ACTUALLY USE', { size: 23, fill: C.paper, ls: 3 }));
  s.push(T('serif', 586, boxY + boxH + 62, '0.5 to 1.0', { size: 54, fill: C.pink }));
  s.push(T('mono', 586, boxY + boxH + 96, 'A QUARTER TO A HALF', { size: 21, fill: C.ink, op: 0.6, ls: 2 }));

  const cap = boxY + boxH + 156;
  const chip = { x: 738, y: cap - 14, w: 288, h: 216 };
  const capBox = clearOf({ x: 54, y: cap, w: 650, h: 210 }, [chip], 'slide 2 caption');
  s.push(para('body', 'Protection falls away faster than the amount you skip. The number on the bottle is the best case, not the likely one.',
    capBox, { max: 33 }).svg);
  s.push(photo(P(9777469), 'soft', chip.x, chip.y, chip.w, chip.h));
  s.push(furniture(2, 6, C.ink));
  fits(cap + 200, H - 110, 'slide 2 caption');
  return s.join('');
}

function slide3() {
  const s = [R(0, 0, W, H, 0, C.blue)];
  s.push(photo(P(241756), 'arch', 600, 150, 426, 900));
  s.push(T('mono', 54, 92, '02 — THE DOSE', { size: 24, ls: 4, fill: C.sun }));

  s.push(T('serif', 46, 430, '2', { size: 460, fill: C.sun }));
  const head = stack('shout', ['FINGER', 'LENGTHS'], { x: 54, y: 470, w: 500, h: 220 }, { max: 116, fill: C.paper });
  s.push(head.svg);

  // the measure, drawn at the size it describes
  const fy = head.bottom + 46;
  s.push(R(58, fy, 42, 210, 21, C.sun));
  s.push(R(112, fy + 16, 42, 194, 21, C.sun));
  s.push(T('mono', 176, fy + 40, 'INDEX +', { size: 25, fill: C.paper }));
  s.push(T('mono', 176, fy + 76, 'MIDDLE', { size: 25, fill: C.paper }));
  s.push(T('serifI', 176, fy + 132, 'base to tip,', { size: 44, fill: C.sun }));
  s.push(T('serifI', 176, fy + 180, 'both fingers', { size: 44, fill: C.sun }));

  s.push(para('body', 'That is one dose for your face and neck. Roughly half a teaspoon.',
    { x: 54, y: fy + 254, w: 500, h: 160 }, { max: 31, fill: C.paper }).svg);
  s.push(furniture(3, 6, C.paper));
  fits(fy + 254 + 120, H - 110, 'slide 3 stack');
  return s.join('');
}

function slide4() {
  const s = [R(0, 0, W, H, 0, C.pink)];
  s.push(T('mono', 54, 92, '03 — THE CLOCK', { size: 24, ls: 4, fill: C.paper }));

  const head = stack('shout', ['NOTHING IS', 'WATERPROOF'], { x: 54, y: 140, w: 600, h: 200 }, { max: 110, fill: C.paper });
  s.push(head.svg);
  s.push(photo(P(4964944), 'circle', 812, 122, 214, 214));

  // The ring is the two-hour reapply window; the two arcs are the only water
  // resistance ratings a label may carry, drawn as the fraction of that window
  // they actually cover. The first version put a face inside the clock, which
  // meant nothing, and let the arcs run up through the headline.
  const cx = 540, cy = 800, r = 250;
  const arc = (deg, colour, rr, sw) => {
    const p = (d) => [cx + rr * Math.cos(((d - 90) * Math.PI) / 180), cy + rr * Math.sin(((d - 90) * Math.PI) / 180)];
    const [x1, y1] = p(0), [x2, y2] = p(deg);
    return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${rr} ${rr} 0 ${deg > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${colour}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
  };
  const at = (deg, rr) => [cx + rr * Math.cos(((deg - 90) * Math.PI) / 180), cy + rr * Math.sin(((deg - 90) * Math.PI) / 180)];

  s.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.paper}" stroke-width="34" opacity="0.28"/>`);
  s.push(arc(360 * (80 / 120), C.sun, r, 34));
  s.push(`<circle cx="${cx}" cy="${cy}" r="${r - 56}" fill="none" stroke="${C.paper}" stroke-width="24" opacity="0.28"/>`);
  s.push(arc(360 * (40 / 120), C.ink, r - 56, 24));

  const e80 = at(360 * (80 / 120), r + 52), e40 = at(360 * (40 / 120), r + 6);
  s.push(T('mono', e80[0] - 10, e80[1] + 8, '80 MIN', { size: 25, fill: C.sun, anchor: 'end' }));
  s.push(T('mono', e40[0] + 22, e40[1] + 8, '40 MIN', { size: 25, fill: C.ink }));

  s.push(`<circle cx="${cx}" cy="${cy}" r="128" fill="${C.paper}"/>`);
  s.push(T('serif', cx, cy + 26, '2h', { size: 126, anchor: 'middle' }));
  s.push(T('mono', cx, cy + 68, 'REAPPLY', { size: 22, anchor: 'middle', ls: 3, op: 0.66 }));
  s.push(sticker(54, 386, 'WATER RESISTANT IS NOT WATERPROOF', { fill: C.paper, text: C.ink, rot: -3, size: 21 }));
  s.push(para('body', 'Labels say water resistant for 40 or 80 minutes. That is the entire claim. Reapply every two hours, and straight after swimming or towelling off.',
    { x: 54, y: H - 268, w: 972, h: 180 }, { max: 32, fill: C.paper }).svg);
  s.push(furniture(4, 6, C.paper));
  return s.join('');
}

function slide5() {
  const s = [R(0, 0, W, H, 0, C.mint)];
  s.push(T('mono', 54, 92, 'THE BITS EVERYONE SKIPS', { size: 24, ls: 4 }));
  const head = stack('shout', [`${WORD[MISSED.length].toUpperCase()} PLACES`, 'YOU MISS'], { x: 54, y: 128, w: 640, h: 220 }, { max: 118 });
  s.push(head.svg);

  const px = 300, py = 400, pw = 480, ph = 620, tilt = -2;
  s.push(photo(P(7954488), 'soft', px, py, pw, ph, { rot: tilt }));

  // The photo is tilted, so the pins are rotated by the same angle about the
  // same centre. Otherwise every marker drifts by up to ten pixels — enough to
  // move "eyelids" onto a cheek.
  const cx = px + pw / 2, cy = py + ph / 2, a = (tilt * Math.PI) / 180;
  const spin = (x, y) => [
    cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
    cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
  ];

  const face = faceOf('mono');
  const pinned = MISSED.filter((m) => m.pin !== false);
  const leftRows = [], rightRows = [];
  pinned.forEach((m) => (m.side === 'left' ? leftRows : rightRows).push(m));
  const rowY = (list, i) => 520 + i * (list.length > 2 ? 150 : 190);

  for (const [list, isLeft] of [[leftRows, true], [rightRows, false]]) {
    list.forEach((m, i) => {
      const [tx, ty] = spin(px + m.at[0] * pw, py + m.at[1] * ph);
      const lx = isLeft ? 60 : W - 60;
      const ly = rowY(list, i) + (isLeft ? 60 : 0);
      const w = layoutWidth(face, m.label, 22) + 34;
      const anchorX = isLeft ? lx + w : lx - w;
      s.push(`<path d="M ${anchorX.toFixed(0)} ${ly - 12} L ${tx.toFixed(0)} ${ty.toFixed(0)}" stroke="${C.ink}" stroke-width="2.5" fill="none" opacity="0.8"/>`);
      s.push(`<circle cx="${tx.toFixed(0)}" cy="${ty.toFixed(0)}" r="9" fill="${C.pink}" stroke="${C.ink}" stroke-width="2.5"/>`);
      s.push(R(isLeft ? lx : lx - w, ly - 34, Math.round(w), 44, 22, C.ink));
      s.push(T('mono', isLeft ? lx + w / 2 : lx - w / 2, ly - 4, m.label, { size: 22, fill: C.mint, anchor: 'middle' }));
    });
  }

  // the one that is not in the frame gets said, not pointed at
  const off = MISSED.filter((m) => m.pin === false);
  if (off.length) {
    s.push(sticker(54, H - 250, `AND THE ${off.map((m) => m.label).join(' + ')}`, { fill: C.pink, text: C.paper, rot: -2, size: 22 }));
  }
  s.push(T('serifI', 54, H - 118, 'The bits that burn first.', { size: 58 }));
  s.push(furniture(5, 6, C.ink));
  return s.join('');
}

function slide6() {
  const s = [R(0, 0, W, H, 0, C.ink)];
  s.push(R(0, 0, W, 430, 0, C.sun));
  s.push(photo(P(4970778), 'angle', 620, 0, 460, 430));
  s.push(T('mono', 54, 88, 'THAT IS THE WHOLE METHOD', { size: 24, ls: 4 }));
  s.push(T('serif', 54, 300, 'NOON', { size: 210 }));
  s.push(T('mono', 60, 366, `${CAMPAIGN.product.toUpperCase()}`, { size: 26, ls: 5 }));

  const rules = ['Two finger lengths, face and neck', 'Again every two hours', 'Ears, part, eyelids, lips, hands'];
  let y = 560;
  rules.forEach((t, i) => {
    s.push(`<circle cx="86" cy="${y - 12}" r="30" fill="${C.sun}"/>`);
    s.push(T('mono', 86, y, String(i + 1), { size: 28, anchor: 'middle' }));
    s.push(T('body', 142, y, t, { size: 36, fill: C.paper }));
    y += 104;
  });

  s.push(T('serifI', 54, y + 84, 'None of it is a new product.', { size: 62, fill: C.sun }));
  s.push(sticker(54, y + 140, 'SAVE THIS FOR YOUR BATHROOM MIRROR', { fill: C.paper, text: C.ink, rot: -2, size: 22 }));
  s.push(T('body', 54, H - 120, `Follow ${CAMPAIGN.handle}`, { size: 40, fill: C.paper }));
  s.push(furniture(6, 6, C.paper));
  fits(y + 200, H - 150, 'slide 6 stack');
  return s.join('');
}

/* ── render ─────────────────────────────────────────────────────────────── */

const FONT_FILES = [...new Set(Object.values(FACE).map((f) => path.join(ROOT, 'assets/fonts', `${f.file}.ttf`)))];

function png(body, file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  fs.writeFileSync(file, new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false, defaultFontFamily: 'Bricolage Grotesque', fontFiles: FONT_FILES },
  }).render().asPng());
  return file;
}

/** Silent font fallback renders at a different width than the fitter allowed. */
export async function preflightFonts(tolerance = 0.05) {
  const probe = 'HAMBURGEFONSTIV 1234';
  const bad = [];
  for (const [kind, f] of Object.entries(FACE)) {
    const expected = layoutWidth(loadFace(f.file), probe, 100);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="300"><rect width="4000" height="300" fill="#fff"/>` +
      `<text x="20" y="200" font-family="${f.family}" font-weight="${f.weight}"${f.style ? ` font-style="${f.style}"` : ''} font-size="100" fill="#000">${probe}</text></svg>`;
    const buf = new Resvg(svg, { font: { loadSystemFonts: false, defaultFontFamily: 'Bricolage Grotesque', fontFiles: FONT_FILES } }).render().asPng();
    const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, maxX = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
    const drift = Math.abs((maxX - minX) - expected) / expected;
    if (drift > tolerance) bad.push(`${kind}: "${f.family}" ${f.weight}${f.style || ''} expected ${Math.round(expected)}px got ${maxX - minX}px (${(drift * 100).toFixed(0)}% off)`);
  }
  if (bad.length) throw new Error('font fallback detected:\n  ' + bad.join('\n  '));
}

export const COPY = {
  campaign: CAMPAIGN,
  slides: [
    { headline: 'YOU APPLY A QUARTER of the SPF on the label', body: 'Three fixes, none of them cost anything.' },
    { headline: 'SPF IS TESTED AT A DOSE YOU HAVE NEVER USED', body: 'Lab dose 2 mg/cm². Most people use 0.5 to 1.0.' },
    { headline: '2 FINGER LENGTHS', body: 'Index and middle, base to tip. Face and neck, about half a teaspoon.' },
    { headline: 'NOTHING IS WATERPROOF', body: 'Water resistant for 40 or 80 minutes. Reapply every 2 hours.' },
    { headline: `${WORD[MISSED.length].toUpperCase()} PLACES YOU MISS`, body: MISSED.map((m) => m.label.toLowerCase()).join(', ') },
    { headline: 'THAT IS THE WHOLE METHOD', body: `Save this for your bathroom mirror. Follow ${CAMPAIGN.handle}.` },
  ],
};

export async function build() {
  fs.mkdirSync(OUT, { recursive: true });
  await preflightFonts();
  const slides = [slide1(), slide2(), slide3(), slide4(), slide5(), slide6()];
  return slides.map((b, i) => png(b, path.join(OUT, `slide-${i + 1}.png`)));
}

if (process.argv[1] && process.argv[1].endsWith('campaign.mjs')) {
  build().then((f) => console.log(f.map((x) => path.basename(x)).join('  ')))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
