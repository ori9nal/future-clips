// App-screenshot objects.
//
// Real clipping campaigns require the app itself inside the carousel — a Whop
// or a fintech brief will say "the product must appear on at least two slides".
// Stock cannot supply that and a generic phone mockup does not satisfy it: the
// screen has to show THIS app, with THIS campaign's numbers.
//
// So the screen is drawn. App UI is flat, gridded and typographic, which is
// exactly what vector drawing is good at — unlike a shoe, where drawing loses
// to photography. The numbers are parameters, so the screenshot can state
// whatever the slide's copy is claiming.
import { Resvg } from '@resvg/resvg-js';

const png = (svg, width) =>
  Buffer.from(new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: 'rgba(0,0,0,0)',
    font: { loadSystemFonts: true },
  }).render().asPng());

const F = 'Archivo, Helvetica, Arial, sans-serif';

/** Phone chrome: body, notch, screen clip. Content is drawn into the clip. */
function phone(W, H, screen, { body = '#0B0D10', bezel = 14, radius = 58 } = {}) {
  const sx = bezel, sy = bezel, sw = W - bezel * 2, sh = H - bezel * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <clipPath id="scr"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${radius - 8}"/></clipPath>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#3A3F47"/><stop offset="0.5" stop-color="#15181D"/>
        <stop offset="1" stop-color="#3A3F47"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${H}" rx="${radius}" fill="url(#edge)"/>
    <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="${radius - 4}" fill="${body}"/>
    <g clip-path="url(#scr)">${screen(sx, sy, sw, sh)}</g>
    <rect x="${W / 2 - 62}" y="${sy + 10}" width="124" height="32" rx="16" fill="#000"/>
  </svg>`;
}

const statusBar = (x, y, w, fg = '#fff') => `
  <text x="${x + 30}" y="${y + 62}" font-family="${F}" font-size="24" font-weight="700" fill="${fg}">9:41</text>
  <g fill="${fg}">
    <rect x="${x + w - 108}" y="${y + 44}" width="5"  height="14" rx="2"/>
    <rect x="${x + w - 99}"  y="${y + 39}" width="5"  height="19" rx="2"/>
    <rect x="${x + w - 90}"  y="${y + 34}" width="5"  height="24" rx="2"/>
    <rect x="${x + w - 70}"  y="${y + 38}" width="34" height="20" rx="6" opacity="0.35"/>
    <rect x="${x + w - 68}"  y="${y + 40}" width="24" height="16" rx="4"/>
  </g>`;

/**
 * The money screen: balance, delta pill, sparkline, transactions, tab bar.
 * Every string is a parameter so the screenshot can say what the slide claims.
 */
export function appBalance({
  brand = 'LEDGERLY', balance = '$4,820.16', delta = '+$284 this month',
  accent = '#3DDC84', bg = '#0E1116', card = '#171B21',
  rows = [
    ['Payout · Whop', 'Today', '+$1,240.00', true],
    ['Rent', 'Yesterday', '−$1,450.00', false],
    ['Groceries', 'Mon', '−$86.20', false],
    ['Payout · Vyro', 'Sun', '+$318.40', true],
  ],
  spark = [30, 42, 36, 58, 50, 74, 68, 92],
} = {}) {
  const W = 520, H = 1060;
  const screen = (x, y, w, h) => {
    const sx0 = x + 30, sw = w - 60;
    const sy0 = y + 470, sh = 120;
    const max = Math.max(...spark), min = Math.min(...spark);
    const px = (i) => sx0 + (i * sw) / (spark.length - 1);
    const py = (v) => sy0 + sh * (1 - (v - min) / Math.max(1, max - min));
    const line = spark.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
    const area = `${line} L${px(spark.length - 1).toFixed(1)},${sy0 + sh} L${sx0},${sy0 + sh} Z`;

    const rowSvg = rows.map((r, i) => {
      const ry = y + 660 + i * 92;
      const [name, when, amt, pos] = r;
      return `
        <rect x="${x + 24}" y="${ry}" width="${w - 48}" height="80" rx="20" fill="${card}"/>
        <circle cx="${x + 66}" cy="${ry + 40}" r="22" fill="${pos ? accent : '#2A2F37'}" opacity="${pos ? 0.22 : 1}"/>
        <text x="${x + 66}" y="${ry + 48}" text-anchor="middle" font-family="${F}" font-size="20"
              font-weight="800" fill="${pos ? accent : '#8A929C'}">${pos ? '↓' : '↑'}</text>
        <text x="${x + 100}" y="${ry + 36}" font-family="${F}" font-size="22" font-weight="700" fill="#EDEFF2">${name}</text>
        <text x="${x + 100}" y="${ry + 62}" font-family="${F}" font-size="18" font-weight="500" fill="#7B838D">${when}</text>
        <text x="${x + w - 44}" y="${ry + 48}" text-anchor="end" font-family="${F}" font-size="22"
              font-weight="800" fill="${pos ? accent : '#D7DBE0'}">${amt}</text>`;
    }).join('');

    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>
      ${statusBar(x, y, w)}
      <text x="${x + 30}" y="${y + 140}" font-family="${F}" font-size="22" font-weight="800"
            letter-spacing="3" fill="${accent}">${brand}</text>
      <circle cx="${x + w - 52}" cy="${y + 128}" r="22" fill="${card}"/>
      <text x="${x + 30}" y="${y + 216}" font-family="${F}" font-size="24" font-weight="600" fill="#7B838D">Total balance</text>
      <text x="${x + 30}" y="${y + 296}" font-family="${F}" font-size="64" font-weight="800" fill="#fff">${balance}</text>
      <rect x="${x + 30}" y="${y + 330}" width="${Math.max(190, delta.length * 13)}" height="44" rx="22" fill="${accent}" opacity="0.16"/>
      <text x="${x + 52}" y="${y + 360}" font-family="${F}" font-size="21" font-weight="700" fill="${accent}">${delta}</text>
      <path d="${area}" fill="${accent}" opacity="0.14"/>
      <path d="${line}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${px(spark.length - 1).toFixed(1)}" cy="${py(spark[spark.length - 1]).toFixed(1)}" r="9" fill="${accent}"/>
      <text x="${x + 30}" y="${y + 640}" font-family="${F}" font-size="24" font-weight="700" fill="#EDEFF2">Recent</text>
      ${rowSvg}
      <rect x="${x}" y="${y + h - 108}" width="${w}" height="108" fill="#0A0C0F"/>
      ${[0, 1, 2, 3].map((i) => {
        const cx = x + w * (0.16 + i * 0.226);
        const on = i === 0;
        return `<rect x="${cx - 17}" y="${y + h - 74}" width="34" height="26" rx="8"
                  fill="${on ? accent : '#39404A'}"/>
                <circle cx="${cx}" cy="${y + h - 34}" r="3.5" fill="${on ? accent : '#2A3038'}"/>`;
      }).join('')}`;
  };
  return [phone(W, H, screen), W];
}

/** A payout / streak screen — the "proof" shot a campaign brief usually wants. */
export function appPayout({
  brand = 'LEDGERLY', headline = '$1,240.00', sub = 'Paid out in 2 days',
  accent = '#3DDC84', bg = '#0E1116', card = '#171B21',
  weeks = [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
} = {}) {
  const W = 520, H = 1060;
  const screen = (x, y, w, h) => `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg}"/>
    ${statusBar(x, y, w)}
    <text x="${x + 30}" y="${y + 140}" font-family="${F}" font-size="22" font-weight="800"
          letter-spacing="3" fill="${accent}">${brand}</text>
    <circle cx="${x + w / 2}" cy="${y + 320}" r="104" fill="${accent}" opacity="0.14"/>
    <circle cx="${x + w / 2}" cy="${y + 320}" r="104" fill="none" stroke="${accent}" stroke-width="10"
            stroke-linecap="round" stroke-dasharray="520 654" transform="rotate(-90 ${x + w / 2} ${y + 320})"/>
    <text x="${x + w / 2}" y="${y + 312}" text-anchor="middle" font-family="${F}" font-size="46"
          font-weight="800" fill="#fff">80%</text>
    <text x="${x + w / 2}" y="${y + 346}" text-anchor="middle" font-family="${F}" font-size="19"
          font-weight="600" fill="#7B838D">of goal</text>
    <text x="${x + w / 2}" y="${y + 470}" text-anchor="middle" font-family="${F}" font-size="58"
          font-weight="800" fill="#fff">${headline}</text>
    <text x="${x + w / 2}" y="${y + 512}" text-anchor="middle" font-family="${F}" font-size="22"
          font-weight="600" fill="${accent}">${sub}</text>
    <rect x="${x + 24}" y="${y + 560}" width="${w - 48}" height="210" rx="24" fill="${card}"/>
    <text x="${x + 48}" y="${y + 606}" font-family="${F}" font-size="21" font-weight="700" fill="#EDEFF2">Posting streak</text>
    ${weeks.map((on, i) => {
      const cols = 7, cw = 44, gap = 10;
      const cx = x + 48 + (i % cols) * (cw + gap);
      const cy = y + 626 + Math.floor(i / cols) * (cw + gap);
      return `<rect x="${cx}" y="${cy}" width="${cw}" height="${cw}" rx="12"
        fill="${on ? accent : '#242A32'}" opacity="${on ? (0.5 + 0.5 * ((i % 3) / 2)).toFixed(2) : 1}"/>`;
    }).join('')}
    <rect x="${x + 24}" y="${y + 812}" width="${w - 48}" height="76" rx="38" fill="${accent}"/>
    <text x="${x + w / 2}" y="${y + 860}" text-anchor="middle" font-family="${F}" font-size="26"
          font-weight="800" fill="#06210F">Withdraw</text>
    <rect x="${x}" y="${y + h - 108}" width="${w}" height="108" fill="#0A0C0F"/>`;
  return [phone(W, H, screen), W];
}

export const UI_OBJECTS = { 'app-balance': appBalance, 'app-payout': appPayout };
export const isUiObject = (id) => Object.hasOwn(UI_OBJECTS, id);

export function renderUiObject(id, opts = {}) {
  const gen = UI_OBJECTS[id];
  if (!gen) throw new Error(`unknown ui object "${id}"`);
  const [svg, width] = gen(opts);
  return png(svg, Math.round((opts.width ?? width) * (opts.scale ?? 1)));
}
