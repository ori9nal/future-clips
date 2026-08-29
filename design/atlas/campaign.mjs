// ATLAS — the campaign set.
//
// One product photograph carries the whole set: a real phone, in a real gym,
// running a real-looking build of the app. Everything else is drawn around it.
// That is the difference between a campaign and a set of posters — the reader
// sees the same object from slide one to slide six and believes it exists.
//
// Every size goes through fitText/fitLines against real advance widths, so copy
// that will not fit comes back null and the build fails rather than shipping a
// headline that walks off the frame. Every number in a chart is derived from the
// data it claims to show, for the same reason.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { loadFace } from '../../engine/fonts.mjs';
import { fitLines, fitText, layoutWidth } from '../../engine/fit-text.mjs';
import { projectUV } from '../../engine/screen-warp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'output/atlas/campaign');
const APP = path.join(ROOT, 'output/atlas/app');

export const W = 1080, H = 1350;

/* ── the campaign, as data an agency would actually hand over ───────────── */

export const CAMPAIGN = {
  id: 'atlas-ai-coach',
  brand: 'ATLAS',
  product: 'AI strength coach',
  handle: '@atlas.coach',
  palette: { ink: '#0A0B0D', deep: '#14181D', orange: '#FF6A1A', ember: '#7A3410', bone: '#F4F1EC', steel: '#5A636E' },
  rules: {
    required_mention: '@atlas.coach',
    banned_claims: ['guaranteed', 'cure', 'no effort', 'lose 10kg in a week'],
  },
};

const C = CAMPAIGN.palette;

/* ── type ───────────────────────────────────────────────────────────────── */

// family/weight are what resvg matches on, and it matches the TYPOGRAPHIC
// (preferred) family when the font declares one. ArchivoCondensed-Black calls
// itself "Archivo ExtraCondensed Black / Regular" in the legacy name records but
// "Archivo ExtraCondensed / Black" in the typographic ones — asking for the
// former silently fell back to plain Archivo, which measures ~40% wider, so
// every headline fitLines had approved ran straight off the frame.
const FACE = {
  display: { file: 'ArchivoCondensed-Black', family: 'Archivo ExtraCondensed', weight: 900 },
  displayB:{ file: 'ArchivoCondensed-ExtraBold', family: 'Archivo ExtraCondensed', weight: 800 },
  black:   { file: 'ArchivoBlack-Regular',   family: 'Archivo Black', weight: 400 },
  bold:    { file: 'Archivo-Bold',           family: 'Archivo',       weight: 700 },
  semi:    { file: 'Archivo-SemiBold',       family: 'Archivo',       weight: 600 },
  body:    { file: 'Archivo-Medium',         family: 'Archivo',       weight: 500 },
  mono:    { file: 'JetBrainsMono-Bold',     family: 'JetBrains Mono', weight: 700 },
  monoM:   { file: 'JetBrainsMono-Medium',   family: 'JetBrains Mono', weight: 500 },
};
const faceOf = (k) => loadFace(FACE[k].file);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function T(kind, x, y, s, { size = 30, fill = C.bone, anchor = 'start', ls = 0, op = 1 } = {}) {
  const f = FACE[kind];
  return `<text x="${x}" y="${y}" font-family="${f.family}" font-weight="${f.weight}" font-size="${size}" ` +
    `fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}">${esc(s)}</text>`;
}

const R = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

/**
 * Stack pre-broken display lines, sized to the box. Throws on null rather than
 * shipping a headline that runs off the frame.
 */
function stack(kind, lines, box, opts = {}) {
  const face = faceOf(kind);
  const fit = fitLines(face, lines, box, { min: 28, max: opts.max ?? 260, lineHeight: opts.lineHeight ?? 0.86, tracking: opts.tracking ?? -0.015 });
  if (!fit) throw new Error(`copy does not fit ${JSON.stringify(lines)} in ${JSON.stringify(box)}`);
  const capRatio = face.capHeight / face.upm;
  let out = '', y = box.y + fit.size * capRatio;
  for (const line of fit.lines) {
    const x = opts.anchor === 'end' ? box.x + box.w : opts.anchor === 'middle' ? box.x + box.w / 2 : box.x;
    out += T(kind, x, Math.round(y), line, { size: fit.size, fill: opts.fill ?? C.bone, anchor: opts.anchor ?? 'start', ls: fit.trackingPx });
    y += fit.size * fit.lineHeight;
  }
  return { svg: out, size: fit.size, height: fit.height, bottom: y - fit.size * fit.lineHeight + fit.size * 0.24 };
}

/** Wrapped body copy, same contract. */
function para(kind, text, box, opts = {}) {
  const face = faceOf(kind);
  const fit = fitText(face, text, box, { min: 14, max: opts.max ?? 40, lineHeight: opts.lineHeight ?? 1.34, tracking: 0, autoLeading: false });
  if (!fit) throw new Error(`body does not fit: ${text.slice(0, 50)}`);
  let out = '', y = box.y + fit.size * (face.capHeight / face.upm);
  for (const line of fit.lines) {
    out += T(kind, box.x, Math.round(y), line, { size: fit.size, fill: opts.fill ?? C.bone, op: opts.op ?? 1 });
    y += fit.size * fit.lineHeight;
  }
  return { svg: out, size: fit.size, bottom: y };
}

/**
 * Assert a laid-out block ends above a limit. fitText guards a single text box;
 * nothing guarded a stack of boxes whose combined pitch overran the frame, which
 * is how the results slide shipped with its caption under the page number.
 */
function fits(bottom, limit, what) {
  if (bottom > limit) throw new Error(`${what} overflows: ends at ${Math.round(bottom)}px, limit ${limit}px`);
  return bottom;
}

/* ── photographs ────────────────────────────────────────────────────────── */

let uid = 0;
/**
 * Place a photo with feathered edges. A crop pasted flat leaves a visible
 * rectangle seam wherever the photo's own background is a different black from
 * the slide's — which is every time. Feathering the sides that meet the ground
 * makes the phone sit IN the frame instead of on top of it.
 */
function photo(href, x, y, w, h, feather = {}) {
  const { top = 0, left = 0, right = 0, bottom = 0 } = feather;
  if (!top && !left && !right && !bottom) {
    return `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/>`;
  }
  const id = `ph${++uid}`;
  const stops = (a, b) => {
    const s = [];
    if (a > 0) { s.push('<stop offset="0" stop-color="#000"/>'); s.push(`<stop offset="${(a).toFixed(4)}" stop-color="#fff"/>`); }
    else s.push('<stop offset="0" stop-color="#fff"/>');
    if (b > 0) { s.push(`<stop offset="${(1 - b).toFixed(4)}" stop-color="#fff"/>`); s.push('<stop offset="1" stop-color="#000"/>'); }
    else s.push('<stop offset="1" stop-color="#fff"/>');
    return s.join('');
  };
  return `<defs>
    <linearGradient id="${id}v" x1="0" y1="0" x2="0" y2="1">${stops(top / h, bottom / h)}</linearGradient>
    <linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0">${stops(left / w, right / w)}</linearGradient>
    <mask id="${id}mv"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}v)"/></mask>
    <mask id="${id}mh"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}h)"/></mask>
  </defs>
  <g mask="url(#${id}mh)"><image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" mask="url(#${id}mv)"/></g>`;
}

const dataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

/* ── shared furniture ───────────────────────────────────────────────────── */

/** The rail is what makes six frames read as one set — so it must be visible on
 *  every ground, which means it cannot always be orange. */
function furniture(n, total, { light = false, label = '', rail = null } = {}) {
  const fg = light ? C.ink : C.bone;
  return R(0, 0, 14, H, 0, rail ?? (light ? C.ink : C.orange)) +
    T('mono', 46, H - 54, `${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { size: 24, fill: fg, op: 0.55 }) +
    T('mono', W - 46, H - 54, CAMPAIGN.handle, { size: 24, fill: light ? C.ink : C.orange, anchor: 'end', op: light ? 0.6 : 1 }) +
    (label ? T('mono', 46, 74, label, { size: 22, fill: fg, op: 0.5, ls: 3 }) : '');
}

/* ── the phone photo, cropped once and reused ───────────────────────────── */

const QUAD = [[152, 232], [381, 203], [398, 704], [276, 748]];
const CROP = { left: 62, top: 138, width: 402, height: 660 };

/** Photo px -> slide px, for a given placement of the cropped photo. */
const place = (p, dx, dy, scale) => [dx + (p[0] - CROP.left) * scale, dy + (p[1] - CROP.top) * scale];

async function preparePhoto() {
  fs.mkdirSync(OUT, { recursive: true });
  const f = path.join(OUT, '_phone.png');
  await sharp(path.join(APP, 'composite.png')).extract(CROP).resize(CROP.width * 3).png().toFile(f);
  return f;
}

/* ── slide data (single source of truth for anything a chart claims) ─────── */

// readiness for the seven days ENDING today. Ordering matters: a "last seven
// days" chart that runs Mon..Sun with Thursday marked TODAY is claiming to know
// Friday's recovery.
export const WEEK = [
  ['FRI', 74], ['SAT', 62], ['SUN', 83], ['MON', 79], ['TUE', 88], ['WED', 70], ['THU', 61],
];

// 8 weeks x 4 sessions. 2 = ran in full, 1 = cut short, 0 = pulled entirely.
export const BLOCK = [
  [2, 2, 1, 2], [2, 1, 2, 2], [2, 2, 2, 1], [1, 2, 1, 2],
  [2, 1, 2, 1], [2, 2, 1, 2], [0, 1, 0, 1], [2, 2, 1, 2],
];
const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen'];
export const CUTS = BLOCK.flat().filter((v) => v === 1).length;

export const RESULTS = [
  { label: 'BACK SQUAT', before: 102, after: 114, fmt: (v) => `${v} kg`, delta: '+12 kg' },
  { label: 'SESSIONS COMPLETED', before: 61, after: 94, fmt: (v) => `${v}%`, delta: '+33 pts' },
  { label: 'WEEKLY TONNAGE', before: 18400, after: 15900, fmt: (v) => v.toLocaleString('en-US'), delta: '−14%' },
];

/* ── slides ─────────────────────────────────────────────────────────────── */

function slide1(phone) {
  const s = [];
  s.push(R(0, 0, W, H, 0, C.ink));
  s.push(`<defs><radialGradient id="g1" cx="0.74" cy="0.30" r="0.78">
    <stop offset="0" stop-color="#2E2118"/><stop offset="1" stop-color="${C.ink}"/></radialGradient></defs>`);
  s.push(R(0, 0, W, H, 0, 'url(#g1)'));

  const scale = 1.62, dx = 470, dy = 470;
  s.push(photo(dataUri(phone), dx, dy, CROP.width * scale, CROP.height * scale, { top: 220, left: 170 }));

  s.push(T('mono', 46, 120, 'ATLAS — AI STRENGTH COACH', { size: 24, fill: C.orange, ls: 4 }));

  const head = stack('display', ['IT DELETED', 'MY LEG DAY'], { x: 46, y: 168, w: 900, h: 400 }, { max: 250 });
  s.push(head.svg);
  s.push(R(46, head.bottom + 34, 132, 12, 0, C.orange));
  const sub = para('body', 'Then my squat went up 12 kg. Here is exactly what it saw that I did not.',
    { x: 46, y: head.bottom + 84, w: 470, h: 220 }, { max: 38, op: 0.86 });
  s.push(sub.svg);

  // the badge is pinned through the same homography that painted the screen, so
  // it points at the ring rather than at a spot that was eyeballed once
  const ring = place(projectUV(QUAD, 0.21, 0.22), dx, dy, scale);
  s.push(`<line x1="${ring[0]}" y1="${ring[1]}" x2="${ring[0] - 96}" y2="${ring[1] + 126}" stroke="${C.orange}" stroke-width="3"/>`);
  s.push(`<circle cx="${ring[0]}" cy="${ring[1]}" r="9" fill="${C.orange}"/>`);
  s.push(R(ring[0] - 340, ring[1] + 96, 250, 66, 33, C.orange));
  s.push(T('mono', ring[0] - 215, ring[1] + 138, 'READINESS 61', { size: 25, fill: C.ink, anchor: 'middle' }));

  s.push(furniture(1, 6));
  return s.join('');
}

function slide2() {
  const s = [];
  s.push(R(0, 0, W, H, 0, C.orange));           // the rhythm break: a colour field
  s.push(T('mono', 46, 120, 'THE PROBLEM', { size: 24, fill: C.ink, ls: 4, op: 0.6 }));

  const head = stack('display', ['YOUR PROGRAM', 'WAS WRITTEN', 'ON A SUNDAY'], { x: 46, y: 164, w: 900, h: 460 }, { max: 200, fill: C.ink });
  s.push(head.svg);
  const sub = para('body', 'Your body is a Thursday. It slept five hours, it is carrying Tuesday, and the PDF has no idea.',
    { x: 46, y: head.bottom + 40, w: 720, h: 180 }, { max: 36, fill: C.ink, op: 0.74 });
  s.push(sub.svg);

  const top = 900, cw = 132, gap = 14, barH = 236;
  s.push(T('body', 46, top - 60, 'READINESS, THE SEVEN DAYS ENDING TODAY', { size: 22, fill: C.ink, op: 0.55, ls: 3 }));
  WEEK.forEach(([d, v], i) => {
    const x = 46 + i * (cw + gap);
    const hit = i === WEEK.length - 1;
    const bh = Math.round((v / 100) * barH);
    s.push(R(x, top, cw, barH, 10, 'rgba(10,11,13,0.13)'));
    s.push(R(x, top + (barH - bh), cw, bh, 10, hit ? C.ink : 'rgba(10,11,13,0.44)'));
    s.push(T('mono', x + cw / 2, top + (barH - bh) - 14, String(v), { size: 23, fill: C.ink, anchor: 'middle', op: hit ? 1 : 0.66 }));
    s.push(T('mono', x + cw / 2, top + barH + 40, d, { size: 21, fill: C.ink, anchor: 'middle', op: hit ? 1 : 0.5 }));
    if (hit) {
      s.push(T('mono', x + cw / 2, top - 22, 'TODAY', { size: 20, fill: C.ink, anchor: 'middle' }));
      s.push(R(x, top - 12, cw, 5, 2, C.ink));
    }
  });

  s.push(furniture(2, 6, { light: true }));
  return s.join('');
}

function slide3(phone) {
  const s = [];
  s.push(R(0, 0, W, H, 0, C.deep));
  s.push(T('mono', 46, 120, 'WHAT IT ACTUALLY DOES', { size: 24, fill: C.orange, ls: 4 }));

  const scale = 1.42, dx = 62, dy = 268;
  s.push(photo(dataUri(phone), dx, dy, CROP.width * scale, CROP.height * scale,
    { top: 130, left: 90, bottom: 150, right: 60 }));

  const head = stack('display', ['IT READS THE', 'NIGHT BEFORE'], { x: 620, y: 176, w: 414, h: 210 }, { max: 108 });
  s.push(head.svg);

  const calls = [
    [0.62, 0.185, 'SLEEP  5h 12m', '−2h 48m vs your baseline'],
    [0.21, 0.225, 'READINESS  61', 'HRV down 18% overnight'],
    [0.50, 0.365, 'VOLUME CUT 39%', 'decided before you arrived'],
    [0.55, 0.605, 'LUNGES REMOVED', 'the set you would have skipped'],
  ];
  let ly = 470;
  for (const [u, v, title, note] of calls) {
    const p = place(projectUV(QUAD, u, v), dx, dy, scale);
    const bx = 620;
    s.push(`<path d="M ${p[0].toFixed(0)} ${p[1].toFixed(0)} L ${(bx - 46).toFixed(0)} ${ly - 12} L ${bx} ${ly - 12}" stroke="${C.orange}" stroke-width="2.5" fill="none" opacity="0.9"/>`);
    s.push(`<circle cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="8" fill="${C.orange}"/>`);
    s.push(T('mono', bx, ly, title, { size: 27, fill: C.orange }));
    s.push(T('body', bx, ly + 34, note, { size: 22, fill: C.bone, op: 0.62 }));
    ly += 118;
  }

  s.push(R(620, ly + 16, 400, 2, 0, '#2A3138'));
  s.push(para('body', 'Four minutes after the watch synced. Before you had picked a playlist.',
    { x: 620, y: ly + 48, w: 400, h: 160 }, { max: 26, op: 0.55 }).svg);

  s.push(furniture(3, 6));
  return s.join('');
}

function slide4() {
  const s = [];
  s.push(R(0, 0, W, H, 0, C.ink));
  s.push(T('mono', 46, 120, 'EIGHT WEEKS', { size: 24, fill: C.orange, ls: 4 }));
  // the number in the headline is COUNTED from the grid below it, so the two can
  // never drift apart
  const head = stack('display', [`IT CUT ${NUMBER[CUTS].toUpperCase()}`, 'SESSIONS SHORT'], { x: 46, y: 164, w: 900, h: 260 }, { max: 132 });
  s.push(head.svg);
  s.push(para('body', 'So it never had to cut a whole week. This is the block it actually ran.',
    { x: 46, y: head.bottom + 34, w: 720, h: 120 }, { max: 32, op: 0.72 }).svg);

  // Orange is spent on the CUTS, not on the full sessions — the cuts are the
  // story, and colouring the majority made the eye land on the wrong cells.
  const cw = 108, ch = 108, gx = 14, x0 = 46, y0 = 596;
  BLOCK.forEach((week, wi) => {
    const x = x0 + wi * (cw + gx);
    week.forEach((v, si) => {
      const y = y0 + si * (ch + gx);
      if (v === 2) s.push(R(x, y, cw, ch, 12, C.ember));
      else if (v === 1) s.push(R(x, y, cw, ch, 12, C.orange));
      else s.push(R(x, y, cw, ch, 12, 'none', `stroke="${C.steel}" stroke-width="2" stroke-dasharray="7 7"`));
    });
    s.push(T('mono', x + cw / 2, y0 - 22, `W${wi + 1}`, { size: 20, fill: C.bone, anchor: 'middle', op: 0.45 }));
  });
  const dx7 = x0 + 6 * (cw + gx);
  s.push(T('mono', dx7 + cw / 2, y0 - 58, 'DELOAD', { size: 19, fill: C.orange, anchor: 'middle' }));
  s.push(R(dx7, y0 - 48, cw, 4, 2, C.orange));

  const legend = [[C.ember, 'ran in full', false], [C.orange, `cut short  ×${CUTS}`, false], [null, 'pulled entirely  ×2', true]];
  legend.forEach(([col, label, dashed], i) => {
    const lx = 46 + i * 330, ly = y0 + 4 * (ch + gx) + 30;
    s.push(dashed ? R(lx, ly, 26, 26, 6, 'none', `stroke="${C.steel}" stroke-width="2" stroke-dasharray="5 5"`) : R(lx, ly, 26, 26, 6, col));
    s.push(T('body', lx + 40, ly + 21, label, { size: 24, op: 0.78 }));
  });

  s.push(furniture(4, 6));
  return s.join('');
}

function slide5() {
  const s = [];
  s.push(R(0, 0, W, H, 0, C.ink));
  s.push(R(0, 0, W, 470, 0, C.bone));
  s.push(T('mono', 46, 116, 'AFTER SIX WEEKS', { size: 24, fill: C.ink, ls: 4, op: 0.55 }));
  s.push(stack('display', ['LESS WORK.', 'MORE WEIGHT.'], { x: 46, y: 160, w: 900, h: 250 }, { max: 140, fill: C.ink }).svg);

  // Bar length is derived from the value, normalised per row. Hand-picked widths
  // made a 12% strength gain look like 29% — a chart that flatters the product
  // by lying is worth less than no chart.
  const track = 700;
  let y = 512;
  for (const row of RESULTS) {
    const max = Math.max(row.before, row.after);
    s.push(T('body', 46, y, row.label, { size: 25, op: 0.55, ls: 2 }));
    s.push(R(830, y - 26, 204, 40, 20, 'rgba(255,106,26,0.16)'));
    s.push(T('mono', 932, y + 1, row.delta, { size: 25, fill: C.orange, anchor: 'middle' }));

    s.push(T('monoM', 46, y + 46, 'WEEK 1', { size: 18, fill: C.bone, op: 0.38, ls: 2 }));
    s.push(R(46, y + 56, Math.round(track * (row.before / max)), 32, 6, '#2A3138'));
    s.push(T('mono', 46 + Math.round(track * (row.before / max)) + 18, y + 80, row.fmt(row.before), { size: 24, fill: C.bone, op: 0.5 }));

    s.push(T('monoM', 46, y + 122, 'WEEK 6', { size: 18, fill: C.orange, op: 0.8, ls: 2 }));
    s.push(R(46, y + 132, Math.round(track * (row.after / max)), 44, 6, C.orange));
    s.push(T('mono', 46 + Math.round(track * (row.after / max)) + 18, y + 164, row.fmt(row.after), { size: 30, fill: C.orange }));
    y += 214;
  }
  s.push(T('body', 46, y + 6, 'Tonnage went down on purpose. That was the point.', { size: 26 }));
  s.push(R(46, y + 28, 640, 2, 0, '#2A3138'));
  s.push(T('mono', 46, y + 72, 'ONE LIFTER, WEEKS 1—6, LOGGED IN APP', { size: 19, fill: C.bone, op: 0.38, ls: 2 }));
  // the footer must clear the page furniture, which sits at H-54
  fits(y + 72, H - 110, 'slide 5 results stack');

  s.push(furniture(5, 6));
  return s.join('');
}

function slide6(phone) {
  const s = [];
  s.push(R(0, 0, W, H, 0, C.ink));
  s.push(`<defs><linearGradient id="g6" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#E85D12"/><stop offset="1" stop-color="${C.orange}"/></linearGradient></defs>`);
  // the diagonal sits BELOW every line of copy — bone type crossing onto orange
  // was unreadable for two of its three lines
  s.push(`<path d="M 0 ${H} L 0 720 L ${W} 500 L ${W} ${H} Z" fill="url(#g6)"/>`);

  const scale = 0.74, dx = 670, dy = 110;
  s.push(photo(dataUri(phone), dx, dy, CROP.width * scale, CROP.height * scale, { bottom: 170, left: 70, top: 95, right: 75 }));

  s.push(T('mono', 46, 120, 'START TONIGHT', { size: 24, fill: C.orange, ls: 4 }));
  const head = stack('display', ['TRY IT ON', 'ONE WEEK'], { x: 46, y: 168, w: 570, h: 250 }, { max: 150 });
  s.push(head.svg);
  s.push(para('body', 'Wear anything that tracks sleep. Let Atlas rewrite the sessions. Keep whichever week felt better.',
    { x: 46, y: head.bottom + 40, w: 540, h: 190 }, { max: 31, op: 0.82 }).svg);

  const steps = ['Download Atlas, free for 14 days', 'Connect your watch or ring', 'Train the session it gives you'];
  let y = 830;
  steps.forEach((label, i) => {
    s.push(`<circle cx="76" cy="${y - 10}" r="27" fill="${C.ink}"/>`);
    s.push(T('mono', 76, y, String(i + 1), { size: 26, fill: C.orange, anchor: 'middle' }));
    s.push(T('semi', 124, y, label, { size: 31, fill: C.ink }));
    y += 92;
  });

  s.push(R(46, y + 34, 570, 100, 50, C.ink));
  s.push(T('bold', 331, y + 98, 'Follow @atlas.coach', { size: 35, fill: C.orange, anchor: 'middle' }));
  s.push(furniture(6, 6, { light: true, rail: C.ink }));
  return s.join('');
}

/* ── render ─────────────────────────────────────────────────────────────── */

const FONT_FILES = [...new Set(Object.values(FACE).map((f) => path.join(ROOT, 'assets/fonts', `${f.file}.ttf`)))];

function png(body, file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false, defaultFontFamily: 'Archivo', fontFiles: FONT_FILES },
  });
  fs.writeFileSync(file, r.render().asPng());
  return file;
}

/**
 * Prove every face resvg will use is the face fitText measured.
 *
 * A font fallback is silent: the SVG asks for a condensed family, does not get
 * it, and renders 40% wider than the fitter allowed. Nothing errors — the
 * headline just walks off the frame. So rasterise a probe in each family and
 * compare its ink width against the advance widths of the TTF we believe we are
 * using. A mismatch means fallback, and that is a build failure.
 */
export async function preflightFonts(tolerance = 0.04) {
  const probe = 'HAMBURGEFONSTIV 1234';
  const report = [];
  for (const [kind, f] of Object.entries(FACE)) {
    const face = loadFace(f.file);
    const expected = layoutWidth(face, probe, 100);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="260">` +
      `<rect width="4000" height="260" fill="#fff"/>` +
      `<text x="20" y="180" font-family="${f.family}" font-weight="${f.weight}" font-size="100" fill="#000">${probe}</text></svg>`;
    const buf = new Resvg(svg, { font: { loadSystemFonts: false, defaultFontFamily: 'Archivo', fontFiles: FONT_FILES } }).render().asPng();
    const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, maxX = -1;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[y * info.width + x] < 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
      }
    }
    const actual = maxX - minX;
    const drift = Math.abs(actual - expected) / expected;
    report.push({ kind, family: f.family, weight: f.weight, expected: Math.round(expected), actual, drift: +drift.toFixed(3), ok: drift <= tolerance });
  }
  const bad = report.filter((r) => !r.ok);
  if (bad.length) {
    throw new Error('font fallback detected — measured width does not match the loaded face:\n' +
      bad.map((b) => `  ${b.kind}: asked "${b.family}" ${b.weight}, expected ${b.expected}px got ${b.actual}px (${(b.drift * 100).toFixed(0)}% off)`).join('\n'));
  }
  return report;
}

/** The copy, in the shape engine/judge.mjs logicCheck() consumes. */
export const COPY = {
  campaign: CAMPAIGN,
  slides: [
    { headline: 'IT DELETED MY LEG DAY', lead: 'Then my squat went up 12 kg. Here is exactly what it saw that I did not.' },
    { headline: 'YOUR PROGRAM WAS WRITTEN ON A SUNDAY', body: 'Your body is a Thursday. It slept five hours and the PDF has no idea.' },
    { headline: 'IT READS THE NIGHT BEFORE', body: 'Sleep 5h 12m. Readiness 61. Volume cut 39%. Lunges removed.' },
    { headline: `IT CUT ${NUMBER[CUTS].toUpperCase()} SESSIONS SHORT`, body: 'So it never had to cut a whole week.' },
    { headline: 'LESS WORK. MORE WEIGHT.', body: 'Back squat 102 kg to 114 kg. Sessions completed 61% to 94%.' },
    { headline: 'TRY IT ON ONE WEEK', body: 'Download Atlas, free for 14 days. Connect your watch. Follow @atlas.coach' },
  ],
};

export async function build() {
  fs.mkdirSync(OUT, { recursive: true });
  await preflightFonts();
  const phone = await preparePhoto();
  const slides = [slide1(phone), slide2(), slide3(phone), slide4(), slide5(), slide6(phone)];
  return slides.map((body, i) => png(body, path.join(OUT, `slide-${i + 1}.png`)));
}

if (process.argv[1] && process.argv[1].endsWith('campaign.mjs')) {
  build().then((f) => console.log(f.map((x) => path.basename(x)).join('  ')))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
