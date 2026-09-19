/**
 * Where the words sit on a slide, and how to move or rewrite them.
 *
 * The image model draws the photograph and nothing else — every art prompt
 * says "No text, no logos, no watermarks, no captions anywhere in the image".
 * The words are ours: each style builds an SVG and `registry.render` hands it
 * to resvg. So the type on a finished slide is not baked into the picture, it
 * is a `<text>` element we wrote, and this module is what lets a customer
 * treat it as one.
 *
 * It works on the SVG body rather than inside the ten styles. A style decides
 * where a block goes the first time — measuring the photograph for a calm
 * band, stacking around a card — and that judgement is worth keeping. What a
 * customer wants afterwards is smaller: this line should say something else,
 * that block sits two centimetres too low. Reading the finished body gives
 * exactly that, for every style at once, with no placement protocol for the
 * styles to implement and drift out of.
 *
 * A block is what a reader would call one piece of text: consecutive runs at
 * the same size and alignment, a line apart. Blocks are numbered in document
 * order (`b0`, `b1`, …), which is stable while the slide keeps the same shape
 * — rewriting a block's words changes the runs inside it, never the count.
 */
import fs from 'node:fs';
import path from 'node:path';
import { FACES } from './styles/kit.mjs';
import { layoutWidth } from './fit-text.mjs';
import { loadFace } from './fonts.mjs';
import { breakToFit } from './caption.mjs';

const TEXT_RE = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
/** a backing pill or card, to be carried along when its text moves */
const RECT_RE = /<rect\b[^>]*\/>\s*$/;

const unesc = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function attrsOf(s) {
  const out = {};
  for (const m of String(s).matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) out[m[1]] = m[2];
  return out;
}

/** Every `<text>` element in a slide body, in document order. */
export function readRuns(body) {
  const runs = [];
  TEXT_RE.lastIndex = 0;
  for (const m of String(body).matchAll(TEXT_RE)) {
    const a = attrsOf(m[1]);
    runs.push({
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
      attrs: a,
      x: Number(a.x ?? 0),
      y: Number(a.y ?? 0),
      size: Number(a['font-size'] ?? 40),
      anchor: a['text-anchor'] ?? 'start',
      family: a['font-family'] ?? 'Archivo',
      weight: a['font-weight'] ?? '400',
      fontStyle: a['font-style'] ?? null,
      fill: a.fill ?? '#000',
      text: unesc(m[2]),
    });
  }
  return runs;
}

/** The face file whose family, weight and style the SVG names. */
function faceFor({ family, weight, fontStyle }) {
  const hit = Object.values(FACES).find((f) =>
    f.family === family && String(f.weight) === String(weight) && (f.style ?? null) === (fontStyle ?? null));
  return hit ?? Object.values(FACES).find((f) => f.family === family) ?? FACES.sans;
}

const sameLine = (a, b) =>
  a.anchor === b.anchor &&
  Math.abs(a.size - b.size) <= 1 &&
  Math.abs(a.x - b.x) <= 2 &&
  b.y - a.y > a.size * 0.7 &&
  b.y - a.y < a.size * 2.2;

/**
 * The slide's text as blocks a person would recognise, with the box each one
 * occupies. `box` is in canvas pixels; the editor scales it to whatever size
 * it is showing the slide at.
 */
export function readBlocks(body, { root } = {}) {
  const runs = readRuns(body);
  const blocks = [];
  for (const run of runs) {
    const last = blocks[blocks.length - 1];
    if (last && sameLine(last.runs[last.runs.length - 1], run)) last.runs.push(run);
    else blocks.push({ runs: [run] });
  }
  return blocks.map((b, i) => {
    const first = b.runs[0], last = b.runs[b.runs.length - 1];
    const face = faceFor(first);
    const ff = root ? tryFace(root, face.file) : null;
    const widths = b.runs.map((r) => (ff ? layoutWidth(ff, r.text, r.size) : r.text.length * r.size * 0.5));
    const wide = Math.max(1, ...widths);
    const x = first.anchor === 'middle' ? first.x - wide / 2 : first.anchor === 'end' ? first.x - wide : first.x;
    // a run's y is its baseline; the block starts about a cap height above the first
    const top = first.y - first.size * 0.82;
    const lh = b.runs.length > 1 ? b.runs[1].y - first.y : first.size * 1.3;
    return {
      id: `b${i}`,
      lines: b.runs.map((r) => r.text),
      box: { x: Math.round(x), y: Math.round(top), w: Math.round(wide), h: Math.round(last.y + last.size * 0.3 - top) },
      size: first.size,
      anchor: first.anchor,
      fill: first.fill,
      face: face.file,
      lineHeight: Math.round(lh),
      start: first.start,
      end: last.end,
      runs: b.runs,
    };
  });
}

const faceCache = new Map();
function tryFace(root, file) {
  if (faceCache.has(file)) return faceCache.get(file);
  let f = null;
  try {
    const p = path.join(root, 'assets/fonts', `${file}.ttf`);
    if (fs.existsSync(p)) f = loadFace(file);
  } catch { /* measured roughly instead */ }
  faceCache.set(file, f);
  return f;
}

/** Re-emit one block's runs with new words, wrapped and fitted to its column. */
function reflow(block, lines, { root, canvasW }) {
  const face = tryFace(root, block.face);
  const first = block.runs?.[0];
  const attrs = { ...(first?.attrs ?? {}) };
  // the column the block already occupies, never narrower than a readable one
  const column = Math.max(block.box.w, Math.round(canvasW * 0.72));
  const wrapTo = Math.min(column, Math.round(canvasW * 0.92));
  let size = block.size;
  let out = lines.flatMap((l) => (face ? breakToFit(face, l, wrapTo, size, { max: 8 }) : [l])).filter((l) => l.trim());
  if (!out.length) return '';
  // nothing may run off the canvas: if a word cannot be broken small enough,
  // the block shrinks rather than bleeding over the edge
  if (face) {
    for (let guard = 0; guard < 12; guard++) {
      const widest = Math.max(...out.map((l) => layoutWidth(face, l, size)));
      if (widest <= wrapTo || size <= block.size * 0.55) break;
      size = Math.max(Math.round(block.size * 0.55), Math.round(size * Math.min(0.94, wrapTo / widest)));
      out = lines.flatMap((l) => breakToFit(face, l, wrapTo, size, { max: 8 })).filter((l) => l.trim());
    }
  }
  const lh = Math.round(block.lineHeight * (size / block.size));
  const baseX = block.runs[0].x;
  let y = block.runs[0].y;
  let svg = '';
  for (const l of out) {
    const a = { ...attrs, x: String(baseX), y: String(Math.round(y)), 'font-size': String(size) };
    svg += `<text ${Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')}>${esc(l)}</text>`;
    y += lh;
  }
  return svg;
}

/**
 * Apply a customer's edits to one slide body.
 *
 * `edits` is keyed by block id: `{ b0: { lines, dx, dy }, … }`. `lines`
 * replaces the words, `dx`/`dy` move the block in canvas pixels. A block drawn
 * on a pill or a card moves with it — the shape immediately before the block
 * that encloses it is carried along, so a moved label does not leave its
 * background behind.
 */
export function applyEdits(body, edits, { root, canvasW = 1080 } = {}) {
  if (!edits || !Object.keys(edits).length) return body;
  const blocks = readBlocks(body, { root });
  let out = String(body);
  // back to front, so the offsets of the blocks still to do stay valid
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const e = edits[b.id];
    if (!e) continue;
    const dx = Number(e.dx ?? 0), dy = Number(e.dy ?? 0);
    const lines = Array.isArray(e.lines) ? e.lines.map((l) => String(l ?? '')) : null;
    let start = b.start, end = b.end;
    let inner = lines ? reflow(b, lines, { root, canvasW }) : out.slice(start, end);
    if (!inner) { out = out.slice(0, start) + out.slice(end); continue; }
    if (dx || dy) {
      // carry the pill or card the block sits on, when there is one
      const before = out.slice(0, start);
      const m = before.match(RECT_RE);
      if (m && enclosing(m[0], b.box)) { start -= m[0].length; inner = m[0] + inner; }
      inner = `<g transform="translate(${Math.round(dx)},${Math.round(dy)})">${inner}</g>`;
    }
    out = out.slice(0, start) + inner + out.slice(end);
  }
  return out;
}

/** Does this rect sit behind that box? (a pill is a little larger than its label) */
function enclosing(rectSvg, box) {
  const a = attrsOf(rectSvg);
  const x = Number(a.x ?? 0), y = Number(a.y ?? 0), w = Number(a.width ?? 0), h = Number(a.height ?? 0);
  return x <= box.x + 4 && y <= box.y + 8 && x + w >= box.x + box.w - 4 && y + h >= box.y + box.h - 8;
}

/** What the slide says, for the compliance check an edit still has to pass. */
export const textOf = (body) => readRuns(body).map((r) => r.text).join(' ').replace(/\s+/g, ' ').trim();

/* ── keeping a slide re-renderable ───────────────────────────────────────── */

/**
 * The photograph out of the SVG, so the document that draws the words is a
 * few kilobytes rather than a couple of megabytes.
 *
 * Every picture in a slide is inlined as base64 by `kit.image`, which is what
 * makes a body self-contained — and also what makes it too heavy to keep one
 * of per slide. The big ones (the frame the model drew) come out to their own
 * file and leave a token behind; the small ones (an app icon, a creator's
 * logo) are cheaper to leave where they are than to chase.
 */
const HREF_RE = /href="data:image\/(png|jpeg|webp);base64,([^"]+)"/g;
export const ART_TOKEN = (k) => `{{art:${k}}}`;

export function splitArt(body, { min = 64 * 1024 } = {}) {
  const art = [];
  const out = String(body).replace(HREF_RE, (whole, ext, b64) => {
    if (b64.length < min) return whole;
    const k = art.length;
    art.push({ k, ext, buf: Buffer.from(b64, 'base64') });
    return `href="${ART_TOKEN(k)}"`;
  });
  return { body: out, art };
}

/** Put the pictures back, ready to rasterise. `art` is keyed by the same k. */
export function joinArt(body, art) {
  let out = String(body);
  for (const a of art) {
    const mime = a.ext === 'png' ? 'png' : a.ext === 'webp' ? 'webp' : 'jpeg';
    out = out.split(ART_TOKEN(a.k)).join(`data:image/${mime};base64,${a.buf.toString('base64')}`);
  }
  return out;
}

/** Is every picture this body refers to actually here? */
export const artMissing = (body) => [...String(body).matchAll(/\{\{art:(\d+)\}\}/g)].map((m) => Number(m[1]));
