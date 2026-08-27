// Template resolution. Templates are DATA — this file is the only place that
// knows how to turn a box spec into pixels, and it has no knowledge of any
// specific family. Adding F6 means adding a JSON file, not editing this.
import { resolveFace } from './fonts.mjs';
import { fitText, fitLines, layoutWidth, rectsOverlap } from './fit-text.mjs';
import { resolveColor, withAlpha, shade } from './palette.mjs';

// ------------------------------------------------------------------- geometry
function safeBox(t) {
  const { w, h } = t.canvas;
  const s = t.safe;
  return { x: s.left, y: s.top, w: w - s.left - s.right, h: h - s.top - s.bottom };
}

/**
 * Box values may be:
 *   number                 absolute px
 *   "safe.left" etc.       named anchor
 *   {after:"id", gap:n}    below a previously-resolved slot
 *   {until:"safe.bottom"}  stretch to an anchor
 *   {pct:0.42}             fraction of the canvas dimension
 */
function resolveValue(v, axis, ctx) {
  const { tpl, placed } = ctx;
  const S = safeBox(tpl);
  const C = tpl.canvas;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const table = {
      'safe.left': S.x, 'safe.right': S.x + S.w, 'safe.top': S.y, 'safe.bottom': S.y + S.h,
      'safe.width': S.w, 'safe.height': S.h,
      'safe.cx': S.x + S.w / 2, 'safe.cy': S.y + S.h / 2,
      'canvas.w': C.w, 'canvas.h': C.h, 'canvas.cx': C.w / 2, 'canvas.cy': C.h / 2,
    };
    if (v in table) return table[v];
    throw new Error(`unknown box token "${v}"`);
  }
  if (v && typeof v === 'object') {
    if (v.pct != null) return (axis === 'x' ? C.w : C.h) * v.pct;
    if (v.after != null) {
      const p = placed.get(v.after);
      if (!p) throw new Error(`box refers to "${v.after}" which is not placed yet (slot order matters)`);
      return p.y + p.h + (v.gap ?? 0);
    }
    if (v.until != null) {
      const end = resolveValue(v.until, axis, ctx);
      const start = v.from != null ? resolveValue(v.from, axis, ctx) : 0;
      return Math.max(0, end - start - (v.minus ?? 0));
    }
    if (v.remaining != null) {
      const p = placed.get(v.remaining);
      const end = resolveValue(v.until ?? 'safe.bottom', axis, ctx);
      return Math.max(0, end - (p ? p.y + p.h : 0) - (v.gap ?? 0));
    }
  }
  throw new Error(`cannot resolve box value ${JSON.stringify(v)}`);
}

function resolveBox(spec, ctx) {
  const y = resolveValue(spec.y, 'y', ctx);
  const x = resolveValue(spec.x, 'x', ctx);
  const w = spec.w && typeof spec.w === 'object' && spec.w.until != null
    ? resolveValue({ ...spec.w, from: spec.x }, 'x', ctx)
    : resolveValue(spec.w, 'x', ctx);
  const h = spec.h && typeof spec.h === 'object' && (spec.h.until != null || spec.h.remaining != null)
    ? resolveValue(spec.h.remaining != null ? spec.h : { ...spec.h, from: spec.y }, 'y', ctx)
    : resolveValue(spec.h, 'y', ctx);
  return { x, y, w, h };
}

// --------------------------------------------------------------- accent runs
function pickAccentTarget(target, lines, explicit) {
  const words = lines.join(' ').split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const strip = (s) => s.replace(/[^\p{L}\p{N}’'-]/gu, '');
  switch (target) {
    case 'none': return null;
    case 'manual': return explicit ? strip(explicit) : null;
    case 'first-word': return strip(words[0]);
    case 'last-word': return strip(words[words.length - 1]);
    case 'longest-word':
      return strip(words.slice().sort((a, b) => strip(b).length - strip(a).length)[0]);
    case 'numeral': {
      const n = words.find((w) => /\d/.test(w));
      return n ? strip(n) : null;
    }
    default:
      if (/^line:\d+$/.test(target)) return { line: Number(target.split(':')[1]) };
      return null;
  }
}

/**
 * Build the per-line run splitter satori uses to colour exactly one target.
 * Returns a function(lineText, lineIndex) -> [{text, color, face, gradient}]
 */
function makeRunner(slot, fit, ctx, accentTarget) {
  const baseColor = resolveColor(slot.color, ctx.palette);
  const accColor = resolveColor(slot.accent?.color ?? 'accent', ctx.palette);
  const accFace = slot.accent?.font
    ? resolveFace(slot.accent.font.role ?? slot.font.role, slot.accent.font.weight ?? slot.font.weight, slot.accent.font.style ?? slot.font.style)
    : null;
  const gradient = slot.gradient
    ? `linear-gradient(${slot.gradient.angle ?? 90}deg, ${slot.gradient.stops.map((s) => `${resolveColor(s.color, ctx.palette)} ${Math.round(s.at * 100)}%`).join(', ')})`
    : null;

  return (text, i) => {
    if (gradient && !accentTarget) return [{ text, color: baseColor, gradient }];
    if (!accentTarget) return [{ text, color: baseColor, gradient }];
    if (typeof accentTarget === 'object' && accentTarget.line != null) {
      return accentTarget.line === i
        ? [{ text, color: accColor, face: accFace || undefined, gradient: slot.accent?.gradient ? gradient : null }]
        : [{ text, color: baseColor, gradient }];
    }
    // word target — split the line around the first exact match
    const re = new RegExp(`(^|\\s)(${accentTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=\\s|$|[.,!?:;”'’])`, 'u');
    const m = text.match(re);
    if (!m) return [{ text, color: baseColor, gradient }];
    const start = m.index + m[1].length;
    const end = start + m[2].length;
    const out = [];
    if (start > 0) out.push({ text: text.slice(0, start), color: baseColor, gradient });
    out.push({ text: text.slice(start, end), color: accColor, face: accFace || undefined });
    if (end < text.length) out.push({ text: text.slice(end), color: baseColor, gradient });
    return out;
  };
}

// ------------------------------------------------------------------ the layout
/**
 * Fit every type slot of one slide.
 * @returns {{ok:true, blocks, rects, shapes} | {ok:false, reason, slot}}
 */
export function layoutSlide({ tpl, role, content, palette, canvas, displayCap }) {
  const roleSpec = tpl.roles[role];
  if (!roleSpec) throw new Error(`template ${tpl.id} has no role "${role}"`);
  const ctx = { tpl, placed: new Map(), palette };
  const S = safeBox(tpl);
  const blocks = [];
  const rects = [];
  const shapes = [];        // painted with the type, above the subject
  const underShapes = [];   // painted below the subject: rules, swatches
  let renderedWords = 0;

  for (const slot of roleSpec.type || []) {
    const raw = content[slot.content];
    const text = raw == null ? '' : String(raw).trim();
    if (!text) {
      if (slot.optional) continue;
      return { ok: false, reason: 'missing-content', slot: slot.id };
    }

    renderedWords += text.split(/\s+/).filter(Boolean).length;
    const face = resolveFace(slot.font.role, slot.font.weight ?? 400, slot.font.style ?? 'normal');
    const box = resolveBox(slot.box, ctx);
    if (box.w <= 0 || box.h <= 0) return { ok: false, reason: 'degenerate-box', slot: slot.id };

    // The cover must dominate. Once the cover's display size is known it is passed
    // back in as a ceiling for every later slide, so hierarchy is guaranteed by
    // construction rather than by hand-tuned per-template maxima.
    const capped = slot.hierarchy === 'display' && displayCap
      ? Math.max(slot.size[0], Math.min(slot.size[1], Math.floor(displayCap)))
      : slot.size[1];
    const opts = {
      min: slot.size[0],
      max: capped,
      lineHeight: slot.lineHeight ?? 1.05,
      tracking: slot.tracking ?? 0,
      maxLines: slot.maxLines ?? Infinity,
      autoLeading: slot.autoLeading !== false,
    };
    const fit = slot.mode === 'lines'
      ? fitLines(face, text.split('\n'), box, opts)
      : fitText(face, text, box, opts);

    // fitText returning null is the contract: shorten the copy, never ship overflow
    if (!fit) return { ok: false, reason: 'no-fit', slot: slot.id, box, text };

    // The slot's REAL PAINTED rect. fit.width already includes the ink that
    // escapes the advance box, and paintedHeight the ink that escapes the line
    // box when leading is negative — so collisions, `after:` gaps and the safe
    // check all reason about ink, not about boxes that ink spills out of.
    const alignX = slot.align === 'center' ? box.x + (box.w - fit.width) / 2
      : slot.align === 'right' ? box.x + box.w - fit.width
        : box.x;
    const alignY = slot.valign === 'middle' ? box.y + (box.h - fit.height) / 2
      : slot.valign === 'bottom' ? box.y + box.h - fit.height
        : box.y;
    const rect = {
      id: slot.id,
      x: alignX,
      y: alignY + (fit.inkTop ?? 0),
      w: fit.width,
      h: fit.paintedHeight ?? fit.height,
    };
    ctx.placed.set(slot.id, rect);
    rects.push(rect);

    // Satori paints with the glyph origin at the block's content edge, so a face
    // whose ink starts left of that origin would paint outside the box. Shift the
    // painted block by the overhang so ink lands exactly on the intended edge.
    const inkL = fit.inkLeft ?? 0, inkR = fit.inkRight ?? 0;
    const paintDx = slot.align === 'center' ? (inkL - inkR) / 2
      : slot.align === 'right' ? -inkR
        : inkL;

    const accentTarget = slot.accent
      ? pickAccentTarget(slot.accent.target, fit.lines, content[slot.accent.from ?? 'accentWord'])
      : null;

    blocks.push({
      id: slot.id,
      x: box.x + paintDx, y: box.y, w: box.w, h: box.h,
      align: slot.align ?? 'left',
      valign: slot.valign ?? 'top',
      fit, face,
      color: resolveColor(slot.color, palette),
      opacity: slot.opacity,
      shadow: slot.shadow
        ? `${slot.shadow.dx}px ${slot.shadow.dy}px ${slot.shadow.blur ?? 0}px ${withAlpha(resolveColor(slot.shadow.color ?? 'ink', palette), slot.shadow.alpha ?? 0.18)}`
        : null,
      justify: slot.justify === true,
      runsFor: makeRunner(slot, fit, { palette }, accentTarget),
      extraFaces: slot.accent?.font
        ? [resolveFace(slot.accent.font.role ?? slot.font.role, slot.accent.font.weight ?? slot.font.weight, slot.accent.font.style ?? slot.font.style)]
        : [],
    });

    // decorations attached to a slot (rules, highlighter swatches)
    for (const dec of slot.decorations || []) {
      const bucket = dec.above === true ? shapes : underShapes;
      if (dec.kind === 'rule') {
        bucket.push({
          kind: 'rect',
          x: dec.align === 'text' ? rect.x : box.x,
          y: rect.y + rect.h + (dec.gap ?? 20),
          w: dec.w === 'text' ? rect.w : (dec.w ?? box.w),
          h: dec.weight ?? 3,
          color: resolveColor(dec.color ?? 'ink', palette),
          opacity: dec.opacity ?? 1,
        });
      } else if (dec.kind === 'swatch') {
        bucket.push({
          kind: 'rect',
          x: rect.x - (dec.padX ?? 14),
          y: rect.y + rect.h * (dec.top ?? 0.24),
          w: rect.w + 2 * (dec.padX ?? 14),
          h: rect.h * (dec.height ?? 0.6),
          color: resolveColor(dec.color ?? 'accent', palette),
          opacity: dec.opacity ?? 0.28,
          radius: dec.radius ?? 4,
        });
      }
    }
  }

  // ---- collision: type slots must not overlap each other ----
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j], 1)) {
        return { ok: false, reason: 'collision', slot: `${rects[i].id}|${rects[j].id}`, a: rects[i], b: rects[j] };
      }
    }
  }
  // ---- safe area: type never bleeds, subjects may ----
  for (const r of rects) {
    if (r.x < S.x - 1 || r.y < S.y - 1 || r.x + r.w > S.x + S.w + 1 || r.y + r.h > S.y + S.h + 1) {
      return { ok: false, reason: 'outside-safe', slot: r.id, rect: r, safe: S };
    }
  }

  const displaySize = blocks.find((b) => (roleSpec.type || []).find((t) => t.id === b.id)?.hierarchy === 'display')?.fit.size
    ?? blocks.find((b) => b.id === 'headline')?.fit.size ?? null;
  return { ok: true, blocks, rects, shapes, underShapes, safe: S, renderedWords, displaySize };
}

// ------------------------------------------------------------------- furniture
const CORNERS = {
  'top-left': (S, w, h) => ({ x: S.x, y: S.y - h - 0 }),
  'top-center': (S, w, h) => ({ x: S.x + (S.w - w) / 2, y: S.y - h }),
  'top-right': (S, w, h) => ({ x: S.x + S.w - w, y: S.y - h }),
  'bottom-left': (S, w, h) => ({ x: S.x, y: S.y + S.h }),
  'bottom-center': (S, w, h) => ({ x: S.x + (S.w - w) / 2, y: S.y + S.h }),
  'bottom-right': (S, w, h) => ({ x: S.x + S.w - w, y: S.y + S.h }),
};

/**
 * Furniture lives in the margins, OUTSIDE the type safe box — which is exactly
 * why it can be a set-level constant that never moves between slides.
 */
export function layoutFurniture({ tpl, role, slideIndex, slideCount, palette, brand }) {
  const S = safeBox(tpl);
  const C = tpl.canvas;
  const blocks = [];
  const shapes = [];

  for (const f of tpl.furniture || []) {
    if (f.on && !f.on.includes(role)) continue;
    const font = f.font ?? { role: 'body', weight: 500 };
    const face = resolveFace(font.role, font.weight ?? 500, font.style ?? 'normal');
    const size = f.size ?? 26;
    const tracking = f.tracking ?? 0;

    let text;
    if (f.type === 'handle') text = brand.handle;
    else if (f.type === 'wordmark') text = f.uppercase === false ? brand.wordmark : brand.wordmark.toUpperCase();
    else if (f.type === 'index') text = (f.format ?? '{i}/{n}').replace('{i}', String(slideIndex + 1).padStart(f.pad ?? 1, '0')).replace('{n}', String(slideCount));
    else if (f.type === 'label') text = f.text;
    else if (f.type === 'arrow') text = f.glyph ?? '→';
    else continue;

    const trackPx = tracking * size;
    const w = layoutWidth(face, text, size, trackPx);
    const h = size * (f.lineHeight ?? 1.2);
    const anchor = CORNERS[f.anchor] || CORNERS['bottom-left'];
    const base = anchor(S, w, h);
    const marginGap = f.gap ?? 0;
    const y = f.anchor.startsWith('top') ? base.y - marginGap : base.y + marginGap;
    const rect = { x: base.x + (f.dx ?? 0), y: y + (f.dy ?? 0), w, h };

    // keep furniture inside the physical canvas even if a template over-nudges it
    rect.x = Math.max(8, Math.min(C.w - w - 8, rect.x));
    rect.y = Math.max(8, Math.min(C.h - h - 8, rect.y));

    blocks.push({
      id: `furniture:${f.type}`,
      x: rect.x, y: rect.y, w, h,
      align: 'left', valign: 'top',
      fit: { size, lines: [text], lineHeight: f.lineHeight ?? 1.2, trackingPx: trackPx },
      face,
      color: resolveColor(f.color ?? 'ink', palette),
      opacity: f.opacity ?? 1,
      runsFor: null,
    });

    if (f.dot && !(f.dotOff || []).includes(role)) {
      shapes.push({
        kind: 'rect', radius: 999,
        x: rect.x - (f.dot.gap ?? 18) - (f.dot.r ?? 5) * 2,
        y: rect.y + h / 2 - (f.dot.r ?? 5),
        w: (f.dot.r ?? 5) * 2, h: (f.dot.r ?? 5) * 2,
        color: resolveColor(f.dot.color ?? 'accent', palette),
      });
    }
  }

  // free-standing rules declared at template level
  for (const r of tpl.rules || []) {
    if (r.on && !r.on.includes(role)) continue;
    shapes.push({
      kind: 'rect',
      x: r.x === 'safe.left' ? S.x : r.x,
      y: r.y,
      w: r.w === 'safe.width' ? S.w : r.w,
      h: r.h ?? 2,
      color: resolveColor(r.color ?? 'ink', palette),
      opacity: r.opacity ?? 1,
    });
  }

  return { blocks, shapes };
}

/**
 * Area of `rect` hidden by `sub`, as a fraction of `rect`.
 * A subject crossing a display line is the corpus idiom; a subject sitting on top
 * of body copy is a mistake, and round 3 shipped it on two families.
 */
export function coverage(rect, sub) {
  const w = Math.min(rect.x + rect.w, sub.x + sub.w) - Math.max(rect.x, sub.x);
  const h = Math.min(rect.y + rect.h, sub.y + sub.h) - Math.max(rect.y, sub.y);
  if (w <= 0 || h <= 0) return 0;
  return (w * h) / Math.max(1, rect.w * rect.h);
}

export { safeBox };
