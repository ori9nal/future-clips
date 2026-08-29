// The CONSTELLATION layout: N labelled objects orbiting a clear centre.
//
// This is the structure the research found and the engine never had
// (RESEARCH.md §4): papanca's interiors put SEVEN objects on one frame, each
// with a 2-4 word label, around a small centred serif title. Seven ideas per
// slide, against the one headline + one photograph the engine was producing.
//
// The solver is rejection sampling on a ring band, not a grid: a grid reads as
// a table, and the reference is deliberately scattered. Candidates are rejected
// for overlapping each other, overlapping the centre title block, or leaving the
// frame — which is exactly the Poisson-disk-with-collision-rejection the brief
// asked for.
import { rng as makeRng } from './seed.mjs';

const rectsOverlap = (a, b, pad = 0) =>
  a.x - pad < b.x + b.w && a.x + a.w + pad > b.x &&
  a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;

/**
 * @param {object} o
 * @param {{w,h}} o.canvas
 * @param {Array<{id,w,h,label?}>} o.items  natural sizes; scaled to fit
 * @param {{x,y,w,h}} o.centre              keep-clear block for the title
 * @param {number} o.seed
 * @returns {{placed:Array, dropped:Array}}
 */
export function solveConstellation({
  canvas, items, centre, seed = 1,
  margin = 40, gap = 16, labelH = 54, tries = 2200,
  minScale = 0.55, maxScale = 1.0,
}) {
  const r = makeRng(seed);
  const placed = [];
  const dropped = [];

  // Bigger objects first: a large item placed late has nowhere to go, and the
  // frame ends up with all the mass in one corner.
  const order = items
    .map((it, i) => ({ ...it, _i: i, _area: it.w * it.h }))
    .sort((a, b) => b._area - a._area);

  for (const item of order) {
    let done = false;

    for (let t = 0; t < tries && !done; t++) {
      // Shrink as attempts run out rather than failing outright — a slightly
      // smaller object beats a missing one.
      const relax = t / tries;
      const scale = maxScale - (maxScale - minScale) * relax;
      const w = Math.round(item.w * scale);
      const h = Math.round(item.h * scale);
      const boxH = h + (item.label ? labelH : 0);
      if (w > canvas.w - margin * 2 || boxH > canvas.h - margin * 2) continue;

      // Sample on a RING around the centre, not uniformly over the frame.
      // Uniform sampling clusters wherever the first few objects happened to
      // land and leaves a dead band on the opposite side; orbiting the title is
      // what the word constellation actually describes.
      //
      // Each object gets its own angular slot so the ring is walked rather than
      // scattered, with jitter so it never reads as a clock face.
      const slot = (placed.length + dropped.length) % Math.max(1, items.length);
      const spread = (Math.PI * 2) / Math.max(1, items.length);
      const angle = slot * spread + (r() - 0.5) * spread * 0.9 - Math.PI / 2;
      const cxC = centre.x + centre.w / 2;
      const cyC = centre.y + centre.h / 2;
      // radius grows with attempts, so a crowded ring pushes outward
      const rMin = Math.max(centre.w, centre.h) * 0.58;
      const rMax = Math.min(canvas.w, canvas.h) * 0.62;
      const rad = rMin + (rMax - rMin) * (0.25 + 0.75 * r()) * (0.7 + 0.5 * relax);

      const x = Math.round(cxC + Math.cos(angle) * rad - w / 2);
      const y = Math.round(cyC + Math.sin(angle) * rad * 0.92 - boxH / 2);
      if (x < margin || y < margin || x + w > canvas.w - margin || y + boxH > canvas.h - margin) continue;
      const rect = { x, y, w, h: boxH };

      // A caption is often WIDER than the object it belongs to, and an object
      // near the edge would push its own label out of frame. Clamp the label
      // here, inside the solver, so the reserved box is where the text will
      // actually be — clamping at render time instead let a shifted label land
      // on top of a neighbouring object.
      let labelRect = null;
      if (item.label) {
        const lw = Math.max(item.labelW || 0, w);
        const lx = Math.min(Math.max(x + w / 2 - lw / 2, margin), canvas.w - margin - lw);
        labelRect = { x: Math.round(lx), y: y + h + 8, w: Math.round(lw), h: labelH - 8 };
      }
      // the collision box is the union of the object and its (clamped) caption
      const union = labelRect
        ? {
            x: Math.min(rect.x, labelRect.x),
            y: rect.y,
            w: Math.max(rect.x + rect.w, labelRect.x + labelRect.w) - Math.min(rect.x, labelRect.x),
            h: labelRect.y + labelRect.h - rect.y,
          }
        : rect;

      if (rectsOverlap(union, centre, 26)) continue;
      if (placed.some((p) => rectsOverlap(union, p.box, gap))) continue;
      if (union.x < margin || union.x + union.w > canvas.w - margin) continue;

      placed.push({
        id: item.id,
        i: item._i,
        label: item.label || null,
        rect: { x, y, w, h },
        box: union,
        labelRect,
        scale: +scale.toFixed(3),
      });
      done = true;
    }

    if (!done) dropped.push(item.id);
  }

  return { placed: placed.sort((a, b) => a.i - b.i), dropped };
}

/**
 * Natural display sizes, in canvas pixels, for the object library.
 * Kept here rather than in objects.mjs because it is a LAYOUT decision: how
 * big a stopwatch should read next to a chart is composition, not drawing.
 */
export const OBJECT_SIZE = {
  'chart-line':  { w: 330, h: 182 },
  'chart-zones': { w: 320, h: 165 },
  'watch':       { w: 190, h: 230 },
  'rings':       { w: 210, h: 210 },
  'stat':        { w: 215, h: 133 },
  'grid-weeks':  { w: 250, h: 285 },
  'medal':       { w: 160, h: 229 },
  'stopwatch':   { w: 175, h: 208 },
  'plates':      { w: 215, h: 215 },
  'dumbbell':    { w: 285, h: 121 },
  'bottle':      { w: 105, h: 229 },
  'tub':         { w: 175, h: 208 },
  'shoe':        { w: 285, h: 148 },
};

export const sizeOf = (id) => OBJECT_SIZE[id] || { w: 220, h: 220 };
