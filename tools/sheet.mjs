// Contact sheet builder: one carousel -> one grid image, plus a 200px-wide
// thumbnail strip for the scroll-size hierarchy test.
import sharp from 'sharp'; import fs from 'node:fs'; import path from 'node:path';

export async function contactSheet(files, out, { cell = 300, cols = 4, gap = 10, bg = '#B9B9B9' } = {}) {
  const rows = Math.ceil(files.length / cols);
  const cw = cell, chh = Math.round(cell * 4 / 3);
  const W = cols * cw + (cols + 1) * gap, H = rows * chh + (rows + 1) * gap;
  const comps = [];
  for (let i = 0; i < files.length; i++) {
    const buf = await sharp(files[i]).resize(cw, chh, { fit: 'contain' }).png().toBuffer();
    comps.push({ input: buf, left: gap + (i % cols) * (cw + gap), top: gap + Math.floor(i / cols) * (chh + gap) });
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(comps).png().toFile(out);
  return out;
}

/** Every slide at 200px wide, in a row — the thumbnail legibility test. */
export async function thumbStrip(files, out, { w = 200, gap = 8, bg = '#B9B9B9' } = {}) {
  const h = Math.round(w * 4 / 3);
  const comps = [];
  for (let i = 0; i < files.length; i++) {
    const buf = await sharp(files[i]).resize(w, h, { fit: 'contain' }).png().toBuffer();
    comps.push({ input: buf, left: gap + i * (w + gap), top: gap });
  }
  const W = gap + files.length * (w + gap), H = h + gap * 2;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp({ create: { width: W, height: H, channels: 3, background: bg } }).composite(comps).png().toFile(out);
  return out;
}
