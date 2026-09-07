// The TradeLens App analysis screen, at phone resolution.
//
// The brief supplies in-app screenshots in a Drive folder this engine cannot
// reach, so the screen is rendered rather than mocked in a design tool — real
// status bar, real density, a real candle series, and the exact fields the
// brief says the app returns: trend, pattern, support and resistance, a
// Long/Short/Hold signal, entry, stop-loss, target, and news sentiment.
//
// Nothing here shows a profit or a return. The brief bans guaranteed-profit
// claims and fake profit screenshots, and a rendered P&L figure is exactly the
// thing a reviewer would bin the post for.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { fontFiles } from '../../engine/styles/kit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const W = 1080, H = 1920;

const C = {
  bg: '#0A0D12', card: '#141922', line: '#232B36', text: '#FFFFFF',
  muted: '#7E8896', up: '#2FD07F', down: '#F2555A', accent: '#2F7BFF',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const R = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

function T(x, y, s, { size = 30, w = 700, fill = C.text, anchor = 'start', ls = 0, mono = false, op } = {}) {
  const fam = mono ? 'JetBrains Mono' : 'Archivo';
  const weight = mono ? 700 : w;
  return `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" font-weight="${weight}" ` +
    `fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}"${op != null ? ` opacity="${op}"` : ''}>${esc(s)}</text>`;
}

function chrome() {
  const y = 62;
  let s = T(88, y + 12, '9:41', { size: 36, w: 700 });
  for (let i = 0; i < 4; i++) s += R(846 + i * 16, y - 6 - i * 6, 11, 15 + i * 6, 3, C.text);
  s += `<path d="M 926 ${y + 8} a 26 26 0 0 1 32 0" stroke="${C.text}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<path d="M 918 ${y - 2} a 40 40 0 0 1 48 0" stroke="${C.text}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="942" cy="${y + 16}" r="5" fill="${C.text}"/>`;
  s += R(986, y - 8, 54, 27, 8, 'none', `stroke="${C.text}" stroke-opacity="0.5" stroke-width="3"`) +
    R(991, y - 3, 36, 17, 4, C.text) + R(1043, y - 1, 5, 13, 2, C.text, 'opacity="0.5"');
  s += R(430, 26, 220, 58, 29, '#000000', 'stroke="#12161D" stroke-width="1"');
  return s;
}

/** A deterministic candle series, so the chart is the same on every render. */
function candles(x, y, w, h, n = 34) {
  let seed = 20260907;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const cw = w / n, body = cw * 0.56;
  let price = 0.42, out = '', lo = 1, hi = 0;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const drift = (i / n) * 0.30;
    const o = price;
    price = Math.max(0.05, Math.min(0.95, price + (rnd() - 0.46) * 0.075 + 0.008));
    const c = price;
    const wickHi = Math.max(o, c) + rnd() * 0.045;
    const wickLo = Math.min(o, c) - rnd() * 0.045;
    bars.push({ o: o + drift * 0.1, c: c + drift * 0.1, hi: wickHi + drift * 0.1, lo: wickLo + drift * 0.1 });
  }
  for (const b of bars) { lo = Math.min(lo, b.lo); hi = Math.max(hi, b.hi); }
  const Y = (v) => y + h - ((v - lo) / (hi - lo)) * h;
  bars.forEach((b, i) => {
    const cx = x + i * cw + cw / 2, up = b.c >= b.o;
    const col = up ? C.up : C.down;
    out += `<line x1="${cx.toFixed(1)}" y1="${Y(b.hi).toFixed(1)}" x2="${cx.toFixed(1)}" y2="${Y(b.lo).toFixed(1)}" stroke="${col}" stroke-width="2.5"/>`;
    const top = Y(Math.max(b.o, b.c)), bot = Y(Math.min(b.o, b.c));
    out += R((cx - body / 2).toFixed(1), top.toFixed(1), body.toFixed(1), Math.max(3, bot - top).toFixed(1), 2, col);
  });
  // lo/hi are the ACTUAL data range. Support and resistance must be derived
  // from it — the first version placed them at fixed prices, and once the
  // series drifted upward the support line mapped outside the chart box and
  // drew straight across the signal card below it.
  return { svg: out, Y, lo, hi, last: bars[bars.length - 1] };
}

function levelRow(y, label, value, colour) {
  return R(56, y, 968, 104, 18, C.card)
    + R(56, y, 6, 104, 3, colour)
    + T(96, y + 44, label, { size: 26, w: 500, fill: C.muted, ls: 1.5 })
    + T(96, y + 82, value, { size: 34, w: 700, mono: true, fill: C.text })
    + T(1000, y + 66, '', { size: 26, anchor: 'end' });
}

export function screenSvg() {
  const P = [R(0, 0, W, H, 0, C.bg), chrome()];

  /* header */
  P.push(T(56, 200, 'BTC / USD', { size: 52, w: 700 }));
  P.push(T(56, 246, '4H · analysed 12s ago', { size: 26, w: 400, fill: C.muted }));
  P.push(R(824, 158, 200, 62, 31, 'rgba(47,123,255,0.16)'));
  P.push(T(924, 199, 'AI REPORT', { size: 24, w: 700, fill: C.accent, anchor: 'middle', ls: 1.6 }));

  /* chart */
  P.push(R(56, 286, 968, 470, 24, C.card));
  const ch = candles(96, 330, 888, 382);
  // support and resistance as fractions of the real range, so both always land
  // inside the chart whatever the series did
  const at = (t) => ch.lo + (ch.hi - ch.lo) * t;
  const resistance = ch.Y(at(0.88)), support = ch.Y(at(0.16));
  P.push(ch.svg);
  P.push(`<line x1="96" y1="${resistance.toFixed(1)}" x2="984" y2="${resistance.toFixed(1)}" stroke="${C.down}" stroke-width="2.5" stroke-dasharray="10 8" opacity="0.85"/>`);
  P.push(R(806, resistance - 34, 178, 30, 6, C.bg, 'opacity="0.85"'));
  P.push(T(978, resistance - 12, 'RESISTANCE', { size: 20, w: 700, fill: C.down, anchor: 'end', ls: 1.4 }));
  P.push(`<line x1="96" y1="${support.toFixed(1)}" x2="984" y2="${support.toFixed(1)}" stroke="${C.up}" stroke-width="2.5" stroke-dasharray="10 8" opacity="0.85"/>`);
  P.push(R(852, support + 8, 132, 30, 6, C.bg, 'opacity="0.85"'));
  P.push(T(978, support + 30, 'SUPPORT', { size: 20, w: 700, fill: C.up, anchor: 'end', ls: 1.4 }));

  /* signal */
  P.push(R(56, 792, 968, 168, 24, 'rgba(47,208,127,0.12)'));
  P.push(R(56, 792, 6, 168, 3, C.up));
  P.push(T(100, 856, 'SIGNAL', { size: 24, w: 500, fill: C.muted, ls: 3 }));
  P.push(T(100, 922, 'LONG', { size: 62, w: 700, fill: C.up }));
  P.push(T(984, 856, 'CONFIDENCE', { size: 22, w: 500, fill: C.muted, ls: 2, anchor: 'end' }));
  P.push(T(984, 918, '72%', { size: 52, w: 700, mono: true, fill: C.text, anchor: 'end' }));

  /* levels */
  P.push(T(56, 1024, 'LEVELS', { size: 24, w: 500, fill: C.muted, ls: 3 }));
  P.push(levelRow(1050, 'ENTRY', '64,180', C.accent));
  P.push(levelRow(1170, 'STOP LOSS', '62,400', C.down));
  P.push(levelRow(1290, 'TARGET', '68,900', C.up));

  /* structure read */
  P.push(T(56, 1466, 'STRUCTURE', { size: 24, w: 500, fill: C.muted, ls: 3 }));
  P.push(R(56, 1494, 472, 104, 18, C.card));
  P.push(T(92, 1538, 'TREND', { size: 22, w: 500, fill: C.muted, ls: 1.4 }));
  P.push(T(92, 1576, 'Higher lows', { size: 30, w: 700 }));
  P.push(R(552, 1494, 472, 104, 18, C.card));
  P.push(T(588, 1538, 'PATTERN', { size: 22, w: 500, fill: C.muted, ls: 1.4 }));
  P.push(T(588, 1576, 'Ascending triangle', { size: 30, w: 700 }));

  /* sentiment */
  P.push(R(56, 1622, 968, 116, 18, C.card));
  P.push(T(92, 1668, 'NEWS SENTIMENT', { size: 22, w: 500, fill: C.muted, ls: 1.4 }));
  P.push(T(92, 1710, 'Bullish · 118 articles', { size: 30, w: 700, fill: C.up }));
  const bw = 300, bx = 690;
  P.push(R(bx, 1660, bw, 16, 8, '#242B36'));
  P.push(R(bx, 1660, Math.round(bw * 0.68), 16, 8, C.up));
  P.push(T(bx + bw, 1712, '68% positive', { size: 24, w: 500, fill: C.muted, anchor: 'end' }));

  /* tab bar */
  P.push(R(0, 1762, W, 158, 0, '#0D1117'));
  P.push(`<line x1="0" y1="1762" x2="${W}" y2="1762" stroke="${C.line}" stroke-width="2"/>`);
  ['Analyse', 'Watchlist', 'Mentor', 'You'].forEach((label, i) => {
    const cx = 135 + i * 270, on = i === 0;
    P.push(R(cx - 22, 1802, 44, 44, 12, on ? C.accent : '#39424F'));
    P.push(T(cx, 1884, label, { size: 25, w: on ? 700 : 400, fill: on ? C.text : '#5A6472', anchor: 'middle' }));
  });
  P.push(R(390, 1898, 300, 8, 4, '#39424F'));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${P.join('')}</svg>`;
}

export function renderScreen(outFile) {
  const r = new Resvg(screenSvg(), {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false, defaultFontFamily: 'Archivo', fontFiles: fontFiles(ROOT) },
  });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, r.render().asPng());
  return outFile;
}

if (process.argv[1] && process.argv[1].endsWith('app-screen.mjs')) {
  console.log(renderScreen(path.join(ROOT, 'output/tradelens/app-analysis.png')));
}
