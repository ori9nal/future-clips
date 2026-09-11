// ATLAS — the teaching set.
//
// The format: one real person, photographed, on every frame from slide one, and
// the teaching carried in type beside him. No charts, no drawn objects, no
// diagrams. The body holds attention; the words do the work.
//
// Character consistency is the thing that makes this format work and the thing
// that is hardest to fake. It is not faked here — these are seven frames of one
// man from a single studio session by one photographer, so the light, the
// backdrop and the face are identical across the set because they were shot that
// way. No generation, no cost, licensed for commercial use.
//
// The palette is sampled from the photographs rather than chosen: the backdrop
// gives the ground, the specular highlight on lit skin gives the one accent. It
// is a warm stone, not a saturated accent, because that is what is actually in
// the frame.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { loadFace } from '../../engine/fonts.mjs';
import { fitLines, fitText, layoutWidth } from '../../engine/fit-text.mjs';
import { scoreBoxes, candidatesFor, scrimFor } from '../../engine/_attic/negative-space.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOOT = path.join(ROOT, 'output/shoots/80197256');
const OUT = path.join(ROOT, 'output/atlas/teach');

export const W = 1080, H = 1350;

/* palette, sampled from the shoot (see tools output in COST/notes):
   backdrop #0e0c0d · lit skin #1e1413 · specular #bca89f          */
const C = {
  ink: '#0B0A0A',
  bone: '#F0EBE5',
  stone: '#BCA89F',
  ash: '#6E625C',
};

export const CAMPAIGN = {
  brand: 'ATLAS', handle: '@atlas.coach',
  rules: { required_mention: '@atlas.coach', banned_claims: ['guaranteed', 'cure', 'no effort'] },
  credit: 'Photography: Mike Jones / Pexels',
};

/* ── type ───────────────────────────────────────────────────────────────── */

const FACE = {
  display: { file: 'ArchivoCondensed-Black', family: 'Archivo ExtraCondensed', weight: 900 },
  body:    { file: 'Archivo-Medium',         family: 'Archivo',       weight: 500 },
  semi:    { file: 'Archivo-SemiBold',       family: 'Archivo',       weight: 600 },
  mono:    { file: 'JetBrainsMono-Bold',     family: 'JetBrains Mono', weight: 700 },
};
const faceOf = (k) => loadFace(FACE[k].file);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function T(kind, x, y, s, { size = 30, fill = C.bone, anchor = 'start', ls = 0, op = 1, ws = 0 } = {}) {
  const f = FACE[kind];
  return `<text x="${x}" y="${y}" font-family="${f.family}" font-weight="${f.weight}" font-size="${size}" ` +
    `fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" word-spacing="${ws}" opacity="${op}">${esc(s)}</text>`;
}

// The extra-condensed black has a very narrow space glyph: at display sizes
// "TOP SET" closes up and reads as one word. Word-spacing fixes it, but it adds
// width fitLines did not measure — so fit against a 5% narrower box, which
// covers the widest realistic case (a line of four spaces at 0.07em is ~3%).
const WORD_SPACE_EM = 0.07;
const FIT_SLACK = 0.95;

function stack(kind, lines, box, opts = {}) {
  const face = faceOf(kind);
  const ws = opts.ws ?? WORD_SPACE_EM;
  const fitBox = { ...box, w: Math.floor(box.w * (ws ? FIT_SLACK : 1)) };
  const fit = fitLines(face, lines, fitBox, { min: 26, max: opts.max ?? 200, lineHeight: opts.lineHeight ?? 0.87, tracking: 0 });
  if (!fit) throw new Error(`headline does not fit: ${lines.join(' / ')}`);
  const wsPx = +(ws * fit.size).toFixed(2);
  const widest = Math.max(...fit.lines.map((l) => layoutWidth(face, l, fit.size) + (l.split(' ').length - 1) * wsPx));
  if (widest > box.w) throw new Error(`headline overruns after word-spacing: ${Math.round(widest)} > ${box.w}`);
  let out = '', y = box.y + fit.size * (face.capHeight / face.upm);
  for (const line of fit.lines) {
    out += T(kind, box.x, Math.round(y), line, { size: fit.size, fill: opts.fill ?? C.bone, ls: fit.trackingPx, ws: wsPx });
    y += fit.size * fit.lineHeight;
  }
  return { svg: out, size: fit.size, bottom: y - fit.size * fit.lineHeight + fit.size * 0.26 };
}

function para(kind, text, box, opts = {}) {
  const face = faceOf(kind);
  const fit = fitText(face, text, box, { min: 24, max: opts.max ?? 34, lineHeight: 1.4, tracking: 0 });
  if (!fit) throw new Error(`body does not fit: ${text.slice(0, 46)}`);
  let out = '', y = box.y + fit.size * (face.capHeight / face.upm);
  for (const line of fit.lines) {
    out += T(kind, box.x, Math.round(y), line, { size: fit.size, fill: opts.fill ?? C.bone, op: opts.op ?? 0.78 });
    y += fit.size * fit.lineHeight;
  }
  return { svg: out, size: fit.size, bottom: y };
}

/* ── content ────────────────────────────────────────────────────────────── */

// The signals are one array so the hook cannot promise a count the set does not
// deliver — the failure mode that put "eleven" over a grid of seven.
export const SIGNALS = [
  {
    photo: 8875064,
    kicker: 'SIGNAL 01',
    head: ['YOUR GRIP', 'GOES FIRST'],
    body: 'The bar slips before your legs fail. That is your nervous system reporting, not your forearms giving up.',
  },
  {
    photo: 8874404,
    kicker: 'SIGNAL 02',
    head: ['RESTING HEART', 'RATE IS THE', 'HONEST ONE'],
    body: 'Five beats above your own baseline, taken before you sit up, means yesterday has not been paid for yet.',
  },
  {
    photo: 8875164,
    kicker: 'SIGNAL 03',
    head: ['UNDER SIX HOURS', 'COSTS THE', 'TOP SET'],
    body: 'Not the whole session. Drop the heaviest work and keep the volume that does not need a fresh nervous system.',
  },
];

const WORD = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six' };

export const SLIDES = [
  {
    photo: 8874560,
    kicker: `${CAMPAIGN.brand} — TRAINING NOTES`,
    head: ['YOU ARE NOT', 'OVERTRAINED'],
    body: `You are under-recovered. ${WORD[SIGNALS.length]} signals give it away before your lifts do, and each one has a different fix.`,
    kind: 'hook',
  },
  ...SIGNALS.map((s) => ({ ...s, kind: 'signal' })),
  {
    photo: 8874452,
    kicker: 'THE FIX',
    head: ['NOT A REST DAY.', 'A SMALLER DOSE.'],
    body: 'Cut it by a third. A rest day is what you take after ignoring all three.',
    kind: 'fix',
  },
  {
    photo: 8874449,
    kicker: 'WHY THIS IS HARD ALONE',
    head: ['ATLAS READS', `ALL ${WORD[SIGNALS.length].toUpperCase()}`, 'BY 6 AM'],
    body: 'It rewrites the session before you get to the gym. Free for 14 days — follow @atlas.coach.',
    kind: 'cta',
  },
];

/* ── render ─────────────────────────────────────────────────────────────── */

const FONT_FILES = [...new Set(Object.values(FACE).map((f) => path.join(ROOT, 'assets/fonts', `${f.file}.ttf`)))];

async function frame(photoId) {
  const src = path.join(SHOOT, `${photoId}.jpg`);
  const f = path.join(OUT, `_f${photoId}.png`);
  await sharp(src).resize(W, H, { fit: 'cover', position: sharp.strategy.attention }).png().toFile(f);
  return f;
}

/** Lay the type into one box. Returns null if the copy will not fit it. */
function layoutInto(slide, box) {
  try {
    const s = [];
    let y = box.y;
    s.push(T('mono', box.x, y + 22, slide.kicker, { size: 22, fill: C.stone, ls: 4 }));
    s.push(`<rect x="${box.x}" y="${y + 42}" width="72" height="3" fill="${C.stone}"/>`);
    y += 92;
    const head = stack('display', slide.head, { x: box.x, y, w: box.w, h: box.h * 0.58 },
      { max: slide.kind === 'hook' ? 190 : 150 });
    s.push(head.svg);
    const body = para('body', slide.body,
      { x: box.x, y: head.bottom + 34, w: Math.min(box.w, 480), h: box.y + box.h - head.bottom - 40 },
      { max: 31 });
    s.push(body.svg);
    if (head.size < 66) return null;   // a headline squeezed to fit any gap is not a headline
    return { svg: s.join(''), headSize: head.size };
  } catch {
    return null;                        // fitText refused; try the next box
  }
}

async function buildSlide(slide, n, total, prevBox) {
  const img = await frame(slide.photo);
  let boxes = await scoreBoxes(img, { w: W, h: H, candidates: candidatesFor(W, H) });

  // Rhythm: a small penalty for landing on the same box two slides running, so
  // the set alternates instead of parking every headline in the same corner.
  boxes = boxes.map((b) => ({ ...b, score: b.score + (b.name === prevBox ? 22 : 0) }))
    .sort((a, b) => a.score - b.score);

  // Try the emptiest box first and fall through until the copy actually fits.
  // The earlier version filtered candidates by height before scoring, which
  // silently excluded the top band — on several of these frames the emptiest
  // region in the picture — and parked headlines across the model's face.
  let box = null, laid = null;
  for (const b of boxes) {
    const attempt = layoutInto(slide, b);
    if (attempt) { box = b; laid = attempt; break; }
  }
  if (!laid) throw new Error(`slide ${n}: copy fits no candidate box`);
  const scrim = scrimFor(box);

  const s = [];
  s.push(`<image href="data:image/png;base64,${fs.readFileSync(img).toString('base64')}" x="0" y="0" width="${W}" height="${H}"/>`);

  // A whole-frame foot gradient keeps the furniture legible on every photo.
  s.push(`<defs><linearGradient id="foot" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.ink}" stop-opacity="0"/>
    <stop offset="1" stop-color="${C.ink}" stop-opacity="0.92"/></linearGradient>`);
  if (scrim > 0) {
    s.push(`<radialGradient id="sc" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0" stop-color="${C.ink}" stop-opacity="${scrim.toFixed(3)}"/>
      <stop offset="1" stop-color="${C.ink}" stop-opacity="0"/></radialGradient>`);
  }
  // A full-width band needs a band-shaped scrim, not a radial one: the radial
  // falls off before the end of a line, so the last words of the body copy sat
  // unscrimmed on a lit shoulder.
  const band = box.name === 'top-band' || box.name === 'bottom-band';
  if (band) {
    const down = box.name === 'top-band';
    s.push(`<linearGradient id="bandsc" x1="0" y1="${down ? 0 : 1}" x2="0" y2="${down ? 1 : 0}">
      <stop offset="0" stop-color="${C.ink}" stop-opacity="${Math.max(0.55, scrim + 0.28).toFixed(3)}"/>
      <stop offset="0.72" stop-color="${C.ink}" stop-opacity="${Math.max(0.34, scrim).toFixed(3)}"/>
      <stop offset="1" stop-color="${C.ink}" stop-opacity="0"/></linearGradient>`);
  }
  s.push('</defs>');
  s.push(`<rect x="0" y="${H - 300}" width="${W}" height="300" fill="url(#foot)"/>`);
  if (band) {
    const top = box.name === 'top-band' ? 0 : box.y - 60;
    s.push(`<rect x="0" y="${top}" width="${W}" height="${box.y + box.h + 110 - top}" fill="url(#bandsc)"/>`);
  } else if (scrim > 0) {
    s.push(`<rect x="${box.x - 70}" y="${box.y - 70}" width="${box.w + 140}" height="${box.h + 140}" fill="url(#sc)"/>`);
  }

  s.push(laid.svg);

  // furniture
  s.push(T('mono', 46, H - 52, `${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { size: 23, fill: C.bone, op: 0.5 }));
  s.push(T('mono', W - 46, H - 52, CAMPAIGN.handle, { size: 23, fill: C.stone, anchor: 'end' }));
  s.push(`<rect x="0" y="0" width="${W}" height="6" fill="${C.stone}" opacity="${n === 1 ? 1 : 0.32}"/>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s.join('')}</svg>`;
  const file = path.join(OUT, `slide-${n}.png`);
  fs.writeFileSync(file, new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false, defaultFontFamily: 'Archivo', fontFiles: FONT_FILES },
  }).render().asPng());
  return { file, box: box.name, score: box.score, scrim: +scrim.toFixed(2), headSize: laid.headSize };
}

/** Font-fallback preflight — resvg matches the typographic family, and a silent
 *  fallback renders 40% wider than the fitter allowed. */
export async function preflightFonts(tolerance = 0.04) {
  const probe = 'HAMBURGEFONSTIV 1234';
  const bad = [];
  for (const [kind, f] of Object.entries(FACE)) {
    const expected = layoutWidth(loadFace(f.file), probe, 100);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="260"><rect width="4000" height="260" fill="#fff"/>` +
      `<text x="20" y="180" font-family="${f.family}" font-weight="${f.weight}" font-size="100" fill="#000">${probe}</text></svg>`;
    const buf = new Resvg(svg, { font: { loadSystemFonts: false, defaultFontFamily: 'Archivo', fontFiles: FONT_FILES } }).render().asPng();
    const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, maxX = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
    const drift = Math.abs((maxX - minX) - expected) / expected;
    if (drift > tolerance) bad.push(`${kind}: "${f.family}" ${f.weight} off by ${(drift * 100).toFixed(0)}%`);
  }
  if (bad.length) throw new Error('font fallback detected:\n  ' + bad.join('\n  '));
}

export const COPY = {
  campaign: CAMPAIGN,
  slides: SLIDES.map((s) => ({ headline: s.head.join(' '), body: s.body })),
};

export async function build() {
  fs.mkdirSync(OUT, { recursive: true });
  await preflightFonts();
  const report = [];
  let prev = null;
  for (let i = 0; i < SLIDES.length; i++) {
    const r = await buildSlide(SLIDES[i], i + 1, SLIDES.length, prev);
    prev = r.box; report.push(r);
  }
  return report;
}

if (process.argv[1] && process.argv[1].endsWith('teach.mjs')) {
  build().then((r) => r.forEach((x, i) => console.log(`slide-${i + 1}`.padEnd(9), 'box=' + x.box.padEnd(13), 'emptiness=' + String(x.score).padStart(6), 'scrim=' + String(x.scrim).padEnd(5), 'head=' + x.headSize + 'px')))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
