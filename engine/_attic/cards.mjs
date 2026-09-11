// The CARD layer: tilted, rounded, drop-shadowed panels floating over the plate.
//
// This is the signature move of the depth format — miniature covers and product
// panels scattered in front of and behind the subject, each rotated a few
// degrees with a soft shadow under it. It is what produces the sense of physical
// layers, and no amount of type or grading substitutes for it.
//
// Each card is composited independently rather than drawn into one SVG, because
// a rotated raster needs its own alpha and its own shadow geometry.
import sharp from 'sharp';
import { resolveColor, withAlpha } from './palette.mjs';

const rad = (deg) => (deg * Math.PI) / 180;

/**
 * Rounded-corner mask for a card.
 * Applied before rotation so the corners rotate with the card.
 */
function roundedMask(w, h, r) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
}

/**
 * Build one card: source image -> cover-crop -> rounded -> border -> rotate,
 * then a separately rotated shadow slab behind it.
 *
 * @returns {{shadow:{input,left,top}|null, card:{input,left,top}}}
 */
export async function buildCard(spec, ctx) {
  const { w: cw, h: ch } = ctx.canvas;
  const w = Math.round(cw * (spec.widthPct ?? 0.34));
  const h = Math.round(w / (spec.aspect ?? 0.8));
  const radius = spec.radius ?? Math.round(w * 0.07);
  const angle = spec.rotate ?? 0;

  let base;
  if (spec.src) {
    // A card is a PANEL, not a sticker: it has to be opaque or the plate shows
    // through it and the depth cue collapses. Cutout sources carry alpha, so
    // they are flattened onto the card's own ground first.
    const ground = resolveColor(spec.cardFill ?? 'paper', ctx);
    const inner = await sharp(spec.src)
      .resize(w, h, { fit: spec.fit ?? 'cover', position: spec.position ?? 'attention',
                      background: ground })
      .png().toBuffer();
    base = sharp({ create: { width: w, height: h, channels: 4, background: ground } })
      .composite([{ input: inner }]);
  } else {
    // a flat card — used for the plain white "before" panel in a comparison
    const fill = resolveColor(spec.fill ?? 'paper', ctx);
    base = sharp(Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect width="${w}" height="${h}" fill="${fill}"/></svg>`
    ));
  }

  let buf = await base.png().toBuffer();

  // round the corners
  buf = await sharp(buf)
    .composite([{ input: roundedMask(w, h, radius), blend: 'dest-in' }])
    .png().toBuffer();

  // optional keyline, drawn inside the rounded edge
  if (spec.border) {
    const bc = resolveColor(spec.border.color ?? 'paper', ctx);
    const bw = spec.border.width ?? 6;
    buf = await sharp(buf).composite([{
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
        `<rect x="${bw / 2}" y="${bw / 2}" width="${w - bw}" height="${h - bw}" rx="${radius}" ry="${radius}" ` +
        `fill="none" stroke="${bc}" stroke-width="${bw}"/></svg>`
      ),
    }]).png().toBuffer();
  }

  const rotated = angle
    ? await sharp(buf).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    : buf;
  const rm = await sharp(rotated).metadata();

  // Placement is by CENTRE, so rotation does not shift the card off its mark —
  // rotating grows the bounding box, and anchoring by corner would drift.
  const cx = Math.round(cw * (spec.cx ?? 0.5));
  const cy = Math.round(ch * (spec.cy ?? 0.5));
  const left = Math.round(cx - rm.width / 2);
  const top = Math.round(cy - rm.height / 2);

  let shadow = null;
  if (spec.shadow !== false) {
    const s = spec.shadow || {};
    const blur = s.blur ?? 26;
    const dx = s.dx ?? 0;
    const dy = s.dy ?? Math.round(h * 0.045);
    const alpha = s.alpha ?? 0.32;
    // The shadow is the card's own silhouette, blurred — not a rectangle, so a
    // rotated card casts a rotated shadow.
    const sil = await sharp(rotated)
      .extractChannel('alpha')
      .toColourspace('b-w')
      .blur(blur)
      .toBuffer();
    const sm = await sharp(sil).metadata();
    const tint = withAlpha(resolveColor(s.color ?? 'ink', ctx), alpha);
    const slab = await sharp({
      create: { width: sm.width, height: sm.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sm.width}" height="${sm.height}"><rect width="${sm.width}" height="${sm.height}" fill="${tint}"/></svg>`) },
        { input: sil, blend: 'dest-in' },
      ])
      .png().toBuffer();
    shadow = { input: slab, left: left + dx, top: top + dy };
  }

  return {
    shadow,
    card: { input: rotated, left, top },
    rect: { x: left, y: top, w: rm.width, h: rm.height },
  };
}

/**
 * Build every card for a slide, in declaration order (first = furthest back).
 * Cards whose source is missing are skipped rather than failing the slide: a
 * card is decoration, and a missing decoration must not cost the carousel.
 */
export async function buildCards(specs, ctx, onWarn = () => {}) {
  const out = [];
  for (const spec of specs || []) {
    try {
      out.push(await buildCard(spec, ctx));
    } catch (e) {
      onWarn(`card skipped: ${e.message}`);
    }
  }
  return out;
}
