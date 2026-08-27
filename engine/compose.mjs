// Layers 1 and 2 (BACKGROUND, SUBJECT) plus the final composite, all via sharp.
// Backgrounds are authored as SVG and rasterised by libvips so flat fills,
// gradients, glows and grid textures all travel the same code path.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { hexToRgb, resolveColor, withAlpha, shade } from './palette.mjs';

const INHOUSE = 'assets/inhouse-only';

/**
 * Assets under assets/inhouse-only/ are for this capability test only. Real
 * campaigns need licensed or client-supplied artwork, so the boundary is a
 * throw in the engine rather than a note in a README.
 */
export function assertAssetAllowed(file) {
  const rel = path.relative(process.cwd(), path.resolve(file)).replace(/\\/g, '/');
  if (rel.startsWith(INHOUSE) && String(process.env.PRODUCTION).toLowerCase() === 'true') {
    throw new Error(
      `PRODUCTION=true forbids in-house test asset "${rel}". ` +
      `Supply a licensed or client-provided asset outside ${INHOUSE}/.`
    );
  }
  return file;
}

// ------------------------------------------------------------------ background
function backgroundSvg(spec, ctx) {
  const { w, h } = ctx.canvas;
  const c = (t) => resolveColor(t, ctx);
  const defs = [];
  let fill;

  if (spec.type === 'flat') {
    fill = c(spec.fill);
  } else if (spec.type === 'gradient') {
    const stops = spec.stops.map((s) => `<stop offset="${s.at}" stop-color="${c(s.color)}"/>`).join('');
    const a = spec.angle ?? 180; // 180 = top -> bottom
    const rad = (a * Math.PI) / 180;
    const x2 = (0.5 + Math.sin(rad) / 2).toFixed(4), y2 = (0.5 - Math.cos(rad) / 2).toFixed(4);
    const x1 = (0.5 - Math.sin(rad) / 2).toFixed(4), y1 = (0.5 + Math.cos(rad) / 2).toFixed(4);
    defs.push(`<linearGradient id="bg" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`);
    fill = 'url(#bg)';
  } else if (spec.type === 'glow') {
    const stops = spec.stops.map((s) => `<stop offset="${s.at}" stop-color="${c(s.color)}"/>`).join('');
    defs.push(
      `<radialGradient id="bg" cx="${spec.cx ?? 0.5}" cy="${spec.cy ?? 0.5}" r="${spec.r ?? 0.85}">${stops}</radialGradient>`
    );
    fill = 'url(#bg)';
  } else {
    fill = c('paper');
  }

  const overlays = [];
  // faint ruled grid — the @financialhotgirl plate treatment
  if (spec.grid) {
    const step = spec.grid.step ?? 90;
    defs.push(
      `<pattern id="grid" width="${step}" height="${step}" patternUnits="userSpaceOnUse">` +
      `<path d="M${step},0 L0,0 0,${step}" fill="none" stroke="${c(spec.grid.color ?? 'ink')}" stroke-opacity="${spec.grid.opacity ?? 0.07}" stroke-width="${spec.grid.weight ?? 1.5}"/></pattern>`
    );
    overlays.push(`<rect width="${w}" height="${h}" fill="url(#grid)"/>`);
  }
  // corner vignette / bloom — one extra light event, same hue as the accent
  if (spec.bloom) {
    const bc = c(spec.bloom.color ?? 'accent');
    defs.push(
      `<radialGradient id="bloom" cx="${spec.bloom.cx ?? 0.8}" cy="${spec.bloom.cy ?? 0.12}" r="${spec.bloom.r ?? 0.6}">` +
      `<stop offset="0" stop-color="${bc}" stop-opacity="${spec.bloom.strength ?? 0.22}"/>` +
      `<stop offset="1" stop-color="${bc}" stop-opacity="0"/></radialGradient>`
    );
    overlays.push(`<rect width="${w}" height="${h}" fill="url(#bloom)"/>`);
  }
  if (spec.vignette) {
    defs.push(
      `<radialGradient id="vig" cx="0.5" cy="0.46" r="0.78">` +
      `<stop offset="0.55" stop-color="#000" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="#000" stop-opacity="${spec.vignette}"/></radialGradient>`
    );
    overlays.push(`<rect width="${w}" height="${h}" fill="url(#vig)"/>`);
  }

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs>${defs.join('')}</defs><rect width="${w}" height="${h}" fill="${fill}"/>${overlays.join('')}</svg>`
  );
}

/** Deterministic paper grain — the thing that stops a flat plate looking like a swatch. */
function grainBuffer(w, h, seedRng, strength) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = 128 + (seedRng() - 0.5) * 255;
    const c = Math.max(0, Math.min(255, v));
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = c;
    px[i * 4 + 3] = Math.round(255 * strength);
  }
  return sharp(px, { raw: { width: w, height: h, channels: 4 } });
}

export async function renderBackground(spec, ctx) {
  const { w, h } = ctx.canvas;
  let img;

  if (spec.type === 'photo') {
    const file = assertAssetAllowed(spec.src);
    let plate = sharp(file).resize(w, h, { fit: 'cover', position: spec.position ?? 'centre' });
    const grade = spec.grade ?? 'duotone';
    if (grade === 'duotone') {
      // Force the plate into the accent's own hue so it merges with the accent
      // type into ONE chromatic cluster instead of adding a second.
      const lo = hexToRgb(resolveColor(spec.shadow ?? 'ink', ctx));
      const hi = hexToRgb(resolveColor(spec.highlight ?? 'accent', ctx));
      plate = plate.greyscale().linear(
        [(hi.r - lo.r) / 255, (hi.g - lo.g) / 255, (hi.b - lo.b) / 255],
        [lo.r, lo.g, lo.b]
      );
    } else if (grade === 'bw') {
      plate = plate.greyscale().linear(spec.contrast ?? 1.15, -(128 * ((spec.contrast ?? 1.15) - 1)));
    }
    img = sharp(await plate.removeAlpha().png().toBuffer());
    if (spec.darken || spec.vignette) {
      const veil = backgroundSvg({ type: 'flat', fill: '#00000000', vignette: spec.vignette }, ctx);
      const layers = [];
      if (spec.darken) {
        layers.push({
          input: Buffer.from(
            `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${withAlpha(resolveColor('ink', ctx), spec.darken)}"/></svg>`
          ),
        });
      }
      if (spec.vignette) layers.push({ input: veil });
      img = sharp(await img.composite(layers).png().toBuffer());
    }
  } else {
    img = sharp(backgroundSvg(spec, ctx));
  }

  if (spec.grain) {
    const g = await grainBuffer(w, h, ctx.rng, spec.grain).png().toBuffer();
    img = sharp(await img.composite([{ input: g, blend: 'overlay' }]).png().toBuffer());
  }
  return img.png().toBuffer();
}

// --------------------------------------------------------------------- subject
const ANCHORS = {
  'bottom-left': (cw, ch, w, h) => ({ x: 0, y: ch - h }),
  'bottom-center': (cw, ch, w, h) => ({ x: (cw - w) / 2, y: ch - h }),
  'bottom-right': (cw, ch, w, h) => ({ x: cw - w, y: ch - h }),
  'center': (cw, ch, w, h) => ({ x: (cw - w) / 2, y: (ch - h) / 2 }),
  'center-left': (cw, ch, w, h) => ({ x: 0, y: (ch - h) / 2 }),
  'center-right': (cw, ch, w, h) => ({ x: cw - w, y: (ch - h) / 2 }),
  'top-right': (cw, ch, w, h) => ({ x: cw - w, y: 0 }),
  'top-left': () => ({ x: 0, y: 0 }),
};

/**
 * Grade + scale + place a cutout. Returns the composite descriptor AND the
 * placed rect, so layout can reason about the subject/type overlap numerically
 * instead of hoping it looks intentional.
 */
export async function prepareSubject(spec, ctx) {
  if (!spec || (!spec.src && !spec.procedural)) return null;
  const { w: cw, h: ch } = ctx.canvas;

  // Procedural subjects are generated from the live palette, so they can never
  // carry a hue from another carousel's accent.
  const source = spec.procedural
    ? spec.procedural
    : assertAssetAllowed(spec.src);
  if (!spec.procedural && !fs.existsSync(source)) throw new Error(`subject asset missing: ${source}`);

  // Trim the transparent border first: heightPct must mean "this fraction of the
  // canvas is covered by visible subject", not "by the PNG's padded bounding box".
  // Skipping this is why a cutout ends up floating small in the middle of a slide.
  let img = sharp(await sharp(source).ensureAlpha().trim({ threshold: 1 }).png().toBuffer());
  const meta = await img.metadata();

  // Scale by height, then clamp by width. A 900x210 stage bar at heightPct 0.19
  // is 1174px wide on a 1080 canvas — round 2 sliced several objects flat against
  // the frame, which reads as a crop bug rather than as a bleed.
  let targetH = Math.round(ch * (spec.heightPct ?? 0.55));
  let targetW = Math.round((meta.width / meta.height) * targetH);
  const maxW = Math.round(cw * (spec.maxWidthPct ?? 0.72));
  if (targetW > maxW) { targetW = maxW; targetH = Math.round((meta.height / meta.width) * targetW); }
  img = img.resize(targetW, targetH, { fit: 'inside' });

  const grade = spec.grade ?? 'none';
  if (grade === 'bw') {
    img = img.greyscale().linear(spec.contrast ?? 1.2, -(128 * ((spec.contrast ?? 1.2) - 1)));
  } else if (grade === 'silhouette') {
    // flatten every opaque pixel to one colour — keeps the alpha, kills the detail
    const c = hexToRgb(resolveColor(spec.color ?? 'ink', ctx));
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < info.width * info.height; i++) {
      if (data[i * 4 + 3] > 0) { data[i * 4] = c.r; data[i * 4 + 1] = c.g; data[i * 4 + 2] = c.b; }
    }
    img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  } else if (grade === 'duotone') {
    const lo = hexToRgb(resolveColor(spec.shadow ?? 'ink', ctx));
    const hi = hexToRgb(resolveColor(spec.highlight ?? 'paper', ctx));
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.from(data);
    for (let i = 0; i < info.width * info.height; i++) {
      const l = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
      out[i * 4] = lo.r + (hi.r - lo.r) * l;
      out[i * 4 + 1] = lo.g + (hi.g - lo.g) * l;
      out[i * 4 + 2] = lo.b + (hi.b - lo.b) * l;
    }
    img = sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
  }

  if (spec.flip) img = img.flop();
  if (spec.opacity != null && spec.opacity < 1) {
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < info.width * info.height; i++) data[i * 4 + 3] = Math.round(data[i * 4 + 3] * spec.opacity);
    img = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }

  const buf = await img.png().toBuffer();
  // fit:'inside' preserves aspect, so the real buffer can be smaller than the
  // requested box in one axis. The placement rect must be the REAL size or the
  // off-canvas clip will ask sharp to extract outside the image.
  const out = await sharp(buf).metadata();
  const anchor = ANCHORS[spec.anchor || 'bottom-center'] || ANCHORS['bottom-center'];
  const base = anchor(cw, ch, out.width, out.height);
  const rect = {
    x: Math.round(base.x + (spec.dx ?? 0)),
    y: Math.round(base.y + (spec.dy ?? 0)),
    w: out.width,
    h: out.height,
  };
  return { input: buf, rect };
}

// ------------------------------------------------------------------- composite
/** Clip a composite that runs off-canvas — sharp rejects negative offsets. */
async function clipToCanvas(input, rect, cw, ch) {
  const left = Math.round(rect.x), top = Math.round(rect.y);
  if (left >= 0 && top >= 0 && left + rect.w <= cw && top + rect.h <= ch) {
    return { input, left, top };
  }
  const sx = Math.max(0, -left), sy = Math.max(0, -top);
  const w = Math.min(rect.w - sx, cw - Math.max(0, left));
  const h = Math.min(rect.h - sy, ch - Math.max(0, top));
  if (w <= 0 || h <= 0) return null;
  const cropped = await sharp(input).extract({ left: sx, top: sy, width: w, height: h }).png().toBuffer();
  return { input: cropped, left: Math.max(0, left), top: Math.max(0, top) };
}

/** background -> subject -> type -> furniture, in that order, every time. */
export async function composeSlide({ background, subject, typeLayer, furnitureLayer, canvas, out }) {
  const layers = [];
  if (subject) {
    const c = await clipToCanvas(subject.input, subject.rect, canvas.w, canvas.h);
    if (c) layers.push(c);
  }
  if (typeLayer) layers.push({ input: typeLayer, left: 0, top: 0 });
  if (furnitureLayer) layers.push({ input: furnitureLayer, left: 0, top: 0 });

  let img = sharp(background).composite(layers);
  const buf = await img.png({ compressionLevel: 9 }).toBuffer();
  const meta = await sharp(buf).metadata();
  if (meta.width !== canvas.w || meta.height !== canvas.h) {
    throw new Error(`canvas drift: rendered ${meta.width}x${meta.height}, expected ${canvas.w}x${canvas.h}`);
  }
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, buf);
  }
  return buf;
}
