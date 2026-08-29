// The ATLAS app screen, rendered at real phone resolution so it can be warped
// into a photograph of a phone without softening.
//
// The palette is not a free choice: the accent is sampled from the rim light in
// the photograph it gets composited into, so the glow on the glass and the glow
// in the room are the same colour. That single decision is most of why the
// composite reads as a photograph of an app rather than a screenshot on a photo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const F = (n) => path.join(ROOT, 'assets/fonts', n);

export const W = 900, H = 1950;

const C = {
  bg: '#0A0B0D', card: '#15181C', card2: '#1D2126', line: '#262B31',
  text: '#FFFFFF', muted: '#79818C', dim: '#4A515A',
  accent: '#FF6A1A', red: '#FF4D4D', amber: '#FFB020', green: '#34D07F',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const t = (x, y, s, { size = 28, w = 500, fill = C.text, anchor = 'start', mono = false, ls = 0, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${mono ? 'JetBrains Mono' : 'Archivo'}" font-size="${size}" ` +
  `font-weight="${w}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}">${esc(s)}</text>`;

const rect = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

/** A 270-degree gauge arc, opening at the bottom. */
function ring(cx, cy, r, pct, { track = C.card2, fill = C.accent, sw = 16 } = {}) {
  const start = 135, sweep = 270;
  const pt = (deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const arc = (from, to, colour) => {
    const [x1, y1] = pt(from), [x2, y2] = pt(to);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" ` +
      `stroke="${colour}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
  };
  return arc(start, start + sweep, track) + arc(start, start + sweep * pct, fill);
}

/** iOS status bar. The details here are load-bearing — a missing battery cap is
 *  the kind of thing that makes a mock feel like a mock. */
function statusBar() {
  const y = 46;
  let s = t(64, y + 10, '9:41', { size: 30, w: 600 });
  // signal bars
  let bars = '';
  for (let i = 0; i < 4; i++) bars += rect(700 + i * 13, y - 4 - i * 5, 9, 12 + i * 5, 2, i < 4 ? C.text : C.dim);
  // wifi
  const wifi = `<path d="M 762 ${y + 6} a 22 22 0 0 1 26 0" stroke="${C.text}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<path d="M 756 ${y - 2} a 34 34 0 0 1 38 0" stroke="${C.text}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<circle cx="775" cy="${y + 12}" r="4" fill="${C.text}"/>`;
  const batt = rect(806, y - 6, 44, 22, 6, 'none', `stroke="${C.text}" stroke-opacity="0.55" stroke-width="3"`) +
    rect(810, y - 2, 28, 14, 3, C.text) +
    rect(852, y, 4, 10, 2, C.text, 'opacity="0.55"');
  return s + bars + wifi + batt +
    // dynamic island
    rect(360, 20, 180, 48, 24, '#000000', 'stroke="#1A1D21" stroke-width="1"');
}

function metricRow(x, y, label, value, delta, colour) {
  return `<circle cx="${x + 8}" cy="${y - 9}" r="7" fill="${colour}"/>` +
    t(x + 30, y, label, { size: 25, w: 500, fill: C.muted }) +
    t(x + 330, y, value, { size: 27, w: 700, anchor: 'end', mono: true }) +
    (delta ? t(x + 330, y + 34, delta, { size: 22, w: 500, fill: colour, anchor: 'end', mono: true }) : '');
}

function swapRow(y, lift, was, now, tag = 'ADJUSTED') {
  // 15.2 is JetBrains Mono's advance at 25px; the earlier 14 left the strike
  // stopping short of the last glyph, which reads as a rendering bug.
  return t(60, y, lift, { size: 29, w: 600 }) +
    t(60, y + 38, was, { size: 25, w: 500, fill: C.dim, mono: true }) +
    `<line x1="56" y1="${y + 30}" x2="${58 + was.length * 15.2}" y2="${y + 30}" stroke="${C.dim}" stroke-width="2"/>` +
    t(840, y + 4, now, { size: 31, w: 700, fill: C.accent, anchor: 'end', mono: true }) +
    (tag ? t(840, y + 40, tag, { size: 19, w: 700, fill: C.muted, anchor: 'end', ls: 2 }) : '');
}

export function screenSvg() {
  const P = [];
  P.push(rect(0, 0, W, H, 0, C.bg));
  P.push(statusBar());

  /* header */
  P.push(t(60, 168, 'THURSDAY 29 AUG', { size: 23, w: 600, fill: C.muted, ls: 3 }));
  P.push(t(58, 232, 'Today', { size: 62, w: 700 }));
  P.push(rect(662, 130, 190, 54, 27, C.card));
  P.push(t(686, 166, 'STREAK', { size: 21, w: 700, fill: C.muted, ls: 2 }));
  P.push(t(830, 167, '41', { size: 27, w: 700, fill: C.accent, anchor: 'end', mono: true }));

  /* readiness card */
  P.push(rect(48, 280, 804, 300, 34, C.card));
  P.push(ring(190, 430, 92, 0.61));
  P.push(t(190, 442, '61', { size: 76, w: 700, anchor: 'middle', mono: true }));
  P.push(t(190, 480, 'READINESS', { size: 20, w: 700, fill: C.muted, anchor: 'middle', ls: 3 }));
  P.push(metricRow(470, 360, 'Sleep', '5h 12m', '− 2h 48m', C.red));
  P.push(metricRow(470, 452, 'HRV', '42 ms', '− 18%', C.red));
  P.push(metricRow(470, 544, 'Resting HR', '58 bpm', '+ 6 bpm', C.amber));

  /* the decision */
  P.push(rect(48, 612, 804, 158, 28, 'rgba(255,106,26,0.10)', `stroke="${C.accent}" stroke-opacity="0.35" stroke-width="2"`));
  P.push(rect(48, 612, 8, 158, 4, C.accent));
  P.push(t(84, 668, 'SESSION ADJUSTED', { size: 22, w: 700, fill: C.accent, ls: 3 }));
  P.push(t(84, 712, 'Volume cut 39%. You are not', { size: 30, w: 500 }));
  P.push(t(84, 750, 'recovered enough to hit 5×5.', { size: 30, w: 500 }));

  /* swaps */
  P.push(t(60, 848, "TODAY'S SESSION", { size: 22, w: 700, fill: C.muted, ls: 3 }));
  P.push(swapRow(918, 'Back squat', '5×5  ·  102 kg', '3×5 · 84 kg'));
  P.push(`<line x1="48" y1="990" x2="852" y2="990" stroke="${C.line}" stroke-width="2"/>`);
  P.push(swapRow(1046, 'Romanian deadlift', '4×8  ·  80 kg', '3×8 · 70 kg'));
  P.push(`<line x1="48" y1="1118" x2="852" y2="1118" stroke="${C.line}" stroke-width="2"/>`);
  P.push(swapRow(1174, 'Walking lunge', '3×12 · 24 kg', 'REMOVED', ''));

  /* volume bars */
  P.push(rect(48, 1268, 804, 330, 34, C.card));
  P.push(t(84, 1330, 'WEEKLY TONNAGE', { size: 22, w: 700, fill: C.muted, ls: 3 }));
  P.push(t(816, 1336, '11,100 kg', { size: 32, w: 700, anchor: 'end', mono: true, fill: C.accent }));
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const vals = [0.72, 0.88, 0.54, 0.38, 0.0, 0.0, 0.0];
  const today = 3;
  for (let i = 0; i < 7; i++) {
    const bx = 92 + i * 104, bh = Math.max(6, vals[i] * 170);
    const isToday = i === today;
    P.push(rect(bx, 1370, 66, 170, 14, C.card2));
    if (vals[i] > 0) P.push(rect(bx, 1370 + (170 - bh), 66, bh, 14, isToday ? C.accent : '#39414A'));
    P.push(t(bx + 33, 1580, days[i], { size: 24, w: isToday ? 700 : 500, fill: isToday ? C.text : C.dim, anchor: 'middle' }));
  }
  // the cut, drawn as the gap it actually is
  P.push(`<line x1="92" y1="1384" x2="820" y2="1384" stroke="${C.dim}" stroke-width="2" stroke-dasharray="8 8"/>`);
  P.push(t(816, 1374, 'planned 18,400', { size: 20, w: 500, fill: C.dim, anchor: 'end', mono: true }));

  /* footer note */
  P.push(t(60, 1680, 'Atlas rebuilt this session 4 minutes', { size: 27, w: 500, fill: C.muted }));
  P.push(t(60, 1718, 'after your watch synced.', { size: 27, w: 500, fill: C.muted }));

  /* tab bar */
  P.push(rect(0, 1790, W, 160, 0, '#101215'));
  P.push(`<line x1="0" y1="1790" x2="${W}" y2="1790" stroke="${C.line}" stroke-width="2"/>`);
  const tabs = ['Today', 'Train', 'Trends', 'You'];
  tabs.forEach((label, i) => {
    const cx = 112 + i * 225;
    const on = i === 0;
    P.push(rect(cx - 20, 1832, 40, 40, 10, on ? C.accent : C.dim, on ? '' : 'opacity="0.7"'));
    P.push(t(cx, 1908, label, { size: 23, w: on ? 700 : 500, fill: on ? C.text : C.dim, anchor: 'middle' }));
  });
  P.push(rect(330, 1928, 240, 8, 4, '#3A424B'));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${P.join('')}</svg>`;
}

export function renderScreen(outFile) {
  const svg = screenSvg();
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: {
      loadSystemFonts: false,
      defaultFontFamily: 'Archivo',
      fontFiles: [
        F('Archivo-Regular.ttf'), F('Archivo-Medium.ttf'), F('Archivo-SemiBold.ttf'),
        F('Archivo-Bold.ttf'), F('Archivo-ExtraBold.ttf'),
        F('JetBrainsMono-Regular.ttf'), F('JetBrainsMono-Medium.ttf'), F('JetBrainsMono-Bold.ttf'),
      ],
    },
  });
  const png = r.render().asPng();
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, png);
  return outFile;
}

if (process.argv[1] && process.argv[1].endsWith('app-screen.mjs')) {
  console.log(renderScreen(path.join(ROOT, 'output/atlas/app/screen.png')));
}
