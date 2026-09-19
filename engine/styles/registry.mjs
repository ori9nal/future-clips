// The style registry, and the niche → style map.
//
// A niche does not get ONE look. The reference library runs several different
// styles inside the same niche — folder 11 sells fitness as a whitepaper, 15
// sells it as a phone photo, 1 sells it as an illustrated character — and they
// all work, because they are aimed at different readers. So the map returns a
// ranked list, not an answer, and the studio lets a human pick.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { assertClean, inspectPng } from '../clean.mjs';
import sharp from 'sharp';
import { fontFiles } from './kit.mjs';
import { signOff } from '../creator.mjs';
import { applyEdits, readBlocks, splitArt, joinArt, artMissing } from '../layout.mjs';

import clinical from './clinical.mjs';
import editorial from './editorial.mjs';
import documentStyle from './document.mjs';
import poster from './poster.mjs';
import pastel from './pastel.mjs';
import nativeStyle from './native.mjs';
import mascot from './mascot.mjs';
import bedrock from './bedrock.mjs';
import rail from './rail.mjs';
import feed from './feed.mjs';

export const STYLES = [feed, nativeStyle, mascot, bedrock, rail, clinical, editorial, documentStyle, poster, pastel];

// What a customer may choose. Editorial and Mascot were retired by the owner
// and Clinical with them (2026-09-19): they stay above so a set already
// rendered in one still opens,
// and byId() still finds them, but nothing offers them any more.
export const RETIRED = new Set(['editorial', 'mascot', 'clinical']);
export const pickable = () => STYLES.filter((s) => !RETIRED.has(s.id));

export const byId = (id) => STYLES.find((s) => s.id === id) ?? null;

/**
 * Styles that suit a niche, best first.
 *
 * Scoring is deliberately blunt: an exact niche match outranks a family match,
 * and every style stays available at the bottom of the list. A style that is
 * merely unusual for a niche is often the reason a set gets noticed, so this
 * ranks rather than filters.
 */
export function stylesFor(niche) {
  const n = String(niche || '').toLowerCase().trim();
  const family = {
    fitness: ['fitness', 'gym', 'health', 'supplements', 'longevity', 'nutrition'],
    money: ['finance', 'personal finance', 'business', 'money', 'investing'],
    beauty: ['beauty', 'skincare', 'lifestyle', 'wellness'],
    growth: ['marketing', 'design', 'creator', 'social media', 'agency', 'productivity'],
    mind: ['mindset', 'self-improvement', 'running'],
  };
  const famOf = (x) => Object.entries(family).find(([, list]) => list.includes(x))?.[0];
  const myFam = famOf(n);

  return pickable().map((s) => {
    let score = 0;
    if (s.niches.includes(n)) score += 100;
    if (myFam && s.niches.some((x) => famOf(x) === myFam)) score += 40;
    return { style: s, score };
  }).sort((a, b) => b.score - a.score || a.style.id.localeCompare(b.style.id))
    .map(({ style, score }) => ({
      id: style.id, label: style.label, blurb: style.blurb,
      canvas: style.canvas, fit: score >= 100 ? 'native' : score >= 40 ? 'adjacent' : 'stretch',
    }));
}

/* ── one slide, drawn from its SVG ───────────────────────────────────────── */

const wrap = (body, w, h) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const rasterise = (svg, w, fonts) => new Resvg(svg, {
  fitTo: { mode: 'width', value: w },
  font: { loadSystemFonts: false, defaultFontFamily: 'Archivo', fontFiles: fonts },
}).render().asPng();

/**
 * A picture, small enough to keep a copy of per slide.
 *
 * A full-canvas frame is a 1.5 MB PNG, and every set would carry one per
 * slide on top of the slides themselves. Opaque pictures become JPEG, which
 * is a tenth of that and which resvg reads back just as happily; anything
 * with transparency (a cut-out figure, an icon) keeps its alpha and is small
 * already. The frame has been through deslop's own JPEG pass by this point,
 * so the extra encode is not a visible loss.
 */
async function keepable(a) {
  if (a.ext !== 'png') return a;
  try {
    const img = sharp(a.buf);
    if ((await img.metadata()).hasAlpha) return a;
    return { ...a, ext: 'jpeg', buf: await img.jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer() };
  } catch { return a; }
}

/** What the editor is shown: the words, the box, and nothing about the SVG. */
const publicBlock = (b) => ({ id: b.id, lines: b.lines, box: b.box, size: b.size, anchor: b.anchor, fill: b.fill });

/**
 * Draw one slide again from the pieces `render` kept, with the customer's
 * edits applied. No model call, no photograph processed — the picture is the
 * one already drawn, and only the type is laid out again.
 *
 * @param {object} o
 * @param {string} o.body   the light SVG body (`slide-N.svg`)
 * @param {{k:number,ext:string,buf:Buffer}[]} o.art  its pictures
 * @param {object} o.edits  `{ b0: { lines, dx, dy }, … }`
 * @param {{w:number,h:number}} o.canvas
 * @returns {{ png: Buffer, blocks: object[], body: string }}
 */
export function rerenderSlide({ body, art = [], edits, canvas, root }) {
  const { w, h } = canvas;
  const edited = applyEdits(body, edits, { root, canvasW: w });
  const missing = artMissing(edited).filter((k) => !art.some((a) => a.k === k));
  if (missing.length) throw new Error(`slide is missing its picture${missing.length > 1 ? 's' : ''} (${missing.join(', ')})`);
  const png = rasterise(wrap(joinArt(edited, art), w, h), w, fontFiles(root));
  // the same gate every first render passes: pixels only, nothing else
  const clean = inspectPng(png);
  if (!clean.clean) throw new Error(`metadata gate: the edited slide carries ${clean.offending.map((o) => o.chunk).join(', ')}`);
  return { png, blocks: readBlocks(edited, { root }).map(publicBlock), body: edited };
}

/** Render one campaign in one style. */
export async function render({ spec, root, styleId, outDir, cacheDir, edits }) {
  const style = byId(styleId);
  if (!style) throw new Error(`unknown style "${styleId}"`);
  // a style may size its canvas per campaign (feed: 9:16 for the families
  // whose references are all 9:16, 4:5 for the gym and trading families)
  const { w, h } = style.canvasFor?.(spec) ?? style.canvas;
  fs.mkdirSync(outDir, { recursive: true });
  // A shorter set rendered over a longer one leaves the old tail behind, and a
  // stale slide-7 then ships with a six-slide post. Clear the slides first.
  for (const f of fs.readdirSync(outDir)) {
    if (/^slide-\d+\.png$/.test(f)) fs.unlinkSync(path.join(outDir, f));
  }

  const ctx = {
    root, sharp, outDir,
    // a style that generates its own art (bedrock's figures) caches into the same
    // content-addressed frame cache as the lanes; the host passes /tmp, a laptop output/
    cacheDir: cacheDir ?? path.join(root, 'output/gen/cache'),
    photoDir: spec.assets?.photos?.dir ? path.join(root, spec.assets.photos.dir) : null,
  };
  const bodies = await style.slides(spec, ctx);

  // The person posting it signs the last slide: the avatar or logo their
  // workspace uploaded, and their own handle (migration 0020). One place, so
  // all ten styles sign a deck alike; empty string when nothing was uploaded,
  // which leaves every existing set byte for byte as it was.
  if (bodies.length) {
    const sign = signOff(spec, w, h, { nameAlready: !!style.printsHandle, at: style.markAt?.(w, h) ?? null });
    if (sign) bodies[bodies.length - 1] += sign;
  }

  const files = [];
  const fonts = fontFiles(root);
  // What the words are and where they sit, plus a copy of each slide light
  // enough to keep: the picture comes out to its own file and the document
  // that draws the type stays a few kilobytes. Together they are everything
  // needed to move a line or rewrite it later without drawing anything again
  // (`rerenderSlide`). Editing is a feature of the product, so this is kept
  // for every set, not only the ones somebody opens.
  const layout = [];
  for (let i = 0; i < bodies.length; i++) {
    const n = i + 1;
    const edited = applyEdits(bodies[i], edits?.[n] ?? edits?.[String(n)], { root, canvasW: w });
    const file = path.join(outDir, `slide-${n}.png`);
    fs.writeFileSync(file, rasterise(wrap(edited, w, h), w, fonts));
    files.push(file);
    const { body: light, art } = splitArt(edited);
    fs.writeFileSync(path.join(outDir, `slide-${n}.svg`), light);
    for (const a of art) {
      const k = await keepable(a);
      fs.writeFileSync(path.join(outDir, `slide-${n}.art-${a.k}.${k.ext}`), k.buf);
    }
    layout.push({ slide: n, canvas: { w, h }, art: art.length, blocks: readBlocks(edited, { root }).map(publicBlock) });
  }
  // Pixels only: no C2PA manifest, no EXIF, no text chunks. Throws if a
  // renderer ever starts leaking provider metadata into a slide.
  assertClean(files);
  return { files, canvas: { w, h }, style: style.id, artUsd: ctx.artUsd ?? 0, layout };
}
