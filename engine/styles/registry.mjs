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
import { assertClean } from '../clean.mjs';
import sharp from 'sharp';
import { fontFiles } from './kit.mjs';

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

  return STYLES.map((s) => {
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

/** Render one campaign in one style. */
export async function render({ spec, root, styleId, outDir, cacheDir }) {
  const style = byId(styleId);
  if (!style) throw new Error(`unknown style "${styleId}"`);
  const { w, h } = style.canvas;
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

  const files = [];
  const fonts = fontFiles(root);
  bodies.forEach((body, i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
    const file = path.join(outDir, `slide-${i + 1}.png`);
    fs.writeFileSync(file, new Resvg(svg, {
      fitTo: { mode: 'width', value: w },
      font: { loadSystemFonts: false, defaultFontFamily: 'Archivo', fontFiles: fonts },
    }).render().asPng());
    files.push(file);
  });
  // Pixels only: no C2PA manifest, no EXIF, no text chunks. Throws if a
  // renderer ever starts leaking provider metadata into a slide.
  assertClean(files);
  return { files, canvas: style.canvas, style: style.id, artUsd: ctx.artUsd ?? 0 };
}
