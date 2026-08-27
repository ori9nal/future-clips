// The generator. One entry point: renderCarousel().
//
// Divergence -> copy -> layout (fit + collide) -> four composited layers -> PNG.
// A layout failure is never papered over: it triggers a copy regeneration with
// shorter text, and only a genuinely unsatisfiable spec reaches the caller as an
// error. Nothing here knows what "F2" is — families are JSON.
import fs from 'node:fs';
import path from 'node:path';
import { h32, rng as makeRng, fingerprint } from './seed.mjs';
import { BRAND, ACCENTS, makePalette } from './palette.mjs';
import { buildCopy } from './copy.mjs';
import { layoutSlide, layoutFurniture, safeBox } from './layout.mjs';
import { renderVectorLayer } from './render-type.mjs';
import { renderBackground, prepareSubject, composeSlide, assertAssetAllowed } from './compose.mjs';
import { validateCarousel } from './validate.mjs';
import { isProcedural, renderProcedural } from './subjects.mjs';
import sharp from 'sharp';

/** Real painted extent of an RGBA layer — used to verify fitText against pixels. */
async function inkBBox(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * c + 3] > 16) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const TEMPLATE_DIR = 'templates';
const SUBJECT_DIR = 'assets/inhouse-only/subjects';

export function loadTemplates(dir = TEMPLATE_DIR) {
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * hash(account, campaign, index) selects every structural axis.
 *
 * Family and accent are STRATIFIED, not sampled. Independent draws gave round 2
 * six CUTOUT-SPORT carousels out of ten and never once picked F1 or F3 — which is
 * both a bad test and bad product behaviour, since an account would be posting
 * the same layout six times running. A seeded permutation of the family list,
 * walked by post index, guarantees every family appears before any repeats.
 */
export function diverge({ accountId, campaignId, postIndex, templates }) {
  const seed = h32(accountId, '|', campaignId, '|', postIndex);
  const r = makeRng(seed);

  const cycle = Math.floor(postIndex / templates.length);
  const famOrder = makeRng(h32(accountId, campaignId, 'family', cycle)).shuffle(templates);
  const tpl = famOrder[postIndex % templates.length];

  const accCycle = Math.floor(postIndex / ACCENTS.length);
  const accOrder = makeRng(h32(accountId, campaignId, 'accent', accCycle)).shuffle(ACCENTS);
  const accentKey = accOrder[postIndex % ACCENTS.length];
  const slideCount = r.range(tpl.slideCount?.[0] ?? 6, tpl.slideCount?.[1] ?? 10);
  const hookType = r.pick(tpl.hookTypes);
  const cropStrategy = r.pick(tpl.cropStrategies ?? ['contain']);
  return { seed, rng: r, tpl, accentKey, slideCount, hookType, cropStrategy };
}

function subjectSpecFor(roleSpec, rng, cropStrategy, palette, slideIndex = 0, rotateOffset = 0) {
  const s = roleSpec.subject;
  if (!s) return null;
  // Rotating the pool by slide index guarantees no two consecutive slides reuse
  // the same object; random picks from a 5-item pool collide roughly 1 slide in 5.
  const id = s.pool
    ? (s.rotate === false ? s.pool[rng.int(s.pool.length)]
       : s.pool[(rotateOffset + slideIndex) % s.pool.length])
    : s.id;
  if (!id) return null;
  if (isProcedural(id)) return { ...s, id, proceduralId: id, fit: cropStrategy, heightPct: s.heightPct ?? 0.5 };
  const file = path.join(SUBJECT_DIR, `${id}.png`);
  if (!fs.existsSync(file)) throw new Error(`subject "${id}" not found in ${SUBJECT_DIR}`);
  return { ...s, id, src: file, fit: cropStrategy, heightPct: s.heightPct ?? 0.5 };
}

/**
 * Interiors rotate through the template's declared body variants. Round 1's
 * biggest vision cost was that every interior slide was the same skeleton with
 * different words; the corpus never does that. Variant choice is positional, so
 * a set reads as a rhythm rather than as a random shuffle.
 */
export function roleFor(tpl, slide, slideIndex) {
  if (slide.role !== 'body') return slide.role;
  const variants = tpl.bodyVariants;
  if (!variants || variants.length < 2) return 'body';
  const pick = variants[(slideIndex - 1) % variants.length];
  return tpl.roles[pick] ? pick : 'body';
}

async function renderSlide({ tpl, slide, slideIndex, slideCount, palette, outFile, rngSlide, cropStrategy, rotateOffset }) {
  const role = roleFor(tpl, slide, slideIndex);
  const roleSpec = tpl.roles[role];
  const canvas = tpl.canvas;

  const laid = layoutSlide({ tpl, role, content: slide, palette, canvas });
  if (!laid.ok) return { ok: false, ...laid };

  // subject placement, including the declared overlap with a named type slot
  let subject = null;
  const sSpec = subjectSpecFor(roleSpec, rngSlide, cropStrategy, palette, slideIndex, rotateOffset);
  if (sSpec) {
    const ctx = { canvas, rng: rngSlide, ...palette, plate: null };
    if (sSpec.proceduralId) sSpec.procedural = renderProcedural(sSpec.proceduralId, palette);
    subject = await prepareSubject(sSpec, ctx);
    if (subject && sSpec.overlapSlot) {
      const target = laid.rects.find((r) => r.id === sSpec.overlapSlot);
      if (target) {
        // overlapEdge "bottom" (default): subject sits below the slot, its top
        // edge crossing up into the type. "top": subject sits above the slot,
        // its FOOT crossing down into the type — the folder-13 shoe-on-the-baseline move.
        const desiredY = sSpec.overlapEdge === 'top'
          ? target.y + (sSpec.overlapPx ?? 40) - subject.rect.h
          : target.y + target.h - (sSpec.overlapPx ?? 40);
        subject.rect.y = Math.round(desiredY);
        if (sSpec.clampBottom !== false && sSpec.overlapEdge !== 'top') {
          // never float: keep the contact edge at or below the canvas foot
          subject.rect.y = Math.min(subject.rect.y, canvas.h - subject.rect.h + (sSpec.bleed ?? 0));
        }
      }
    }
  }

  const furniture = layoutFurniture({
    tpl, role: slide.role, slideIndex, slideCount, palette, brand: BRAND,
  });

  const bgCtx = { canvas, rng: rngSlide, ...palette, plate: null };
  const bgSpec = { ...roleSpec.background };
  if (bgSpec.type === 'photo' && bgSpec.pool) {
    bgSpec.src = path.join('assets/inhouse-only/plates', bgSpec.pool[rngSlide.int(bgSpec.pool.length)]);
  }
  bgCtx.plate = bgSpec.type === 'flat' ? bgSpec.fill : 'paper';
  const background = await renderBackground(bgSpec, bgCtx);

  const typeLayer = (await renderVectorLayer({
    width: canvas.w, height: canvas.h, blocks: laid.blocks, shapes: laid.shapes,
  })).png;
  // empirical proof that the model matched the render: the type layer's real ink
  // bbox, which the gauntlet compares against the safe box independently
  const typeInk = await inkBBox(typeLayer);
  const furnitureLayer = (await renderVectorLayer({
    width: canvas.w, height: canvas.h, blocks: furniture.blocks, shapes: furniture.shapes,
  })).png;

  await composeSlide({ background, subject, typeLayer, furnitureLayer, canvas, out: outFile });

  return {
    ok: true,
    file: outFile,
    rects: laid.rects,
    subjectRect: subject?.rect ?? null,
    subjectId: sSpec?.id ?? null,
    typeInk,
    variant: role,
    renderedWords: laid.renderedWords,
    furnitureCount: furniture.blocks.length,
    fittedSizes: Object.fromEntries(laid.blocks.map((b) => [b.id, b.fit.size])),
  };
}

/**
 * @returns manifest { id, files, fingerprint, ... } — or throws if the spec cannot
 * be satisfied after every regeneration attempt.
 */
export async function renderCarousel({
  accountId = 'drift', campaignId = 'why-not-what', postIndex = 0,
  outDir = 'output/run', templates = loadTemplates(), maxRetries = 5,
}) {
  const d = diverge({ accountId, campaignId, postIndex, templates });
  const palette = makePalette(d.accentKey);
  const id = `${d.tpl.id.split('-')[0]}-p${String(postIndex).padStart(2, '0')}-${d.accentKey.slice(-1)}`;
  const dir = path.join(outDir, id);

  let attempt = 0, copy = null, failures = [];
  for (; attempt <= maxRetries; attempt++) {
    const rCopy = makeRng(d.seed + attempt * 7919);
    copy = buildCopy(rCopy, { slideCount: d.slideCount, hookType: d.hookType, shorten: attempt });

    // dry-run every slide's layout before rendering a single pixel
    const dry = copy.slides.map((slide, i) =>
      layoutSlide({ tpl: d.tpl, role: roleFor(d.tpl, slide, i), content: slide, palette, canvas: d.tpl.canvas })
    );
    const bad = dry.map((r, i) => ({ r, i })).filter((x) => !x.r.ok);
    if (!bad.length) break;
    failures = bad.map((x) => ({ slide: x.i + 1, ...x.r }));
    if (attempt === maxRetries) {
      const e = new Error(
        `${d.tpl.id} post ${postIndex}: layout unsatisfiable after ${maxRetries + 1} copy regenerations — ` +
        failures.map((f) => `s${f.slide}:${f.reason}(${f.slot})`).join(', ')
      );
      e.failures = failures;
      throw e;
    }
  }

  fs.mkdirSync(dir, { recursive: true });
  const rotateOffset = makeRng(d.seed ^ 0x5bd1e995).int(97);
  const files = [];
  const slideMeta = [];
  for (let i = 0; i < copy.slides.length; i++) {
    const slide = copy.slides[i];
    const outFile = path.join(dir, `${String(i + 1).padStart(2, '0')}.png`);
    const rngSlide = makeRng(d.seed + i * 104729);
    const r = await renderSlide({
      tpl: d.tpl, slide, slideIndex: i, slideCount: copy.slides.length,
      palette, outFile, rngSlide, cropStrategy: d.cropStrategy, rotateOffset,
    });
    if (!r.ok) throw new Error(`render failed on slide ${i + 1}: ${r.reason} (${r.slot})`);
    files.push(outFile);
    slideMeta.push({ index: i, role: slide.role, ...r });
  }

  const furnitureByRole = Object.fromEntries(
    Object.keys(d.tpl.roles).map((role) => [
      role, (d.tpl.furniture || []).filter((f) => !f.on || f.on.includes(role)),
    ])
  );
  const carousel = {
    id, dir, files,
    accountId, campaignId, postIndex,
    seed: d.seed, family: d.tpl.id, familyName: d.tpl.name,
    accentKey: d.accentKey, accent: palette.accent,
    hookType: copy.hookType, slides: copy.slides, canvas: d.tpl.canvas,
    tpl: d.tpl, furnitureByRole, cropStrategy: d.cropStrategy,
    copyAttempts: attempt, slideMeta,
    fingerprint: fingerprint({
      family: d.tpl.id, slideCount: copy.slides.length,
      hookType: copy.hookType, accent: d.accentKey,
    }),
  };
  carousel.validation = validateCarousel(carousel);

  const { tpl, ...serialisable } = carousel;
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(serialisable, null, 2));
  return carousel;
}

export { assertAssetAllowed, safeBox };
