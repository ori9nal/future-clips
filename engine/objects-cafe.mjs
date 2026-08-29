// Specialty-coffee objects.
//
// A second niche, drawn deliberately unlike the fitness set: warm paper stock,
// printed packaging, ceramic and brass rather than charts and screens. The point
// of a second object family is to prove the engine is not one look — if both
// campaigns come out sharing a palette and a vocabulary, the templates are doing
// too much and the elements too little.
//
// Packaging and vessels are drawable for the same reason app UI is: they are
// flat, typographic and geometric. A portrait is not, which is why there are no
// people in here.
import { Resvg } from '@resvg/resvg-js';

const png = (svg, width) =>
  Buffer.from(new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
    font: { loadSystemFonts: true },
  }).render().asPng());

const S = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const F = 'Archivo, Helvetica, Arial, sans-serif';
const SERIF = 'Playfair Display, Georgia, serif';

export const CAFE = {
  kraft: '#C89B6A', kraftDeep: '#A87A48', cream: '#F4EEE2', ink: '#1C1712',
  sub: '#6E6255', rust: '#B4432A', olive: '#5A6B3C', brass: '#C9A227',
  ceramic: '#EDE7DA', ceramicShade: '#D8CFBE', crema: '#B07A46', brew: '#3B2318',
};

/** A retail coffee bag with a printed label — the hero product object. */
export function coffeeBag({
  origin = 'ETHIOPIA', name = 'Guji', notes = 'PEACH · JASMINE · HONEY',
  roast = 'FILTER', body = CAFE.kraft, label = CAFE.cream, accent = CAFE.rust,
} = {}) {
  const W = 380, H = 520;
  return [S(W, H, `
    <path d="M56,84 L324,84 L336,500 L44,500 Z" fill="${body}"/>
    <path d="M56,84 L324,84 L330,300 L50,300 Z" fill="#fff" opacity="0.07"/>
    <path d="M56,84 L190,64 L324,84 L190,104 Z" fill="${CAFE.kraftDeep}"/>
    <rect x="150" y="52" width="80" height="20" rx="6" fill="${CAFE.kraftDeep}"/>
    <rect x="86" y="150" width="208" height="272" rx="10" fill="${label}"/>
    <text x="190" y="196" text-anchor="middle" font-family="${F}" font-size="19"
          font-weight="800" letter-spacing="4" fill="${accent}">${origin}</text>
    <line x1="118" y1="212" x2="262" y2="212" stroke="${CAFE.sub}" stroke-width="2" opacity="0.4"/>
    <text x="190" y="286" text-anchor="middle" font-family="${SERIF}" font-size="62"
          font-style="italic" fill="${CAFE.ink}">${name}</text>
    <text x="190" y="330" text-anchor="middle" font-family="${F}" font-size="13"
          font-weight="700" letter-spacing="2" fill="${CAFE.sub}">${notes}</text>
    <rect x="140" y="356" width="100" height="30" rx="15" fill="${accent}"/>
    <text x="190" y="377" text-anchor="middle" font-family="${F}" font-size="14"
          font-weight="800" letter-spacing="2" fill="${label}">${roast}</text>
    <text x="190" y="408" text-anchor="middle" font-family="${F}" font-size="12"
          font-weight="600" letter-spacing="1" fill="${CAFE.sub}">250g · WHOLE BEAN</text>`), 380];
}

/** V60-style pour-over cone on a carafe. */
export function pourOver({ cone = CAFE.ceramic, brew = CAFE.brew } = {}) {
  const W = 400, H = 440;
  return [S(W, H, `
    <path d="M96,300 L304,300 L246,412 L154,412 Z" fill="${cone}" opacity="0.55"/>
    <path d="M96,300 L304,300 L246,412 L154,412 Z" fill="none" stroke="${CAFE.ceramicShade}" stroke-width="4"/>
    <path d="M110,352 L290,352 L246,412 L154,412 Z" fill="${brew}" opacity="0.75"/>
    <path d="M74,96 L326,96 L268,296 L132,296 Z" fill="${cone}"/>
    <path d="M74,96 L326,96 L316,130 L84,130 Z" fill="${CAFE.ceramicShade}"/>
    <path d="M132,296 L268,296 L262,312 L138,312 Z" fill="${CAFE.ceramicShade}"/>
    <path d="M96,130 L304,130 L252,286 L148,286 Z" fill="${CAFE.crema}" opacity="0.42"/>
    <path d="M326,150 q44,26 6,74" stroke="${cone}" stroke-width="16" fill="none" stroke-linecap="round"/>
    <circle cx="200" cy="72" r="6" fill="${brew}" opacity="0.5"/>
    <circle cx="200" cy="44" r="5" fill="${brew}" opacity="0.32"/>`), 400];
}

/** Cup and saucer, seen slightly above. */
export function cup({ ceramic = CAFE.ceramic, crema = CAFE.crema } = {}) {
  const W = 420, H = 300;
  return [S(W, H, `
    <ellipse cx="210" cy="248" rx="180" ry="40" fill="${CAFE.ceramicShade}"/>
    <ellipse cx="210" cy="240" rx="180" ry="40" fill="${ceramic}"/>
    <path d="M330,150 q56,6 46,50 q-10,42 -58,36" stroke="${ceramic}" stroke-width="20" fill="none" stroke-linecap="round"/>
    <path d="M90,110 h240 l-22,118 q-6,26 -34,26 h-128 q-28,0 -34,-26 Z" fill="${ceramic}"/>
    <ellipse cx="210" cy="110" rx="120" ry="32" fill="${CAFE.ceramicShade}"/>
    <ellipse cx="210" cy="110" rx="108" ry="27" fill="${crema}"/>
    <ellipse cx="196" cy="106" rx="46" ry="13" fill="#fff" opacity="0.24"/>`), 420];
}

/** Scattered beans — texture, used small. */
export function beans({ color = '#4A2E1C', n = 11 } = {}) {
  const W = 420, H = 300;
  const rnd = (i, s) => ((Math.sin(i * 12.9898 + s) * 43758.5453) % 1 + 1) % 1;
  let body = '';
  for (let i = 0; i < n; i++) {
    const x = 40 + rnd(i, 1) * (W - 80);
    const y = 40 + rnd(i, 2) * (H - 80);
    const r = 22 + rnd(i, 3) * 12;
    const a = rnd(i, 4) * 180;
    body += `<g transform="translate(${x.toFixed(0)},${y.toFixed(0)}) rotate(${a.toFixed(0)})">
      <ellipse rx="${r.toFixed(1)}" ry="${(r * 0.68).toFixed(1)}" fill="${color}"/>
      <path d="M${-r * 0.8},0 q${r * 0.8},${-r * 0.34} ${r * 1.6},0 q${-r * 0.8},${r * 0.34} ${-r * 1.6},0"
        fill="#2A1A10" opacity="0.75"/></g>`;
  }
  return [S(W, H, body), 420];
}

/** Brew scale mid-pour — the "specialty" signal, with real numbers. */
export function brewScale({ grams = '18.0', seconds = '0:32', accent = CAFE.rust } = {}) {
  const W = 420, H = 260;
  return [S(W, H, `
    <rect x="30" y="70" width="360" height="150" rx="26" fill="#26221D"/>
    <rect x="30" y="70" width="360" height="150" rx="26" fill="none" stroke="#3A342C" stroke-width="4"/>
    <rect x="58" y="98" width="304" height="80" rx="14" fill="#0E0C0A"/>
    <text x="86" y="156" font-family="${F}" font-size="52" font-weight="800" fill="${CAFE.cream}">${grams}</text>
    <text x="212" y="156" font-family="${F}" font-size="24" font-weight="700" fill="${CAFE.sub}">g</text>
    <text x="336" y="156" text-anchor="end" font-family="${F}" font-size="34" font-weight="700" fill="${accent}">${seconds}</text>
    <circle cx="80" cy="200" r="6" fill="${accent}"/>
    <rect x="150" y="42" width="120" height="30" rx="10" fill="#3A342C"/>`), 420];
}

/** Hand grinder. */
export function grinder({ body = '#2E2A24', brass = CAFE.brass } = {}) {
  const W = 300, H = 460;
  return [S(W, H, `
    <rect x="132" y="18" width="36" height="16" rx="8" fill="${brass}"/>
    <path d="M150,26 q84,0 84,44" stroke="${brass}" stroke-width="13" fill="none" stroke-linecap="round"/>
    <circle cx="234" cy="76" r="15" fill="${brass}"/>
    <rect x="112" y="66" width="76" height="26" rx="9" fill="${brass}"/>
    <path d="M92,92 h116 l14,168 h-144 Z" fill="${body}"/>
    <rect x="78" y="256" width="144" height="176" rx="22" fill="#D8D2C6" opacity="0.35"/>
    <rect x="78" y="256" width="144" height="176" rx="22" fill="none" stroke="${body}" stroke-width="6"/>
    <path d="M92,344 h116 v70 q0,18 -20,18 h-76 q-20,0 -20,-18 Z" fill="#4A2E1C" opacity="0.8"/>
    <rect x="94" y="246" width="112" height="18" rx="8" fill="${brass}"/>`), 300];
}

export const CAFE_OBJECTS = {
  'coffee-bag': coffeeBag,
  'pour-over': pourOver,
  'cup': cup,
  'beans': beans,
  'brew-scale': brewScale,
  'grinder': grinder,
};

export const isCafeObject = (id) => Object.hasOwn(CAFE_OBJECTS, id);

export function renderCafeObject(id, opts = {}) {
  const gen = CAFE_OBJECTS[id];
  if (!gen) throw new Error(`unknown cafe object "${id}"`);
  const [svg, width] = gen(opts);
  return png(svg, Math.round((opts.width ?? width) * (opts.scale ?? 1)));
}
