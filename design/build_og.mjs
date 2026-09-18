// The link-preview image for the site: future-clips-site/og.png (1200x630).
//
//   node design/build_og.mjs
//
// Drawn from the same three-card mark and the same faces as the homepage
// (design/site.html: Archivo for the headline and wordmark, Manrope for the
// body and the small caps), rendered with resvg from the tracked fonts, so
// the file is reproducible and never hand-edited. Upload it to bucket `site`
// under a new name (og-vN.png) and bump deploy/site/build.js.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const FONTS = path.join(ROOT, 'assets/fonts');
const files = ['ArchivoExpanded-ExtraBold.ttf', 'Archivo-Bold.ttf', 'Manrope-Medium.ttf', 'Manrope-ExtraBold.ttf'].map((f) => path.join(FONTS, f));
// the family names as the font files declare them, so resvg finds them
const fam = (f) => {
  const b = fs.readFileSync(f);
  const o = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  // opentype.js 2.x nests the name table per platform; 1.x did not
  const n = o.names.windows ?? o.names.macintosh ?? o.names;
  return n.preferredFamily?.en ?? n.fontFamily?.en ?? o.names.fontFamily?.en;
};
const [HEAD, WORD, BODY, SMALL] = files.map(fam);

const W = 1200, H = 630;
const ink = '#0E0E10', body = '#57554F', muted = '#9B9890', lime = '#D8FF47';
const MARK = `<rect x="0" y="21" width="55" height="39" rx="7" fill="#D9D7D1"/><rect x="14" y="12" width="55" height="39" rx="7" fill="#8E8D89"/><rect x="31" y="2" width="55" height="39" rx="7" fill="${ink}"/>`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFC"/><stop offset="1" stop-color="#F1F4DE"/></linearGradient>
  <radialGradient id="r" cx="0.93" cy="0.08" r="0.62"><stop offset="0" stop-color="${lime}" stop-opacity="0.34"/><stop offset="1" stop-color="${lime}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<rect width="${W}" height="${H}" fill="url(#r)"/>
<g transform="translate(80,86) scale(0.86)">${MARK}</g>
<text x="176" y="106" font-family="${esc(SMALL)}" font-weight="800" font-size="13" letter-spacing="4.4" fill="${muted}">THE</text>
<text x="176" y="142" font-family="${esc(WORD)}" font-weight="700" font-size="36" letter-spacing="-1.15" fill="${ink}">futureclips</text>
<text x="80" y="302" font-family="${esc(HEAD)}" font-weight="800" font-size="94" letter-spacing="-3.5" fill="${ink}">Viral carousels</text>
<text x="80" y="398" font-family="${esc(HEAD)}" font-weight="800" font-size="94" letter-spacing="-3.5" fill="${ink}">in two minutes.</text>
<text x="80" y="470" font-family="${esc(BODY)}" font-weight="500" font-size="30" fill="${body}">One idea in, a post-ready carousel out. No visible watermark.</text>
<rect x="80" y="518" width="236" height="56" rx="28" fill="${ink}"/>
<text x="198" y="554" text-anchor="middle" font-family="${esc(WORD)}" font-weight="700" font-size="24" fill="${lime}">Get started</text>
</svg>`;

const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: false, fontFiles: files, defaultFontFamily: WORD } }).render().asPng();
const out = path.join(ROOT, 'future-clips-site/og.png');
fs.writeFileSync(out, png);
console.log(`${path.relative(ROOT, out)}  ${(png.length / 1024).toFixed(0)} KB  faces: ${HEAD} / ${WORD} / ${BODY} / ${SMALL}`);
