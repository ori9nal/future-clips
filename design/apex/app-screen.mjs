// The APEX progress screen, rendered at full phone resolution.
//
// In the reference sets the payload slide is not a designed poster with a phone
// in it — it is the app's own screen, full bleed, with a caption dropped on
// top. So this is built to BE that screenshot: real status bar, real home
// indicator, real density, tier colours saturated the way tracking apps
// actually colour them.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const F = (n) => path.join(ROOT, 'assets/fonts', `${n}.ttf`);

export const W = 1080, H = 1920;

const C = {
  bg: '#0B0B0C', card: '#16171A', card2: '#1F2126', line: '#2A2D33',
  text: '#FFFFFF', muted: '#7C838D', dim: '#4A515A', accent: '#FF5A1F',
};
// tier ramp, saturated the way tracking apps do it
const TIERS = [
  ['Beginner', '#E5484D'], ['Novice', '#F5A524'], ['Intermediate', '#30A46C'],
  ['Advanced', '#0091FF'], ['Elite', '#8E4EC6'], ['World Class', '#F4467F'],
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const R = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

function T(x, y, s, { size = 30, w = 700, fill = C.text, anchor = 'start', ls = 0, op = 1, mono = false } = {}) {
  const fam = mono ? 'JetBrains Mono' : (w >= 700 ? 'Poppins' : 'Poppins SemiBold');
  const weight = mono ? 700 : (w >= 700 ? 700 : 400);
  return `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" font-weight="${weight}" ` +
    `fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}">${esc(s)}</text>`;
}

/** iOS chrome. Missing details are what make a mock look like a mock. */
function chrome() {
  const y = 62;
  let s = T(88, y + 12, '9:41', { size: 36, w: 700 });
  for (let i = 0; i < 4; i++) s += R(846 + i * 16, y - 6 - i * 6, 11, 15 + i * 6, 3, C.text);
  s += `<path d="M 926 ${y + 8} a 26 26 0 0 1 32 0" stroke="${C.text}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<path d="M 918 ${y - 2} a 40 40 0 0 1 48 0" stroke="${C.text}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="942" cy="${y + 16}" r="5" fill="${C.text}"/>`;
  s += R(986, y - 8, 54, 27, 8, 'none', `stroke="${C.text}" stroke-opacity="0.5" stroke-width="3"`) +
    R(991, y - 3, 36, 17, 4, C.text) + R(1043, y - 1, 5, 13, 2, C.text, 'opacity="0.5"');
  s += R(430, 26, 220, 58, 29, '#000000', `stroke="#17181B" stroke-width="1"`);
  return s;
}

/** Where a lift sits on the tier ramp, drawn as a segmented bar with a marker. */
function liftRow(y, name, kg, delta, pct) {
  const x = 56, w = 968, segW = w / TIERS.length;
  let s = T(x, y, name, { size: 38, w: 700 });
  s += T(x + w, y, `${kg} kg`, { size: 38, w: 700, anchor: 'end', mono: true });
  s += T(x + w, y + 42, delta, { size: 27, w: 400, fill: delta.startsWith('+') ? '#30A46C' : C.muted, anchor: 'end', mono: true });
  const by = y + 66;
  TIERS.forEach(([, colour], i) => {
    s += R(x + i * segW + (i ? 4 : 0), by, segW - (i ? 8 : 4), 22, 11, colour, 'opacity="0.30"');
  });
  const filled = Math.floor(pct * TIERS.length);
  for (let i = 0; i < filled; i++) {
    s += R(x + i * segW + (i ? 4 : 0), by, segW - (i ? 8 : 4), 22, 11, TIERS[i][1]);
  }
  const mx = x + pct * w;
  s += `<circle cx="${mx.toFixed(0)}" cy="${by + 11}" r="17" fill="${C.text}" stroke="${C.bg}" stroke-width="5"/>`;
  return s;
}

export function screenSvg() {
  const P = [R(0, 0, W, H, 0, C.bg), chrome()];

  P.push(T(56, 210, 'Strength Progress', { size: 56, w: 700 }));
  P.push(T(1024, 210, '12 months', { size: 40, w: 700, fill: C.accent, anchor: 'end' }));

  /* score card */
  P.push(R(56, 262, 968, 300, 40, C.card));
  P.push(T(104, 356, 'APEX SCORE', { size: 26, w: 400, fill: C.muted, ls: 4 }));
  P.push(T(104, 470, '742', { size: 130, w: 700, mono: true }));
  P.push(R(330, 402, 250, 60, 30, 'rgba(0,145,255,0.18)'));
  P.push(T(455, 444, 'Advanced', { size: 32, w: 700, fill: '#0091FF', anchor: 'middle' }));
  P.push(T(1000, 356, 'Aug 2026', { size: 25, w: 400, fill: C.muted, anchor: 'end' }));
  // 12-month line
  const vals = [0.30, 0.34, 0.33, 0.41, 0.47, 0.45, 0.55, 0.60, 0.58, 0.68, 0.74, 0.82];
  const gx = 620, gw = 380, gy = 380, gh = 130;
  let d = '';
  vals.forEach((v, i) => {
    const px = gx + (i / (vals.length - 1)) * gw, py = gy + gh - v * gh;
    d += `${i ? 'L' : 'M'} ${px.toFixed(1)} ${py.toFixed(1)} `;
  });
  P.push(`<path d="${d}" stroke="${C.accent}" stroke-width="6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`);
  P.push(`<circle cx="${gx + gw}" cy="${(gy + gh - vals[11] * gh).toFixed(1)}" r="11" fill="${C.accent}"/>`);
  P.push(T(1000, 540, '+128 this year', { size: 26, w: 400, fill: '#30A46C', anchor: 'end', mono: true }));

  /* lifts */
  P.push(T(56, 660, 'YOUR LIFTS', { size: 26, w: 400, fill: C.muted, ls: 4 }));
  P.push(liftRow(730, 'Back squat', 142, '+22 kg', 0.63));
  P.push(liftRow(900, 'Deadlift', 180, '+30 kg', 0.71));
  P.push(liftRow(1070, 'Bench press', 102, '+14 kg', 0.55));

  /* tier legend */
  P.push(T(56, 1240, 'TIERS', { size: 26, w: 400, fill: C.muted, ls: 4 }));
  let lx = 56, ly = 1276;
  TIERS.forEach(([label, colour]) => {
    const wpx = 22 + label.length * 19 + 30;
    if (lx + wpx > 1024) { lx = 56; ly += 76; }
    P.push(R(lx, ly, wpx, 58, 29, colour));
    P.push(T(lx + wpx / 2, ly + 39, label, { size: 26, w: 700, fill: '#0B0B0C', anchor: 'middle' }));
    lx += wpx + 14;
  });

  /* footnote + tab bar */
  P.push(T(56, ly + 118, 'Ranked against 1.2M logged sessions', { size: 28, w: 400, fill: C.muted }));
  P.push(R(0, 1740, W, 180, 0, '#101114'));
  P.push(`<line x1="0" y1="1740" x2="${W}" y2="1740" stroke="${C.line}" stroke-width="2"/>`);
  ['Today', 'Train', 'Progress', 'You'].forEach((label, i) => {
    const cx = 135 + i * 270, on = i === 2;
    P.push(R(cx - 24, 1786, 48, 48, 12, on ? C.accent : C.dim, on ? '' : 'opacity="0.65"'));
    P.push(T(cx, 1876, label, { size: 27, w: on ? 700 : 400, fill: on ? C.text : C.dim, anchor: 'middle' }));
  });
  P.push(R(390, 1896, 300, 9, 5, '#3A424B'));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${P.join('')}</svg>`;
}

export function renderScreen(outFile) {
  const r = new Resvg(screenSvg(), {
    fitTo: { mode: 'width', value: W },
    font: {
      loadSystemFonts: false, defaultFontFamily: 'Poppins',
      fontFiles: [F('Poppins-Bold'), F('Poppins-SemiBold'), F('JetBrainsMono-Bold'), F('JetBrainsMono-Medium')],
    },
  });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, r.render().asPng());
  return outFile;
}

if (process.argv[1] && process.argv[1].endsWith('app-screen.mjs')) {
  console.log(renderScreen(path.join(ROOT, 'output/apex/app-progress.png')));
}
