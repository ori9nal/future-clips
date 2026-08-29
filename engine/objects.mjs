// The OBJECT library: drawn, not photographed.
//
// The research finding (RESEARCH.md §4) is that top-performing carousels are
// labelled object constellations, and that a large share of those objects are
// not photographs at all — they are DATA GRAPHICS. papanca's 45.6K cover carries
// an orange line chart labelled "58 mi", a heart-rate bar chart labelled
// 1:10 -> 9:27, and a watch face reading 147BPM. Those are the most valuable
// objects on the slide and every one of them is vector.
//
// So they are drawn here. That answers the imagery problem without stock
// photography, without a generation key, and at zero marginal cost — and it is
// the one class of object where drawing beats photographing, because a chart
// can say the exact number the copy needs.
//
// Colour is deliberate and NOT rationed to one accent: the reference frame
// carries magenta, cobalt, gold, green and orange at once (RESEARCH.md §4a).
import { Resvg } from '@resvg/resvg-js';

const png = (svg, width) =>
  Buffer.from(new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
    font: { loadSystemFonts: true },
  }).render().asPng());

const S = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// A shared, deliberately un-brand palette. These objects are meant to read as
// real-world things, so they keep their own colours rather than the campaign's.
export const OBJ = {
  ink: '#111111',
  sub: '#6B6B6B',
  line: '#D8D8D8',
  orange: '#F4642A',
  orangeSoft: '#FBD9CB',
  blue: '#2F6BFF',
  cobalt: '#1B3FCC',
  magenta: '#E6197F',
  green: '#22C55E',
  gold: '#D9A441',
  goldDeep: '#A97C25',
  steel: '#8A9199',
  dark: '#1A1D22',
};

/* ─────────────────────────── data graphics ─────────────────────────── */

/** Area + line chart with a called-out end value. The "58 mi" object. */
export function lineChart({ label = '58 mi', points = [58, 44, 62, 40, 70, 54, 88], color = OBJ.orange } = {}) {
  const W = 620, H = 340, pad = 26, top = 54;
  const max = Math.max(...points), min = Math.min(...points);
  const span = Math.max(1, max - min);
  const x = (i) => pad + (i * (W - pad * 2)) / (points.length - 1);
  const y = (v) => top + (H - top - pad) * (1 - (v - min) / span);
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  const lx = x(points.length - 1), ly = y(points[points.length - 1]);
  return [S(W, H, `
    <path d="${area}" fill="${color}" opacity="0.20"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="7"
          stroke-linecap="round" stroke-linejoin="round"/>
    ${points.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="7" fill="#fff" stroke="${color}" stroke-width="5"/>`).join('')}
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="11" fill="${color}"/>
    <text x="${(lx - 8).toFixed(1)}" y="${(ly - 24).toFixed(1)}" text-anchor="end"
          font-family="Archivo, Helvetica, Arial, sans-serif" font-size="42" font-weight="700"
          fill="${OBJ.ink}">${label}</text>`), 620];
}

/** Heart-rate zone bars with start/end time stamps. */
export function zoneBars({ from = '1:10', to = '9:27', bars = null, a = OBJ.blue, b = OBJ.magenta } = {}) {
  const W = 640, H = 330, base = H - 62, pad = 24;
  const vals = bars || [0.30, 0.52, 0.22, 0.44, 0.86, 0.35, 0.70, 0.95, 0.40, 0.62, 0.28, 0.80, 0.36, 0.55];
  const bw = (W - pad * 2) / vals.length;
  const body = vals.map((v, i) => {
    const h = Math.max(10, v * (base - 40));
    const col = v > 0.68 ? b : a;
    return `<rect x="${(pad + i * bw + 3).toFixed(1)}" y="${(base - h).toFixed(1)}"
      width="${(bw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${col}"/>`;
  }).join('');
  return [S(W, H, `
    ${body}
    <line x1="${pad}" y1="${base + 8}" x2="${W - pad}" y2="${base + 8}" stroke="${OBJ.line}" stroke-width="3"/>
    <circle cx="${pad + 6}" cy="${base + 8}" r="9" fill="${a}"/>
    <circle cx="${W - pad - 6}" cy="${base + 8}" r="9" fill="#fff" stroke="${b}" stroke-width="5"/>
    <text x="${pad}" y="${base + 48}" font-family="Archivo, Helvetica, Arial, sans-serif"
          font-size="26" font-weight="600" fill="${OBJ.sub}">${from}</text>
    <text x="${W - pad}" y="${base + 48}" text-anchor="end" font-family="Archivo, Helvetica, Arial, sans-serif"
          font-size="26" font-weight="600" fill="${OBJ.sub}">${to}</text>`), 640];
}

/** A sport-watch face mid-activity. Real numbers, because they carry the claim. */
export function watchFace({ time = '31:47.01', bpm = '147', split = '23:53', avg = '137' } = {}) {
  const W = 380, H = 460, r = 62;
  return [S(W, H, `
    <rect x="34" y="10" width="312" height="70" rx="24" fill="${OBJ.steel}" opacity="0.55"/>
    <rect x="34" y="380" width="312" height="70" rx="24" fill="${OBJ.steel}" opacity="0.55"/>
    <rect x="18" y="46" width="344" height="368" rx="${r}" fill="${OBJ.dark}"/>
    <rect x="30" y="58" width="320" height="344" rx="${r - 10}" fill="#000"/>
    <text x="190" y="140" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
          font-size="27" font-weight="700" fill="${OBJ.green}">${time}</text>
    <line x1="58" y1="168" x2="322" y2="168" stroke="#2A2E35" stroke-width="3"/>
    <text x="190" y="238" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
          font-size="62" font-weight="700" fill="#fff">${bpm}</text>
    <text x="190" y="272" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
          font-size="22" font-weight="600" fill="${OBJ.sub}">BPM</text>
    <line x1="58" y1="300" x2="322" y2="300" stroke="#2A2E35" stroke-width="3"/>
    <text x="76" y="348" font-family="Archivo, Helvetica, Arial, sans-serif" font-size="27"
          font-weight="700" fill="#fff">${split}</text>
    <text x="304" y="348" text-anchor="end" font-family="Archivo, Helvetica, Arial, sans-serif"
          font-size="27" font-weight="700" fill="${OBJ.magenta}">${avg}</text>`), 380];
}

/** Closed activity rings. */
export function rings({ pcts = [0.92, 0.68, 0.45] } = {}) {
  const W = 420, C = 210, cols = [OBJ.magenta, OBJ.green, OBJ.blue];
  const arc = (rad, pct, col) => {
    const a0 = -Math.PI / 2, a1 = a0 + pct * Math.PI * 2;
    const p = (a) => `${(C + rad * Math.cos(a)).toFixed(1)},${(C + rad * Math.sin(a)).toFixed(1)}`;
    return `<circle cx="${C}" cy="${C}" r="${rad}" fill="none" stroke="${col}" stroke-opacity="0.18" stroke-width="30"/>
      <path d="M${p(a0)} A${rad},${rad} 0 ${pct > 0.5 ? 1 : 0} 1 ${p(a1)}" fill="none"
        stroke="${col}" stroke-width="30" stroke-linecap="round"/>`;
  };
  return [S(W, W, pcts.map((p, i) => arc(178 - i * 42, p, cols[i])).join('')), 420];
}

/** A big stat, the way the reference sets a magenta 2X. */
export function statBig({ value = '2X', color = OBJ.magenta } = {}) {
  const W = 420, H = 260;
  return [S(W, H, `<text x="${W / 2}" y="${H - 46}" text-anchor="middle"
    font-family="Archivo, Helvetica, Arial, sans-serif" font-size="210" font-weight="800"
    letter-spacing="-8" fill="${color}">${value}</text>`), 420];
}

/** A consistency grid — weeks of training, some filled. */
export function weekGrid({ weeks = 8, filled = null, color = OBJ.green } = {}) {
  const cols = 7, cell = 40, gap = 9, pad = 12;
  const W = pad * 2 + cols * cell + (cols - 1) * gap;
  const H = pad * 2 + weeks * cell + (weeks - 1) * gap;
  const on = filled || Array.from({ length: weeks * cols }, (_, i) => (i * 7 + 3) % 11 > 3);
  let body = '';
  for (let r = 0; r < weeks; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      body += `<rect x="${pad + c * (cell + gap)}" y="${pad + r * (cell + gap)}"
        width="${cell}" height="${cell}" rx="9"
        fill="${on[i] ? color : '#EDEDED'}" opacity="${on[i] ? (0.45 + 0.55 * ((i % 3) / 2)).toFixed(2) : 1}"/>`;
    }
  }
  return [S(W, H, body), W];
}

/* ───────────────────────────── objects ─────────────────────────────── */

/** Race medal on a striped ribbon. */
export function medal({ ribbonA = OBJ.cobalt, ribbonB = '#E8E8E8', disc = OBJ.gold } = {}) {
  const W = 300, H = 430;
  return [S(W, H, `
    <path d="M96,10 L150,196 L96,196 Z" fill="${ribbonA}"/>
    <path d="M204,10 L150,196 L204,196 Z" fill="${ribbonB}"/>
    <path d="M126,10 L150,120 L174,10 Z" fill="${ribbonA}" opacity="0.65"/>
    <circle cx="150" cy="300" r="118" fill="${disc}"/>
    <circle cx="150" cy="300" r="118" fill="none" stroke="${OBJ.goldDeep}" stroke-width="9"/>
    <circle cx="150" cy="300" r="88" fill="none" stroke="${OBJ.goldDeep}" stroke-width="5" opacity="0.7"/>
    <circle cx="150" cy="300" r="62" fill="${OBJ.goldDeep}" opacity="0.22"/>
    <text x="150" y="316" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
          font-size="46" font-weight="800" fill="#6B4E12">42.2</text>`), 300];
}

/** Analogue stopwatch. */
export function stopwatch({ face = '#F6F3EC', rim = OBJ.gold } = {}) {
  const W = 320, H = 380, cx = 160, cy = 226, r = 128;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(a) * (r - 20), y1 = cy + Math.sin(a) * (r - 20);
    const x2 = cx + Math.cos(a) * (r - 8), y2 = cy + Math.sin(a) * (r - 8);
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
      stroke="${OBJ.ink}" stroke-width="5" stroke-linecap="round"/>`;
  }).join('');
  return [S(W, H, `
    <rect x="136" y="18" width="48" height="42" rx="12" fill="${rim}"/>
    <rect x="146" y="4" width="28" height="24" rx="9" fill="${OBJ.goldDeep}"/>
    <circle cx="${cx}" cy="${cy}" r="${r + 14}" fill="${rim}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${face}"/>
    ${ticks}
    <line x1="${cx}" y1="${cy}" x2="${cx + 4}" y2="${cy - 92}" stroke="${OBJ.ink}" stroke-width="7" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${cx + 62}" y2="${cy + 34}" stroke="${OBJ.orange}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="11" fill="${OBJ.ink}"/>`), 320];
}

/** Weight plate, face on with a rim. One plate reads; three overlapping discs
 *  read as a Venn diagram, which is what the first two attempts produced. */
export function plates({ color = OBJ.cobalt, kg = '20' } = {}) {
  const W = 340, H = 340, c = 170;
  return [S(W, H, `
    <circle cx="${c}" cy="${c}" r="158" fill="${color}"/>
    <circle cx="${c}" cy="${c}" r="158" fill="none" stroke="#0A1F6B" stroke-width="10" opacity="0.5"/>
    <circle cx="${c}" cy="${c}" r="118" fill="none" stroke="#fff" stroke-width="4" opacity="0.28"/>
    <circle cx="${c}" cy="${c}" r="46" fill="#F2F4F8"/>
    <circle cx="${c}" cy="${c}" r="46" fill="none" stroke="#0A1F6B" stroke-width="7" opacity="0.35"/>
    <text x="${c}" y="${c - 74}" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
      font-size="46" font-weight="800" fill="#fff">${kg}</text>
    <text x="${c}" y="${c + 108}" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
      font-size="26" font-weight="700" fill="#fff" opacity="0.85">KG</text>`), 340];
}

/** Dumbbell, side on. */
export function dumbbell({ color = OBJ.dark } = {}) {
  const W = 520, H = 220, cy = 110;
  return [S(W, H, `
    <rect x="150" y="${cy - 16}" width="220" height="32" rx="16" fill="${OBJ.steel}"/>
    <rect x="118" y="${cy - 64}" width="46" height="128" rx="18" fill="${color}"/>
    <rect x="62" y="${cy - 84}" width="52" height="168" rx="22" fill="${color}"/>
    <rect x="356" y="${cy - 64}" width="46" height="128" rx="18" fill="${color}"/>
    <rect x="406" y="${cy - 84}" width="52" height="168" rx="22" fill="${color}"/>`), 520];
}

/** Insulated bottle. */
export function bottle({ body = OBJ.orange, cap = OBJ.ink } = {}) {
  const W = 220, H = 480;
  return [S(W, H, `
    <rect x="74" y="8" width="72" height="54" rx="16" fill="${cap}"/>
    <rect x="46" y="54" width="128" height="404" rx="46" fill="${body}"/>
    <rect x="64" y="92" width="30" height="330" rx="15" fill="#fff" opacity="0.22"/>
    <rect x="46" y="250" width="128" height="70" fill="#fff" opacity="0.9"/>
    <text x="110" y="298" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
      font-size="30" font-weight="800" fill="${body}">1L</text>`), 220];
}

/** Supplement tub. */
export function tub({ body = '#F2F2F2', lid = OBJ.green, label = 'CREATINE' } = {}) {
  const W = 320, H = 380;
  return [S(W, H, `
    <rect x="52" y="30" width="216" height="58" rx="18" fill="${lid}"/>
    <rect x="42" y="80" width="236" height="272" rx="26" fill="${body}"/>
    <rect x="42" y="150" width="236" height="112" fill="${lid}" opacity="0.16"/>
    <text x="160" y="216" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
      font-size="34" font-weight="800" fill="${OBJ.ink}" letter-spacing="1">${label}</text>
    <text x="160" y="252" text-anchor="middle" font-family="Archivo, Helvetica, Arial, sans-serif"
      font-size="20" font-weight="600" fill="${OBJ.sub}">MICRONIZED · 500G</text>`), 320];
}

/** Running shoe, side profile. Redrawn: the first path had no heel and no
 *  toe-spring, so it read as a wedge rather than a shoe. */
export function shoe({ body = OBJ.ink, sole = OBJ.orange, swoosh = '#FFFFFF' } = {}) {
  const W = 540, H = 280;
  return [S(W, H, `
    <path d="M56,206 C46,182 58,158 86,150 C120,140 146,136 172,124
             C206,108 232,86 268,74 C312,60 356,64 392,84
             C424,102 448,128 470,150 C486,166 490,182 486,198 Z" fill="${body}"/>
    <path d="M300,72 C338,60 378,66 410,88 C398,74 376,60 348,56 C330,54 314,60 300,72 Z"
          fill="#fff" opacity="0.18"/>
    <path d="M50,204 L490,196 C496,222 480,238 456,238 L86,238 C62,238 44,224 50,204 Z" fill="${sole}"/>
    <path d="M50,204 L490,196 L490,206 L50,214 Z" fill="#fff" opacity="0.35"/>
    <path d="M196,152 C244,150 292,138 336,116 C300,150 250,168 202,172 Z"
          fill="${swoosh}" opacity="0.92"/>
    <path d="M240,102 C266,112 292,120 320,124" stroke="#fff" stroke-width="7"
          fill="none" stroke-linecap="round" opacity="0.55"/>
    <ellipse cx="120" cy="186" rx="40" ry="18" fill="#fff" opacity="0.12"/>`), 540];
}

export const OBJECTS = {
  'chart-line': lineChart,
  'chart-zones': zoneBars,
  'watch': watchFace,
  'rings': rings,
  'stat': statBig,
  'grid-weeks': weekGrid,
  'medal': medal,
  'stopwatch': stopwatch,
  'plates': plates,
  'dumbbell': dumbbell,
  'bottle': bottle,
  'tub': tub,
  'shoe': shoe,
};

export const isObject = (id) => Object.hasOwn(OBJECTS, id);

/** @returns {Buffer} transparent PNG of one object, in its own colours. */
export function renderObject(id, opts = {}) {
  const gen = OBJECTS[id];
  if (!gen) throw new Error(`unknown object "${id}" (have: ${Object.keys(OBJECTS).join(', ')})`);
  const [svg, width] = gen(opts);
  return png(svg, Math.round((opts.width ?? width) * (opts.scale ?? 1)));
}
