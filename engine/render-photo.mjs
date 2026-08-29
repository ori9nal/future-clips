// PATTERN A — full-bleed cinematic photograph with type set over it.
//
// TARGETS.md found this is the most common high performer across every niche,
// and STACK.md's biggest reliability point is that it needs NO MATTING: the
// photograph is used whole. Every visible defect so far — halos, dark fringes,
// blown mattes, subjects floating in white — came from cutouts. This path has
// none.
//
// The type is composited by the engine, not baked by the image model, so the
// fit contract, safe areas, spellcheck and campaign rules all still hold.
import fs from 'node:fs';
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import path from 'node:path';
import { resolveFace } from './fonts.mjs';
import { fitText } from './fit-text.mjs';

const FONT_DIR = 'assets/fonts';
const ttf = (f) => path.join(FONT_DIR, `${f.id}.ttf`);
const FAMILY = { display: 'Archivo Black', serif: 'Playfair Display', mono: 'JetBrains Mono' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Legibility is not optional and cannot be left to luck: a bright frame kills
 * white type. A scrim is applied behind the headline band, its strength derived
 * from the plate's OWN luminance in that band rather than fixed.
 */
async function scrimFor(plate, canvas, band) {
  const { data, info } = await sharp(plate)
    .extract({ left: 0, top: Math.round(band.y), width: canvas.w, height: Math.round(band.h) })
    .resize(64, null, { fit: 'inside' })
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < info.width * info.height; i++) sum += data[i];
  const mean = sum / (info.width * info.height);
  // bright plate -> heavier scrim. 0.18 floor keeps the grade consistent across a set.
  return Math.min(0.72, Math.max(0.18, (mean - 60) / 190 * 0.62 + 0.18));
}

/**
 * @param {object} o
 * @param {{w,h}} o.canvas
 * @param {string} o.plate      background image path
 * @param {string} o.headline
 * @param {string} [o.accentWord] one word lifted into the accent colour
 * @param {string} [o.kicker]   small line above the headline
 * @param {string} [o.handle]
 * @param {object} o.palette    { ink, paper, accent }
 */
export async function renderPhotoSlide({
  canvas, plate, headline, accentWord, kicker, handle, palette,
  size = [64, 132], align = 'left', valign = 'bottom', index = null, showArrow = true, out,
}) {
  const M = Math.round(canvas.w * 0.075);
  const boxW = canvas.w - M * 2;

  const face = resolveFace('display-block', 900, 'normal');
  const monoFace = resolveFace('mono', 500, 'normal');

  const fit = fitText(face, headline, { w: boxW, h: Math.round(canvas.h * 0.42) }, {
    min: size[0], max: size[1], lineHeight: 0.98, tracking: -0.022, maxLines: 4,
  });
  if (!fit) throw new Error(`headline will not fit: "${headline}"`);

  const lineH = fit.size * 0.98;
  const blockH = fit.lines.length * lineH;
  const kickerH = kicker ? 46 : 0;
  const top = valign === 'bottom'
    ? canvas.h - Math.round(canvas.h * 0.14) - blockH
    : Math.round(canvas.h * 0.16) + kickerH;

  const band = { y: Math.max(0, top - kickerH - 40), h: Math.min(canvas.h - Math.max(0, top - kickerH - 40), blockH + kickerH + 110) };

  // 1. plate, cover-cropped
  let img = sharp(plate).resize(canvas.w, canvas.h, { fit: 'cover', position: 'attention' });
  const plateBuf = await img.jpeg({ quality: 92 }).toBuffer();

  // 2. gradient scrim behind the type band
  const strength = await scrimFor(plateBuf, canvas, band);
  const gy0 = Math.max(0, band.y - 120) / canvas.h;
  const scrim = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.w}" height="${canvas.h}">
      <defs><linearGradient id="s" x1="0" y1="${valign === 'bottom' ? 0 : 1}" x2="0" y2="${valign === 'bottom' ? 1 : 0}">
        <stop offset="${gy0.toFixed(3)}" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="${strength.toFixed(3)}"/>
      </linearGradient></defs>
      <rect width="${canvas.w}" height="${canvas.h}" fill="url(#s)"/>
    </svg>`);

  // 3. type. The accent word is matched case-insensitively and only the FIRST
  //    occurrence is lifted, so a common word does not colour the whole line.
  const x = align === 'center' ? canvas.w / 2 : M;
  const anchor = align === 'center' ? 'middle' : 'start';
  let accentDone = false;
  const lines = fit.lines.map((ln, i) => {
    const y = top + i * lineH + fit.size * 0.80;
    if (accentWord && !accentDone) {
      const re = new RegExp(`\\b(${accentWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'i');
      if (re.test(ln)) {
        accentDone = true;
        const [before, word, after] = ln.split(re);
        return `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${anchor}"
          font-family="${FAMILY.display}" font-size="${fit.size}" font-weight="400"
          letter-spacing="${(-0.022 * fit.size).toFixed(2)}" fill="${palette.paper}"
          >${esc(before)}<tspan fill="${palette.accent}">${esc(word)}</tspan>${esc(after)}</text>`;
      }
    }
    return `<text x="${x}" y="${y.toFixed(1)}" text-anchor="${anchor}"
      font-family="${FAMILY.display}" font-size="${fit.size}" font-weight="400"
      letter-spacing="${(-0.022 * fit.size).toFixed(2)}" fill="${palette.paper}">${esc(ln)}</text>`;
  }).join('');

  const kickerSvg = kicker
    ? `<text x="${x}" y="${(top - 26).toFixed(1)}" text-anchor="${anchor}"
        font-family="${FAMILY.mono}" font-size="24" font-weight="500" letter-spacing="4"
        fill="${palette.accent}">${esc(String(kicker).toUpperCase())}</text>` : '';

  const foot = canvas.h - Math.round(canvas.h * 0.045);
  const handleSvg = handle
    ? `<text x="${M}" y="${foot}" font-family="${FAMILY.mono}" font-size="23" font-weight="500"
        fill="${palette.paper}" opacity="0.82">${esc(handle)}</text>` : '';
  const arrowSvg = showArrow
    ? `<text x="${canvas.w - M}" y="${foot + 4}" text-anchor="end" font-family="${FAMILY.display}"
        font-size="40" font-weight="400" fill="${palette.accent}">→</text>` : '';
  const indexSvg = index
    ? `<text x="${canvas.w - M}" y="${Math.round(canvas.h * 0.075)}" text-anchor="end"
        font-family="${FAMILY.mono}" font-size="22" font-weight="500" letter-spacing="2"
        fill="${palette.paper}" opacity="0.7">${esc(index)}</text>` : '';

  const typeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.w}" height="${canvas.h}">
    ${kickerSvg}${lines}${handleSvg}${arrowSvg}${indexSvg}</svg>`;

  const typePng = Buffer.from(new Resvg(typeSvg, {
    background: 'rgba(0,0,0,0)', fitTo: { mode: 'width', value: canvas.w },
    font: { fontFiles: [ttf(face), ttf(monoFace)], loadSystemFonts: false },
  }).render().asPng());

  const buf = await sharp(plateBuf)
    .composite([{ input: scrim }, { input: typePng }])
    .jpeg({ quality: 92 }).toBuffer();

  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, buf); }
  return { buf, size: fit.size, lines: fit.lines.length, scrim: +strength.toFixed(3) };
}
