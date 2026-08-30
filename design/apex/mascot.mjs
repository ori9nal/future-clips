// APEX — the same campaign, rendered mascot-led.
//
// The point of this file is that it shares EVERYTHING with native.mjs except
// the drawing: same campaign JSON, same ranked array, same copy, same required
// mention. A style is a renderer, not a rewrite — so when an agency supplies a
// mascot and asks for a character-led set instead of a camera-roll set, nothing
// about the campaign has to change.
//
// A mascot is also the one character problem that is trivially solvable: it is
// ONE asset reused on every frame, so nothing has to stay consistent across
// generations. It matted at 0.023 translucency against a 0.06 limit — flat
// vector on a light ground is the case background removal is actually good at,
// where the photographic faces earlier failed between 0.20 and 0.97.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { loadFace } from '../../engine/fonts.mjs';
import { fitLines, layoutWidth } from '../../engine/fit-text.mjs';
import { RANKED, HOOK, CAMPAIGN } from './native.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'output/apex-mascot');

export const W = 1080, H = 1920;

// straight off the campaign brief's supplied palette
const [INK, ORANGE, BONE] = CAMPAIGN.assets_supplied_by_agency.palette;
const MASCOT = path.join(ROOT, 'output/mascot/m4-cut.png');

const FACE = {
  shout: { file: 'Poppins-Bold', family: 'Poppins', weight: 700 },
  body:  { file: 'Poppins-SemiBold', family: 'Poppins SemiBold', weight: 400 },
  mono:  { file: 'JetBrainsMono-Bold', family: 'JetBrains Mono', weight: 700 },
};
const FONT_FILES = Object.values(FACE).map((f) => path.join(ROOT, 'assets/fonts', `${f.file}.ttf`));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function T(kind, x, y, s, { size = 40, fill = BONE, anchor = 'start', ls = 0, op = 1 } = {}) {
  const f = FACE[kind];
  return `<text x="${x}" y="${y}" font-family="${f.family}" font-weight="${f.weight}" font-size="${size}" ` +
    `fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}">${esc(s)}</text>`;
}
const R = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

function stack(kind, lines, box, o = {}) {
  const face = loadFace(FACE[kind].file);
  const fit = fitLines(face, lines, box, { min: 28, max: o.max ?? 130, lineHeight: o.lineHeight ?? 1.02, tracking: -0.01, autoLeading: true });
  if (!fit) throw new Error(`mascot headline does not fit: ${lines.join(' / ')}`);
  const lh = fit.lineHeight ?? 1.02;
  let out = '', y = box.y + fit.size * (face.capHeight / face.upm);
  for (const l of fit.lines) {
    out += T(kind, box.x, Math.round(y), l, { size: fit.size, fill: o.fill ?? BONE, ls: fit.trackingPx });
    y += fit.size * lh;
  }
  return { svg: out, size: fit.size, bottom: y - fit.size * lh + fit.size * 0.3 };
}

let uid = 0;
/** The mascot, placed. One asset, reused — that is the whole trick. */
function mascot(x, y, w, { rot = 0, flip = false } = {}) {
  const h = w;
  const t = [];
  if (rot) t.push(`rotate(${rot} ${x + w / 2} ${y + h / 2})`);
  if (flip) t.push(`translate(${2 * x + w} 0) scale(-1 1)`);
  const g = t.length ? ` transform="${t.join(' ')}"` : '';
  return `<g${g}><image href="data:image/png;base64,${fs.readFileSync(MASCOT).toString('base64')}" ` +
    `x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/></g>`;
}

/**
 * A speech bubble sized to its text. The first version clamped the BUBBLE to a
 * max width and left the type at a fixed 40px, so the longest line ran straight
 * out through the side of the bubble. Fit the type first, then let the bubble
 * take its size from what actually fitted.
 */
function speech(x, y, maxW, lines, { tail = 'left' } = {}) {
  const face = loadFace(FACE.body.file);
  const pad = 34, lh = 1.3;
  const inner = maxW - pad * 2;
  const fit = fitLines(face, lines, { x, y, w: inner, h: 900 },
    { min: 26, max: 42, lineHeight: lh, tracking: 0, autoLeading: true });
  if (!fit) throw new Error(`speech does not fit: ${lines.join(' / ')}`);
  const used = fit.lineHeight ?? lh;
  const widest = Math.max(...fit.lines.map((l) => layoutWidth(face, l, fit.size)));
  const bw = Math.round(widest + pad * 2);
  const bh = Math.round(fit.lines.length * fit.size * used + pad * 1.5);
  let s = R(x, y, bw, bh, 34, BONE);
  const tx = tail === 'left' ? x + 66 : x + bw - 66;
  s += `<path d="M ${tx - 24} ${y + bh - 2} L ${tx + 24} ${y + bh - 2} L ${tx + (tail === 'left' ? 4 : -4)} ${y + bh + 36} Z" fill="${BONE}"/>`;
  let ty = y + pad + fit.size * (face.capHeight / face.upm);
  for (const l of fit.lines) {
    s += T('body', x + pad, Math.round(ty), l, { size: fit.size, fill: INK });
    ty += fit.size * used;
  }
  return { svg: s, width: bw, bottom: y + bh + 36 };
}

/* ── slides ─────────────────────────────────────────────────────────────── */

function cover() {
  const s = [R(0, 0, W, H, 0, ORANGE)];
  s.push(R(0, 0, W, 26, 0, INK));
  s.push(T('mono', 54, 130, CAMPAIGN.brand + ' — ' + CAMPAIGN.product.toUpperCase(), { size: 26, fill: INK, ls: 5 }));
  const head = stack('shout', HOOK.lines, { x: 54, y: 180, w: 972, h: 560 }, { max: 132, fill: INK });
  s.push(head.svg);
  s.push(R(54, head.bottom + 26, 200, 12, 6, INK));
  s.push(T('body', 54, head.bottom + 116, HOOK.sub[0], { size: 46, fill: INK, op: 0.78 }));
  s.push(mascot(150, H - 900, 800));
  s.push(T('mono', 54, H - 60, CAMPAIGN.requirements.required_mention, { size: 28, fill: INK, op: 0.7 }));
  return s.join('');
}

function rankSlide(item, rank, i) {
  const s = [R(0, 0, W, H, 0, INK)];
  s.push(R(0, 0, W, 26, 0, ORANGE));
  // big ghosted rank number, so the countdown is legible at a glance
  s.push(T('shout', W - 40, 300, String(rank), { size: 380, fill: ORANGE, anchor: 'end', op: 0.16 }));
  s.push(T('mono', 54, 130, `RANK ${rank} OF ${RANKED.length}`, { size: 26, fill: ORANGE, ls: 5 }));

  const head = stack('shout', item.name.toUpperCase().split(' ').length > 2
    ? [item.name.split(' ').slice(0, 2).join(' ').toUpperCase(), item.name.split(' ').slice(2).join(' ').toUpperCase()]
    : [item.name.toUpperCase()], { x: 54, y: 186, w: 972, h: 300 }, { max: 116 });
  s.push(head.svg);

  s.push(R(54, head.bottom + 24, 210, 86, 43, ORANGE));
  s.push(T('shout', 159, head.bottom + 84, item.score, { size: 48, fill: INK, anchor: 'middle' }));

  // alternate the side so four ranked slides do not read as one slide repeated
  const flip = i % 2 === 1;
  const b = speech(flip ? 300 : 60, 700, 720, item.lines, { tail: flip ? 'left' : 'right' });
  s.push(b.svg);
  s.push(mascot(flip ? 20 : W - 620, H - 780, 600, { flip }));

  s.push(T('mono', 54, H - 60, CAMPAIGN.requirements.required_mention, { size: 28, fill: BONE, op: 0.55 }));
  return s.join('');
}

function closer() {
  const s = [R(0, 0, W, H, 0, BONE)];
  s.push(R(0, 0, W, 26, 0, ORANGE));
  const head = stack('shout', ['WRITE IT', 'DOWN OR', 'GUESS.'], { x: 54, y: 170, w: 972, h: 520 }, { max: 170, fill: INK });
  s.push(head.svg);
  s.push(mascot(240, 780, 620));
  s.push(R(54, H - 300, 972, 130, 65, INK));
  s.push(T('shout', W / 2, H - 212, `Follow ${CAMPAIGN.requirements.required_mention}`, { size: 52, fill: ORANGE, anchor: 'middle' }));
  s.push(T('mono', W / 2, H - 90, 'FREE FOR 14 DAYS', { size: 28, fill: INK, anchor: 'middle', ls: 4, op: 0.65 }));
  return s.join('');
}

function png(body, file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  fs.writeFileSync(file, new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false, defaultFontFamily: 'Poppins', fontFiles: FONT_FILES },
  }).render().asPng());
  return file;
}

export async function build() {
  if (!fs.existsSync(MASCOT)) throw new Error(`mascot asset missing: ${MASCOT}`);
  fs.mkdirSync(OUT, { recursive: true });
  const made = [png(cover(), path.join(OUT, 'slide-1.png'))];
  RANKED.forEach((item, i) => {
    made.push(png(rankSlide(item, RANKED.length - i, i), path.join(OUT, `slide-${i + 2}.png`)));
  });
  made.push(png(closer(), path.join(OUT, `slide-${RANKED.length + 2}.png`)));
  return made;
}

if (process.argv[1] && process.argv[1].endsWith('mascot.mjs')) {
  build().then((f) => console.log(f.map((x) => path.basename(x)).join('  ')))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
