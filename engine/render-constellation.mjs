// Render one constellation slide: objects + their labels + a centred title.
//
// Deliberately its own path rather than a template role, because the geometry is
// solved rather than declared — you cannot write fixed boxes for seven scattered
// objects and still have them not collide across seeds.
import sharp from 'sharp';
import { Resvg } from '@resvg/resvg-js';
import { renderObject } from './objects.mjs';
import { solveConstellation, sizeOf } from './constellation.mjs';
import path from 'node:path';
import { resolveFace } from './fonts.mjs';

const FONT_DIR = 'assets/fonts';
const ttf = (f) => path.join(FONT_DIR, `${f.id}.ttf`);
// resvg matches <text> by the family name inside the file, not by our role id.
const FAMILY = { 'display-editorial': 'Playfair Display', body: 'Archivo', mono: 'JetBrains Mono' };
import { fitText } from './fit-text.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {object} o
 * @param {{w,h}} o.canvas
 * @param {string} o.title       centred display line
 * @param {string} [o.handle]
 * @param {Array<{id,label,opts}>} o.objects
 * @param {object} o.palette
 * @param {number} o.seed
 */
export async function renderConstellation({
  canvas, title, handle, objects, palette, seed = 1,
  titleSize = [58, 104], ground = '#FFFFFF', margin = 42,
}) {
  // 1. Reserve the centre for the title, then fit the title INTO that reserve.
  // 50% wide, not 62%: at 62% the keep-out left only ~19% of the frame either
  // side of the title — too narrow for any object — so every slide had a dead
  // horizontal band across its middle and all the mass at top and bottom.
  const boxW = Math.round(canvas.w * 0.50);
  const boxH = Math.round(canvas.h * 0.22);
  const centre = {
    x: Math.round((canvas.w - boxW) / 2),
    y: Math.round(canvas.h * 0.38),
    w: boxW, h: boxH,
  };

  const face = resolveFace('display-editorial', 400, 'normal');
  const fit = fitText(face, title, { w: centre.w, h: centre.h }, {
    min: titleSize[0], max: titleSize[1], lineHeight: 1.02, tracking: -0.015, maxLines: 3,
  });
  if (!fit) throw new Error(`constellation title will not fit: "${title}"`);

  // 2. Solve object placement around that reserve. Labels are measured FIRST so
  //    the solver reserves the width the caption will really occupy.
  const labelFace = resolveFace('body', 700, 'normal');
  const LABEL_SIZE = 26;
  const measure = (str) => {
    let u = 0;
    for (const ch of String(str)) u += labelFace.ot.charToGlyph(ch).advanceWidth || labelFace.upm * 0.5;
    return (u / labelFace.upm) * LABEL_SIZE;
  };
  const rowsFor = (label) => {
    const words = String(label).split(/\s+/);
    const mid = words.length > 2 ? Math.ceil(words.length / 2) : words.length;
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')].filter(Boolean);
  };

  const items = objects.map((o) => ({
    id: o.id, label: o.label, ...sizeOf(o.id),
    labelW: o.label ? Math.max(...rowsFor(o.label).map(measure)) + 12 : 0,
  }));
  const { placed, dropped } = solveConstellation({ canvas, items, centre, seed, margin });

  // 3. Composite: ground, then every object, then one type layer over the lot.
  const layers = [];
  for (const p of placed) {
    const spec = objects[p.i];
    const buf = renderObject(p.id, { ...(spec.opts || {}), width: p.rect.w });
    const resized = await sharp(buf)
      .resize(p.rect.w, p.rect.h, { fit: 'inside' })
      .png().toBuffer();
    const m = await sharp(resized).metadata();
    layers.push({
      input: resized,
      left: p.rect.x + Math.round((p.rect.w - m.width) / 2),
      top: p.rect.y + Math.round((p.rect.h - m.height) / 2),
    });
  }

  // 4. Type: object labels (small bold sans) + the centred display title.
  const lines = fit.lines
    .map((ln, i) => {
      const y = centre.y + fit.size * 0.82 + i * fit.size * 1.02;
      return `<text x="${canvas.w / 2}" y="${y.toFixed(1)}" text-anchor="middle"
        font-family="${FAMILY['display-editorial']}" font-size="${fit.size}" font-weight="400"
        letter-spacing="${(-0.015 * fit.size).toFixed(2)}" fill="${palette.ink}">${esc(ln)}</text>`;
    })
    .join('');

  const labels = placed
    .filter((p) => p.label && p.labelRect)
    .map((p) => {
      const cx = p.labelRect.x + p.labelRect.w / 2;
      const y = p.labelRect.y + 26;
      return rowsFor(p.label)
        .map((row, i) => `<text x="${cx.toFixed(1)}" y="${(y + i * 30).toFixed(1)}" text-anchor="middle"
          font-family="${FAMILY.body}" font-size="${LABEL_SIZE}" font-weight="700"
          fill="${palette.ink}">${esc(row)}</text>`)
        .join('');
    })
    .join('');

  const handleSvg = handle
    ? `<text x="${canvas.w / 2}" y="${(centre.y + fit.size * 0.82 + fit.lines.length * fit.size * 1.02 + 34).toFixed(1)}"
        text-anchor="middle" font-family="${FAMILY.body}" font-size="24" font-weight="400"
        fill="${palette.ink}" opacity="0.62">${esc(handle)}</text>`
    : '';

  const typeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.w}" height="${canvas.h}">
    ${labels}${lines}${handleSvg}</svg>`;

  const typePng = Buffer.from(
    new Resvg(typeSvg, {
      background: 'rgba(0,0,0,0)',
      fitTo: { mode: 'width', value: canvas.w },
      font: { fontFiles: [ttf(face), ttf(labelFace)], loadSystemFonts: false },
    }).render().asPng(),
  );
  layers.push({ input: typePng, left: 0, top: 0 });

  const out = await sharp({
    create: { width: canvas.w, height: canvas.h, channels: 4, background: ground },
  }).composite(layers).png({ compressionLevel: 9 }).toBuffer();

  return { buf: out, placed, dropped, titleSize: fit.size, centre };
}
