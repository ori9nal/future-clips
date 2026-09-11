// Procedural subjects — generated at render time from the LIVE palette.
//
// Round 1 shipped amber dials on blue carousels because the data objects were
// PNGs with the accent baked in. Anything carrying colour has to be generated,
// not stored. Figures stay as PNGs because they are always graded to a flat
// silhouette or duotone, so they cannot leak a hue.
import { Resvg } from '@resvg/resvg-js';
import { resolveColor, withAlpha } from './palette.mjs';

const R = (svg, width) =>
  Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' }).render().asPng());

/** A sleep-score ring. `score` sets the filled arc. */
function dial(p, { score = 62, track = 'ink', width = 1000 } = {}) {
  const cx = 300, cy = 300, r = 214, sw = 40;
  const frac = Math.max(0.02, Math.min(0.99, score / 100));
  const a0 = -Math.PI / 2, a1 = a0 + frac * Math.PI * 2;
  const pt = (a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${resolveColor(track, p)}" stroke-opacity="0.16" stroke-width="${sw}"/>
    <path d="M${pt(a0)} A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${pt(a1)}" fill="none"
      stroke="${p.accent}" stroke-width="${sw}" stroke-linecap="round"/>
  </svg>`, width];
}

/** A hypnogram: four sleep-stage bands, one stepped trace. */
function hypnogram(p, { track = 'ink', width = 1400, seedStages } = {}) {
  const W = 900, H = 420, pad = 22;
  const stages = seedStages || [0, 1, 2, 3, 2, 3, 1, 2, 3, 2, 1, 2, 0, 1, 2, 1];
  const bw = (W - pad * 2) / stages.length;
  const y = (s) => pad + (s * (H - pad * 2)) / 3;
  let d = '';
  stages.forEach((s, i) => {
    const x0 = pad + i * bw;
    d += (i === 0 ? `M${x0},${y(s)}` : ` L${x0},${y(s)}`) + ` L${x0 + bw},${y(s)}`;
  });
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${[0, 1, 2, 3].map((s) => `<line x1="${pad}" y1="${y(s)}" x2="${W - pad}" y2="${y(s)}" stroke="${resolveColor(track, p)}" stroke-opacity="0.14" stroke-width="3"/>`).join('')}
    <path d="${d}" fill="none" stroke="${p.accent}" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`, width];
}

/** Crescent. Neutral by design — it reads on every plate. */
function moon(p, { fill = 'ink', width = 900 } = {}) {
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <path d="M420,86 a230,230 0 1 0 96,330 a196,196 0 1 1 -96,-330 Z" fill="${resolveColor(fill, p)}"/></svg>`, width];
}

/** An empty bed, side elevation — "you weren't in it". */
function bed(p, { fill = 'ink', width = 1300 } = {}) {
  const c = resolveColor(fill, p);
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
    <g fill="${c}">
      <path d="M96,300 q-14,-92 96,-104 q214,-22 430,2 q104,12 96,102 l-8,44 -606,2 Z" opacity="0.26"/>
      <path d="M120,320 h660 a22,22 0 0 1 22,22 v26 a22,22 0 0 1 -22,22 h-660 a22,22 0 0 1 -22,-22 v-26 a22,22 0 0 1 22,-22 Z"/>
      <rect x="112" y="390" width="26" height="94" rx="12"/><rect x="762" y="390" width="26" height="94" rx="12"/>
      <path d="M150,296 q-8,-58 62,-66 q66,-8 120,2 q66,10 58,64 z" opacity="0.5"/>
    </g></svg>`, width];
}

/** A stacked bar of the night's stages — the "where the points went" object. */
function stageBar(p, { fill = 'ink', width = 1300, mix = [0.14, 0.52, 0.2, 0.14] } = {}) {
  const W = 900, H = 210, r = 26;
  const c = resolveColor(fill, p);
  let x = 0;
  const segs = mix.map((m, i) => {
    const w = m * W, seg = `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(2, w - 8).toFixed(1)}" height="${H}" rx="${r}"
      fill="${i === 1 ? p.accent : c}" opacity="${i === 1 ? 1 : [0.18, 1, 0.34, 0.22][i]}"/>`;
    x += w;
    return seg;
  }).join('');
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${segs}</svg>`, width];
}

/** Concentric arcs — a clock face abstracted to three rings. */
function rings(p, { fill = 'ink', width = 1000 } = {}) {
  const c = resolveColor(fill, p);
  const arc = (r, a0, a1, col, sw) => {
    const pt = (a) => `${(300 + r * Math.cos(a)).toFixed(2)},${(300 + r * Math.sin(a)).toFixed(2)}`;
    return `<path d="M${pt(a0)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${pt(a1)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/>`;
  };
  const T = Math.PI * 2;
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    ${arc(232, -Math.PI / 2, -Math.PI / 2 + T * 0.72, p.accent, 26)}
    ${arc(180, -Math.PI / 2 + 0.4, -Math.PI / 2 + 0.4 + T * 0.45, withAlpha(c, 0.28), 26)}
    ${arc(128, -Math.PI / 2 - 0.9, -Math.PI / 2 - 0.9 + T * 0.3, withAlpha(c, 0.5), 26)}
  </svg>`, width];
}

export const PROCEDURAL = {
  'dial-62': (p) => dial(p, { score: 62 }),
  'dial-91': (p) => dial(p, { score: 91 }),
  'dial-38': (p) => dial(p, { score: 38 }),
  hypnogram: (p) => hypnogram(p),
  // a visibly *flat* night — three shallow steps, no deep block. Round 2 shipped a
  // variant that was near-identical to the main hypnogram, so two interiors in the
  // same set read as a duplicate.
  'hypnogram-flat': (p) => hypnogram(p, { seedStages: [0, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0] }),
  moon: (p) => moon(p),
  'moon-light': (p) => moon(p, { fill: 'ink-soft' }),
  bed: (p) => bed(p),
  'stage-bar': (p) => stageBar(p),
  rings: (p) => rings(p),
};

/** Silhouette class, used to keep consecutive interiors visually distinct. */
export const SHAPE_CLASS = {
  'dial-62': 'ring', 'dial-91': 'ring', 'dial-38': 'ring', rings: 'ring',
  hypnogram: 'trace', 'hypnogram-flat': 'trace',
  moon: 'mass', 'moon-light': 'mass', bed: 'mass',
  'stage-bar': 'bar',
};
export const shapeClassOf = (id) => SHAPE_CLASS[id] || id;

export const isProcedural = (id) => Object.hasOwn(PROCEDURAL, id);

/** @returns {Buffer} transparent PNG rendered in the carousel's own palette */
export function renderProcedural(id, palette) {
  const gen = PROCEDURAL[id];
  if (!gen) throw new Error(`unknown procedural subject "${id}"`);
  const [svg, width] = gen(palette);
  return R(svg, width);
}
