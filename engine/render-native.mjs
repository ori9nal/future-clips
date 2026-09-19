// The native renderer, driven entirely by a campaign spec.
//
// design/apex/native.mjs proved the format; this is that renderer with the
// campaign lifted out of it. Everything specific to APEX — the photos, the
// ranked payload, the handle, the palette — now arrives as data, so a new
// campaign is a JSON file and a folder of pictures, not a new module.
//
// Two styles share the spec:
//   native — full-bleed photography, stroked caption, ranked countdown
//   mascot — brand grounds and a supplied mascot asset, same copy
//
// The format itself is not a choice: the reference sets the gym niche actually
// runs are 9:16 phone photos with CapCut captions on them. A carousel that
// looks designed reads as an ad and gets scrolled.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { loadFace } from './fonts.mjs';
import { fitLines, layoutWidth } from './fit-text.mjs';
import { captionBlock, placementsFor, breakToFit } from './caption.mjs';
import { deslop } from './deslop.mjs';

import { handle as creatorHandle } from './creator.mjs';
export const W = 1080, H = 1920;

// The caption face is the platform's own (TikTok "Classic", a Proxima Nova
// cut) on every reference slide; Figtree is the closest open face. Poppins
// Bold, the previous choice, is rounder and heavier than anything in the
// corpus. Sizes follow: the reference body em is 45–60 px on a 1080 canvas
// and the hook 60–85 — the 104 px hook this file used to allow is twice it.
const FACE = {
  cap:   { file: 'Figtree-SemiBold', family: 'Figtree', weight: 600 },
  body:  { file: 'Figtree-SemiBold', family: 'Figtree', weight: 600 },
  mono:  { file: 'JetBrainsMono-Bold', family: 'JetBrains Mono', weight: 700 },
};
/** SVG stroke-width as a fraction of the em; the visible outline is half (paint-order). */
const STROKE = 0.13;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const R = (x, y, w, h, r, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

function T(kind, x, y, s, { size = 40, fill = '#fff', anchor = 'start', ls = 0, op = 1 } = {}) {
  const f = FACE[kind];
  return `<text x="${x}" y="${y}" font-family="${f.family}" font-weight="${f.weight}" font-size="${size}" ` +
    `fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}">${esc(s)}</text>`;
}

function fontFiles(root) {
  return Object.values(FACE).map((f) => path.join(root, 'assets/fonts', `${f.file}.ttf`));
}

function png(root, body, file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false, defaultFontFamily: 'Figtree', fontFiles: fontFiles(root) },
  }).render().asPng());
  return file;
}

const embed = (f) => {
  const ext = path.extname(f).toLowerCase() === '.png' ? 'png' : 'jpeg';
  return `<image href="data:image/${ext};base64,${fs.readFileSync(f).toString('base64')}" x="0" y="0" width="${W}" height="${H}"/>`;
};

/* ── native style ───────────────────────────────────────────────────────── */

// `strength` is the de-slop pass (engine/deslop.mjs) on the photo before the
// caption goes on; the cache name carries it so a changed knob is not served
// a stale plate. The native reference runs are phone JPEGs, so the default
// is close to the script's full recipe.
async function plate(src, cacheDir, { strength = 0.85, seed = '' } = {}) {
  const out = path.join(cacheDir, `_p${path.basename(src).replace(/\.\w+$/, '')}${strength > 0 ? `-d${Math.round(strength * 100)}` : ''}.png`);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const fitted = await sharp(src).resize(W, H, { fit: 'cover', position: sharp.strategy.attention }).png().toBuffer();
    fs.writeFileSync(out, strength > 0 ? await deslop(fitted, { seed: `${seed}:${path.basename(src)}`, width: W, height: H, strength }) : fitted);
  }
  return out;
}

/**
 * Put a caption in the quietest band of a zone, falling through bands until the
 * copy fits. A fixed y lands on a face the moment the next photo is framed
 * differently — which is every photo.
 */
async function place(plateFile, lines, { zone, max, min, avoid = [] }) {
  const face = loadFace(FACE.cap.file);
  const margin = 64, boxW = W - margin * 2;

  // Fit once to learn how tall the block will actually be, then score windows
  // of THAT height. Scoring fixed bands first and letting the block overflow
  // them put a three-line hook across a face that sat below the quiet strip it
  // had been anchored in.
  let probe = null, use = lines;
  for (const cap of [max, Math.round(max * 0.82), Math.round(max * 0.68)]) {
    try {
      probe = captionBlock(face, use, { x: margin, y: zone[0], w: boxW, h: zone[1] - zone[0] },
        { family: FACE.cap.family, weight: FACE.cap.weight, max: cap, min, strokeRatio: STROKE });
      break;
    } catch { /* smaller */ }
  }
  if (!probe) {
    // Generated copy arrives as sentences, not hand-broken lines, so a CTA can
    // be one string too long for any readable size. Re-break it rather than
    // refuse the set outright.
    use = lines.flatMap((l) => breakToFit(face, l, boxW * 0.92, min * 1.25, { max: 3 }));
    for (const cap of [max, Math.round(max * 0.8), Math.round(max * 0.66)]) {
      try {
        probe = captionBlock(face, use, { x: margin, y: zone[0], w: boxW, h: zone[1] - zone[0] },
          { family: FACE.cap.family, weight: FACE.cap.weight, max: cap, min, strokeRatio: STROKE });
        break;
      } catch { /* smaller */ }
    }
  }
  if (!probe) throw new Error(`caption does not fit the zone at all: ${lines.join(' / ')}`);
  lines = use;

  const blockH = Math.ceil(probe.height + probe.stroke);
  const spots = await placementsFor(plateFile, { w: W, h: H, sharp, zone, blockH, margin, avoid });
  const pool = spots.length ? spots : [{ x: margin, y: zone[0], w: boxW, h: blockH }];
  for (const spot of pool) {
    try {
      const c = captionBlock(face, lines, { x: spot.x, y: spot.y, w: spot.w, h: blockH + 8 },
        { family: FACE.cap.family, weight: FACE.cap.weight, max, min, strokeRatio: STROKE });
      return { ...c, box: { x: spot.x, y: spot.y, w: spot.w, h: c.height }, spot };
    } catch { /* next spot */ }
  }
  throw new Error(`caption fits no placement: ${lines.join(' / ')}`);
}

export async function nativeSlides(spec, root, outDir) {
  const face = loadFace(FACE.cap.file);
  const photoDir = path.join(root, spec.assets?.photos?.dir ?? '.');
  const cache = path.join(outDir, '_plates');
  const C = spec.content;
  const out = [];
  const dopt = { strength: spec.assets?.deslop ?? 0.85, seed: `${spec.id}:${(C.hook?.lines ?? []).join(' ')}` };
  const plateOf = (photo) => plate(path.isAbsolute(String(photo)) ? String(photo) : path.join(photoDir, `${photo}.jpg`), cache, dopt);

  // hook
  {
    const p = await plateOf(C.hook.photo);
    const s = [embed(p)];
    const title = await place(p, C.hook.lines, { zone: [H * 0.08, H * 0.62], max: 70, min: 48 });
    s.push(title.svg);
    if (C.hook.sub?.length) {
      // Directly under the title. Searching for the subline independently
      // floated it down onto the model's face.
      const sub = captionBlock(face, C.hook.sub,
        { x: title.box.x, y: title.box.y + title.height + 14, w: title.box.w, h: 130 },
        { family: FACE.cap.family, weight: FACE.cap.weight, max: 40, min: 28, strokeRatio: STROKE });
      s.push(sub.svg);
    }
    out.push(s.join(''));
  }

  // Numbering is a content decision. A ranked countdown counts DOWN so the
  // swipe pays off at the end; a story runs forwards and numbering it backwards
  // reads as broken. 'none' leaves the headings bare.
  const numbering = C.numbering ?? 'countdown';
  for (let i = 0; i < C.ranked.length; i++) {
    const item = C.ranked[i];
    const rank = numbering === 'countdown' ? C.ranked.length - i : i + 1;
    // A campaign can require the app to appear mid-set rather than at the end
    // (TradeLens: slide 4 or 5 on a 7+ slide post), so a ranked item may carry
    // its own screen instead of a photo.
    // The app slide: the screenshot photographed on a phone when a frame was
    // generated from it (engine/art.mjs appFrame); the raw screen otherwise.
    const appPhoto = item.screen && item.photo && path.isAbsolute(String(item.photo)) && fs.existsSync(String(item.photo)) ? String(item.photo) : null;
    const rawScreen = !!item.screen && !appPhoto;
    const p = appPhoto
      ? await plateOf(appPhoto)
      : item.screen
        ? path.join(root, item.screen)
        // a generated frame arrives as an absolute path; a sourced one as an id
        : await plateOf(item.photo);
    const s = [embed(p)];
    // An app screenshot is dense UI everywhere, so the band-quietness solver
    // has no genuinely quiet band to find — white stroked type landed straight
    // across the levels rows. Reserve two bands with a scrim instead.
    if (rawScreen) {
      s.push(`<defs><linearGradient id="ap${i}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="rgba(0,0,0,0.88)"/><stop offset="1" stop-color="rgba(0,0,0,0)"/>` +
        `</linearGradient></defs><rect x="0" y="0" width="${W}" height="${Math.round(H * 0.30)}" fill="url(#ap${i})"/>`);
      // near-solid under the copy band. A soft fade is not enough over a levels
      // table: at the top of the fade the scrim is barely a third of its value,
      // which is exactly where the first line of body copy sits.
      s.push(`<defs><linearGradient id="ab${i}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="rgba(0,0,0,0)"/>` +
        `<stop offset="0.22" stop-color="rgba(0,0,0,0.82)"/>` +
        `<stop offset="1" stop-color="rgba(0,0,0,0.94)"/>` +
        `</linearGradient></defs><rect x="0" y="${Math.round(H * 0.62)}" width="${W}" height="${Math.round(H * 0.38)}" fill="url(#ab${i})"/>`);
    }
    const head = [numbering === 'none' ? item.name : `${rank}. ${item.name}`];
    if (item.score) head.push(item.score);
    const title = await place(p, head, {
      zone: rawScreen ? [H * 0.03, H * 0.22] : appPhoto ? [H * 0.04, H * 0.20] : [H * 0.12, H * 0.56], max: 56, min: 40,
    });
    s.push(title.svg);
    const body = await place(p, item.lines, {
      zone: rawScreen
        ? [H * 0.72, H * 0.95]
        : appPhoto
          ? [title.box.y + title.height + 16, H * 0.40]
          : [Math.max(title.box.y + title.height + 40, H * 0.56), H * 0.92],
      max: 46, min: 32, avoid: [title.box],
    });
    s.push(body.svg);
    out.push(s.join(''));
  }

  // payload: the app's own screen, full bleed, if the campaign has one — or
  // the phone-on-a-bench frame generated from it, which is what the
  // reference closers are
  const closerAppPhoto = C.closer.screen && C.closer.photo && path.isAbsolute(String(C.closer.photo)) && fs.existsSync(String(C.closer.photo)) ? String(C.closer.photo) : null;
  if (closerAppPhoto) {
    const p = await plateOf(closerAppPhoto);
    const s = [embed(p)];
    const c = await place(p, C.closer.lines, { zone: [H * 0.04, H * 0.30], max: 56, min: 38 });
    s.push(c.svg);
    const cta = await place(p, [C.closer.cta], { zone: [c.box.y + c.height + 16, H * 0.46], max: 44, min: 30, avoid: [c.box] });
    s.push(cta.svg);
    out.push(s.join(''));
  } else if (C.closer.screen) {
    const screen = path.join(root, C.closer.screen);
    const s = [embed(screen)];
    const c = await place(screen, C.closer.lines, { zone: [H * 0.76, H * 0.94], max: 48, min: 32 });
    s.push(c.svg);
    const cta = captionBlock(face, [C.closer.cta],
      { x: 90, y: c.box.y + c.height + 16, w: W - 180, h: 110 },
      { family: FACE.cap.family, weight: FACE.cap.weight, max: 40, min: 28, strokeRatio: STROKE });
    s.push(cta.svg);
    out.push(s.join(''));
  } else {
    const p = await plateOf(C.closer.photo);
    const s = [embed(p)];
    const c = await place(p, C.closer.lines, { zone: [H * 0.12, H * 0.58], max: 60, min: 40 });
    s.push(c.svg);
    const cta = await place(p, [C.closer.cta], {
      zone: [Math.max(c.box.y + c.height + 40, H * 0.60), H * 0.92], max: 46, min: 30, avoid: [c.box],
    });
    s.push(cta.svg);
    out.push(s.join(''));
  }


  return out;
}

/* ── mascot style ───────────────────────────────────────────────────────── */

function stack(kind, lines, box, o = {}) {
  const face = loadFace(FACE[kind].file);
  const fit = fitLines(face, lines, box, { min: 26, max: o.max ?? 130, lineHeight: 1.02, tracking: -0.01, autoLeading: true });
  if (!fit) throw new Error(`headline does not fit: ${lines.join(' / ')}`);
  const lh = fit.lineHeight ?? 1.02;
  let out = '', y = box.y + fit.size * (face.capHeight / face.upm);
  for (const l of fit.lines) {
    out += T(kind, box.x, Math.round(y), l, { size: fit.size, fill: o.fill, ls: fit.trackingPx });
    y += fit.size * lh;
  }
  return { svg: out, size: fit.size, bottom: y - fit.size * lh + fit.size * 0.3 };
}

/** Bubble sized to its text — clamping the bubble instead ran type out the side. */
function speech(x, y, maxW, lines, { tail = 'left', bone, ink }) {
  const face = loadFace(FACE.body.file);
  const pad = 34;
  const fit = fitLines(face, lines, { x, y, w: maxW - pad * 2, h: 900 },
    { min: 24, max: 42, lineHeight: 1.3, tracking: 0, autoLeading: true });
  if (!fit) throw new Error(`speech does not fit: ${lines.join(' / ')}`);
  const lh = fit.lineHeight ?? 1.3;
  const widest = Math.max(...fit.lines.map((l) => layoutWidth(face, l, fit.size)));
  const bw = Math.round(widest + pad * 2), bh = Math.round(fit.lines.length * fit.size * lh + pad * 1.5);
  let s = R(x, y, bw, bh, 34, bone);
  const tx = tail === 'left' ? x + 66 : x + bw - 66;
  s += `<path d="M ${tx - 24} ${y + bh - 2} L ${tx + 24} ${y + bh - 2} L ${tx + (tail === 'left' ? 4 : -4)} ${y + bh + 36} Z" fill="${bone}"/>`;
  let ty = y + pad + fit.size * (face.capHeight / face.upm);
  for (const l of fit.lines) { s += T('body', x + pad, Math.round(ty), l, { size: fit.size, fill: ink }); ty += fit.size * lh; }
  return { svg: s, width: bw, bottom: y + bh + 36 };
}

function mascotImg(file, x, y, w, { flip = false } = {}) {
  const g = flip ? ` transform="translate(${2 * x + w} 0) scale(-1 1)"` : '';
  return `<g${g}><image href="data:image/png;base64,${fs.readFileSync(file).toString('base64')}" ` +
    `x="${x}" y="${y}" width="${w}" height="${w}" preserveAspectRatio="xMidYMid meet"/></g>`;
}

export function mascotSlides(spec, root) {
  const [INK, ACCENT, BONE] = spec.assets.palette;
  const M = path.join(root, spec.assets.mascot);
  if (!fs.existsSync(M)) throw new Error(`mascot asset missing: ${spec.assets.mascot}`);
  const C = spec.content, out = [];
  const handle = creatorHandle(spec) ?? '';

  // cover
  {
    const s = [R(0, 0, W, H, 0, ACCENT), R(0, 0, W, 26, 0, INK)];
    s.push(T('mono', 54, 130, `${spec.brand} — ${spec.product.toUpperCase()}`, { size: 26, fill: INK, ls: 5 }));
    const head = stack('cap', C.hook.lines, { x: 54, y: 180, w: 972, h: 560 }, { max: 132, fill: INK });
    s.push(head.svg);
    s.push(R(54, head.bottom + 26, 200, 12, 6, INK));
    if (C.hook.sub?.length) s.push(T('body', 54, head.bottom + 116, C.hook.sub[0], { size: 46, fill: INK, op: 0.78 }));
    s.push(mascotImg(M, 150, H - 900, 800));
    s.push(T('mono', 54, H - 60, handle, { size: 28, fill: INK, op: 0.7 }));
    out.push(s.join(''));
  }

  C.ranked.forEach((item, i) => {
    const rank = C.ranked.length - i;
    const s = [R(0, 0, W, H, 0, INK), R(0, 0, W, 26, 0, ACCENT)];
    s.push(T('cap', W - 40, 300, String(rank), { size: 380, fill: ACCENT, anchor: 'end', op: 0.16 }));
    s.push(T('mono', 54, 130, `RANK ${rank} OF ${C.ranked.length}`, { size: 26, fill: ACCENT, ls: 5 }));
    const words = item.name.toUpperCase().split(' ');
    const lines = words.length > 2 ? [words.slice(0, 2).join(' '), words.slice(2).join(' ')] : [words.join(' ')];
    const head = stack('cap', lines, { x: 54, y: 186, w: 972, h: 300 }, { max: 116, fill: BONE });
    s.push(head.svg);
    if (item.score) {
      s.push(R(54, head.bottom + 24, 210, 86, 43, ACCENT));
      s.push(T('cap', 159, head.bottom + 84, item.score, { size: 48, fill: INK, anchor: 'middle' }));
    }
    // alternate the side so the ranked slides do not read as one slide repeated
    const flip = i % 2 === 1;
    s.push(speech(flip ? 300 : 60, 700, 720, item.lines, { tail: flip ? 'left' : 'right', bone: BONE, ink: INK }).svg);
    s.push(mascotImg(M, flip ? 20 : W - 620, H - 780, 600, { flip }));
    s.push(T('mono', 54, H - 60, handle, { size: 28, fill: BONE, op: 0.55 }));
    out.push(s.join(''));
  });

  // closer
  {
    const s = [R(0, 0, W, H, 0, BONE), R(0, 0, W, 26, 0, ACCENT)];
    const head = stack('cap', C.closer.lines, { x: 54, y: 170, w: 972, h: 520 }, { max: 150, fill: INK });
    s.push(head.svg);
    s.push(mascotImg(M, 240, 800, 620));
    s.push(R(54, H - 300, 972, 130, 65, INK));
    s.push(T('cap', W / 2, H - 212, C.closer.cta, { size: 50, fill: ACCENT, anchor: 'middle' }));
    out.push(s.join(''));
  }
  return out;
}

/* ── entry point ────────────────────────────────────────────────────────── */

/**
 * @param {object} o
 * @param {object} o.spec   campaign JSON (campaigns/*.json)
 * @param {string} o.root   repo root
 * @param {string} o.style  'native' | 'mascot'
 * @param {string} o.outDir where slides are written
 */
export async function renderCampaign({ spec, root, style = 'native', outDir }) {
  const bodies = style === 'mascot' ? mascotSlides(spec, root) : await nativeSlides(spec, root, outDir);
  return bodies.map((b, i) => png(root, b, path.join(outDir, `slide-${i + 1}.png`)));
}

/** Copy in the shape engine/judge.mjs logicCheck() consumes. */
export function copyOf(spec) {
  const C = spec.content;
  return {
    campaign: { rules: spec.rules, ...spec.requirements },
    slides: [
      { headline: C.hook.lines.join(' '), body: (C.hook.sub || []).join(' ') },
      ...C.ranked.map((r, i) => ({
        headline: `${C.ranked.length - i}. ${r.name}${r.score ? ' ' + r.score : ''}`,
        body: r.lines.join(' '),
      })),
      { headline: C.closer.lines.join(' '), body: C.closer.cta },
    ],
  };
}

/** Silent font fallback renders at a width the fitter never approved. */
export async function preflightFonts(root, tolerance = 0.05) {
  const probe = 'HAMBURGEFONSTIV 1234';
  const bad = [];
  for (const [kind, f] of Object.entries(FACE)) {
    const expected = layoutWidth(loadFace(f.file), probe, 100);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="300"><rect width="4000" height="300" fill="#fff"/>` +
      `<text x="20" y="200" font-family="${f.family}" font-weight="${f.weight}" font-size="100" fill="#000">${probe}</text></svg>`;
    const buf = new Resvg(svg, { font: { loadSystemFonts: false, defaultFontFamily: 'Figtree', fontFiles: fontFiles(root) } }).render().asPng();
    const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    let minX = info.width, maxX = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[y * info.width + x] < 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
    const drift = Math.abs((maxX - minX) - expected) / expected;
    if (drift > tolerance) bad.push(`${kind}: "${f.family}" ${f.weight} off by ${(drift * 100).toFixed(0)}%`);
  }
  if (bad.length) throw new Error('font fallback detected:\n  ' + bad.join('\n  '));
}
