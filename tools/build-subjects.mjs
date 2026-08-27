// The DRIFT signature subject library.
//
// Figures are one parametric silhouette system: named joints -> Catmull-Rom
// spline -> round-capped tapered strokes. Every pose is drawn by the same code
// with the same radius vocabulary, so style consistency across a whole set is
// structural rather than hoped-for (this is the F3 POSTER-CHARACTER requirement).
// A silhouette also has no face and no shading, so there is nothing to render
// badly, and it survives the 200px thumbnail test a detailed figure would fail.
//
// Data objects (score dial, hypnogram, moon, bed) are pure geometry.
// Output: transparent PNGs under assets/inhouse-only/subjects/.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const OUT = 'assets/inhouse-only/subjects';
fs.mkdirSync(OUT, { recursive: true });

const INK = '#101418';
const ACC = '#FFB020';

// Shared radius vocabulary — the thing that makes every pose the same character.
const R = {
  head: 44, neck: 17,
  chest: 52, waist: 40, hip: 48,
  upperArm: 18, elbow: 15, hand: 14,
  thigh: 29, knee: 23, ankle: 15, foot: 17,
};

// --------------------------------------------------------------- limb painting
function crEval(pts, t) {
  const n = pts.length - 1;
  const seg = Math.min(n - 1, Math.floor(t * n));
  const lt = t * n - seg;
  const p0 = pts[Math.max(0, seg - 1)], p1 = pts[seg], p2 = pts[seg + 1], p3 = pts[Math.min(n, seg + 2)];
  const t2 = lt * lt, t3 = t2 * lt;
  const f = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * lt + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}
function radiusAt(radii, t) {
  const n = radii.length - 1;
  const seg = Math.min(n - 1, Math.floor(t * n));
  const lt = t * n - seg;
  return radii[seg] + (radii[seg + 1] - radii[seg]) * lt;
}
/** Tapered limb as overlapping round-capped strokes — unions into a smooth solid. */
function limb(pts, radii, steps = 30) {
  if (!pts || pts.length < 2) return '';
  let out = '';
  for (let i = 0; i < steps; i++) {
    const a = crEval(pts, i / steps), b = crEval(pts, (i + 1) / steps);
    const w = 2 * radiusAt(radii, (i + 0.5) / steps);
    out += `<path d="M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)}" stroke-width="${w.toFixed(1)}" stroke-linecap="round"/>`;
  }
  return out;
}

// --------------------------------------------------------------- poses
// Canonical space 600 x 900. `near` limbs paint in the figure colour, `far`
// limbs in a lifted tone so the pose reads in three dimensions at thumbnail size.
const POSES = {
  // sitting on the edge of a bed, head bowed — the 3am wake-up
  'sit-edge': {
    head: { x: 316, y: 256, tilt: 8 },
    near: [
      [[{ x: 292, y: 566 }, { x: 288, y: 470 }, { x: 298, y: 376 }, { x: 306, y: 312 }], [R.hip, R.waist, R.chest, R.chest - 8]], // torso
      [[{ x: 300, y: 566 }, { x: 366, y: 574 }, { x: 412, y: 566 }], [R.thigh, R.thigh - 3, R.knee]],                              // thigh
      [[{ x: 412, y: 566 }, { x: 418, y: 700 }, { x: 414, y: 826 }], [R.knee, R.ankle + 4, R.ankle]],                              // shin
      [[{ x: 414, y: 832 }, { x: 456, y: 846 }], [R.foot, R.foot - 4]],                                                            // foot
      [[{ x: 308, y: 322 }, { x: 356, y: 424 }, { x: 384, y: 520 }], [R.upperArm, R.elbow, R.hand]],                               // arm
    ],
    far: [
      [[{ x: 288, y: 322 }, { x: 248, y: 424 }, { x: 232, y: 520 }], [R.upperArm, R.elbow, R.hand]],
      [[{ x: 288, y: 560 }, { x: 348, y: 566 }, { x: 388, y: 560 }], [R.thigh - 2, R.thigh - 5, R.knee - 2]],
      [[{ x: 388, y: 560 }, { x: 390, y: 696 }, { x: 384, y: 824 }], [R.knee - 2, R.ankle + 2, R.ankle - 1]],
      [[{ x: 384, y: 830 }, { x: 424, y: 844 }], [R.foot - 2, R.foot - 6]],
    ],
    floor: { cx: 350, cy: 852, rx: 138 },
  },

  // curled on one side — rest
  'curl-side': {
    head: { x: 186, y: 500, tilt: 0 },
    near: [
      [[{ x: 244, y: 520 }, { x: 340, y: 536 }, { x: 434, y: 574 }], [R.chest - 6, R.waist + 6, R.hip]],
      [[{ x: 434, y: 578 }, { x: 400, y: 668 }, { x: 314, y: 690 }], [R.thigh + 2, R.knee + 4, R.knee]],
      [[{ x: 314, y: 690 }, { x: 244, y: 686 }, { x: 196, y: 716 }], [R.knee, R.ankle + 4, R.foot]],
      [[{ x: 288, y: 534 }, { x: 254, y: 610 }, { x: 296, y: 664 }], [R.upperArm, R.elbow, R.hand]],
    ],
    far: [
      [[{ x: 428, y: 566 }, { x: 396, y: 646 }, { x: 322, y: 664 }], [R.thigh - 2, R.knee + 1, R.knee - 3]],
      [[{ x: 322, y: 664 }, { x: 258, y: 660 }, { x: 216, y: 686 }], [R.knee - 3, R.ankle + 1, R.foot - 4]],
    ],
    floor: { cx: 316, cy: 730, rx: 178 },
  },

  // standing, shoulders forward, head down — under-slept
  'stand-slump': {
    head: { x: 322, y: 158, tilt: 20 },
    near: [
      [[{ x: 300, y: 460 }, { x: 294, y: 356 }, { x: 304, y: 262 }, { x: 314, y: 214 }], [R.hip, R.waist, R.chest, R.chest - 10]],
      [[{ x: 312, y: 464 }, { x: 322, y: 630 }, { x: 318, y: 802 }], [R.thigh, R.knee, R.ankle]],
      [[{ x: 318, y: 806 }, { x: 356, y: 822 }], [R.foot, R.foot - 5]],
      [[{ x: 314, y: 220 }, { x: 336, y: 348 }, { x: 330, y: 468 }], [R.upperArm, R.elbow, R.hand]],
    ],
    far: [
      [[{ x: 298, y: 220 }, { x: 268, y: 348 }, { x: 268, y: 466 }], [R.upperArm, R.elbow, R.hand]],
      [[{ x: 288, y: 462 }, { x: 274, y: 628 }, { x: 274, y: 798 }], [R.thigh - 2, R.knee - 2, R.ankle - 1]],
      [[{ x: 274, y: 802 }, { x: 236, y: 818 }], [R.foot - 2, R.foot - 7]],
    ],
    floor: { cx: 296, cy: 828, rx: 108 },
  },

  // cross-legged with a phone — the scroll that wrecks the score
  'sit-phone': {
    head: { x: 296, y: 272, tilt: 6 },
    near: [
      [[{ x: 296, y: 556 }, { x: 292, y: 452 }, { x: 296, y: 360 }, { x: 300, y: 324 }], [R.hip, R.waist, R.chest, R.chest - 10]],
      [[{ x: 236, y: 606 }, { x: 306, y: 634 }, { x: 396, y: 604 }], [R.thigh - 2, R.knee + 4, R.knee]],
      [[{ x: 396, y: 604 }, { x: 306, y: 664 }, { x: 214, y: 640 }], [R.knee, R.ankle + 6, R.foot]],
      [[{ x: 306, y: 336 }, { x: 350, y: 428 }, { x: 332, y: 492 }], [R.upperArm, R.elbow, R.hand]],
    ],
    far: [
      [[{ x: 286, y: 336 }, { x: 246, y: 430 }, { x: 272, y: 494 }], [R.upperArm, R.elbow, R.hand]],
    ],
    accent: 'M296,456 l50,-25 a12,12 0 0 1 16,5 l28,57 a12,12 0 0 1 -5,16 l-50,25 a12,12 0 0 1 -16,-5 l-28,-57 a12,12 0 0 1 5,-16 Z',
    glow: { x: 342, y: 486, r: 148 },
    floor: { cx: 302, cy: 668, rx: 132 },
  },

  // head on a pillow — the quiet closer subject
  'head-rest': {
    head: { x: 330, y: 468, tilt: -6, r: 62 },
    pillow: 'M108,596 q-18,-110 106,-132 q132,-24 258,4 q116,26 100,128 q-10,46 -116,48 l-236,2 q-102,-4 -112,-50 Z',
    near: [
      [[{ x: 326, y: 528 }, { x: 288, y: 574 }, { x: 244, y: 600 }], [R.neck + 22, R.chest - 6, R.chest]],
    ],
    far: [],
    floor: null,
  },
};

// --------------------------------------------------------------- data objects
function scoreDial(score) {
  const cx = 300, cy = 300, r = 214, sw = 40;
  const frac = score / 100, a0 = -Math.PI / 2, a1 = a0 + frac * Math.PI * 2;
  const p = (a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${INK}" stroke-opacity="0.15" stroke-width="${sw}"/>
    <path d="M${p(a0)} A${r},${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${p(a1)}" fill="none" stroke="${ACC}" stroke-width="${sw}" stroke-linecap="round"/>
  </svg>`;
}

function hypnogram() {
  const W = 900, H = 420, pad = 22;
  const stages = [0, 1, 2, 3, 2, 3, 1, 2, 3, 2, 1, 2, 0, 1, 2, 1];
  const bw = (W - pad * 2) / stages.length;
  const y = (s) => pad + (s * (H - pad * 2)) / 3;
  let d = '';
  stages.forEach((s, i) => {
    const x0 = pad + i * bw;
    d += (i === 0 ? `M${x0},${y(s)}` : ` L${x0},${y(s)}`) + ` L${x0 + bw},${y(s)}`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${[0, 1, 2, 3].map((s) => `<line x1="${pad}" y1="${y(s)}" x2="${W - pad}" y2="${y(s)}" stroke="${INK}" stroke-opacity="0.13" stroke-width="3"/>`).join('')}
    <path d="${d}" fill="none" stroke="${ACC}" stroke-width="13" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

const moonMark = () => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <path d="M420,86 a230,230 0 1 0 96,330 a196,196 0 1 1 -96,-330 Z" fill="${INK}"/></svg>`;

/** An empty bed, side elevation — the "you weren't in it" subject. */
const bedMark = () => `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
  <g fill="${INK}">
    <path d="M96,300 q-14,-92 96,-104 q214,-22 430,2 q104,12 96,102 l-8,44 -606,2 Z" opacity="0.28"/>
    <path d="M120,320 h660 a22,22 0 0 1 22,22 v26 a22,22 0 0 1 -22,22 h-660 a22,22 0 0 1 -22,-22 v-26 a22,22 0 0 1 22,-22 Z"/>
    <rect x="112" y="390" width="26" height="94" rx="12"/><rect x="762" y="390" width="26" height="94" rx="12"/>
    <path d="M150,296 q-8,-58 62,-66 q66,-8 120,2 q66,10 58,64 z" opacity="0.55"/>
  </g></svg>`;

// --------------------------------------------------------------- assembly
function lift(hex, t) {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  const m = (v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0');
  return `#${m(r)}${m(g)}${m(b)}`;
}

function figureSvg(name, opts = {}) {
  const P = POSES[name];
  const fill = opts.fill || INK;
  const accent = opts.accent || ACC;
  const far = opts.farFill || lift(fill, 0.34);
  const hr = P.head.r || R.head;
  const paint = (segs) => (segs || []).map(([pts, radii]) => limb(pts, radii)).join('');

  const shadow = P.floor
    ? `<ellipse cx="${P.floor.cx}" cy="${P.floor.cy}" rx="${P.floor.rx}" ry="16" fill="${fill}" opacity="0.13"/>` : '';
  const glow = P.glow
    ? `<defs><radialGradient id="glow"><stop offset="0" stop-color="${accent}" stop-opacity="0.45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>
       <circle cx="${P.glow.x}" cy="${P.glow.y}" r="${P.glow.r}" fill="url(#glow)"/>` : '';
  // head as a slightly ovoid mass, rotated by the pose tilt — reads as a bowed head
  const head = `<g transform="translate(${P.head.x},${P.head.y}) rotate(${P.head.tilt || 0})">
      <ellipse cx="0" cy="0" rx="${hr}" ry="${(hr * 1.1).toFixed(1)}"/>
      <path d="M${-hr * 0.96},${-hr * 0.12} a${hr * 0.98},${hr * 1.08} 0 0 1 ${hr * 1.94},0 a${hr},${hr * 0.62} 0 0 0 ${-hr * 1.94},0 Z"/>
    </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
    ${shadow}${glow}
    ${P.pillow ? `<path d="${P.pillow}" fill="${far}"/>` : ''}
    <g stroke="${far}" fill="none">${paint(P.far)}</g>
    <g stroke="${fill}" fill="none">${paint(P.near)}</g>
    <g fill="${fill}">${head}</g>
    ${P.accent ? `<path d="${P.accent}" fill="${accent}"/>` : ''}
  </svg>`;
}

const png = (svg, width) =>
  Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'rgba(0,0,0,0)' }).render().asPng());

const manifest = [];
for (const name of Object.keys(POSES)) {
  fs.writeFileSync(path.join(OUT, `${name}.png`), png(figureSvg(name), 1200));
  manifest.push({ id: name, kind: 'figure', file: `${name}.png` });
}
// Data objects (dial, hypnogram, moon, bed, ...) are NOT emitted here any more.
// They carry the accent colour, so they are generated at render time from the
// live palette in engine/subjects.mjs. See GAUNTLET.md round 1, fix 1.
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`${manifest.length} subjects -> ${OUT}`);
console.log(manifest.map((m) => m.id).join(', '));
