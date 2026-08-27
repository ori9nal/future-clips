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

/** hash(account, campaign, index) selects every structural axis. */
export function diverge({ accountId, campaignId, postIndex, templates }) {
  const seed = h32(accountId, '|', campaignId, '|', postIndex);
  const r = makeRng(seed);
  const tpl = templates[r.int(templates.length)];
  const accentKey = ACCENTS[r.int(ACCENTS.length)];
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
  const file = path.join(SUBJECT_DIR, `${id}.png`);
  if (!fs.existsSync(file)) throw new Error(`subject "${id}" not found in ${SUBJECT_DIR}`);
  return {
    ...s,
    id,
    src: file,
    fit: cropStrategy,
    heightPct: s.heightPct ?? 0.5,
  };
}

async function renderSlide({ tpl, slide, slideIndex, slideCount, palette, outFile, rngSlide, cropStrategy, rotateOffset }) {
  const roleSpec = tpl.roles[slide.role];
  const canvas = tpl.canvas;

  const laid = layoutSlide({ tpl, role: slide.role, content: slide, palette, canvas });
  if (!laid.ok) return { ok: false, ...laid };

  // subject placement, including the declared overlap with a named type slot
  let subject = null;
  const sSpec = subjectSpecFor(roleSpec, rngSlide, cropStrategy, palette, slideIndex, rotateOffset);
  if (sSpec) {
    const ctx = { canvas, rng: rngSlide, ...palette, plate: null };
    subject = await prepareSubject(sSpec, ctx);
    if (subject && sSpec.overlapSlot) {
      const target = laid.rects.find((r) => r.id === sSpec.overlapSlot);
      if (target) {
        const desiredY = target.y + target.h - (sSpec.overlapPx ?? 40);
        subject.rect.y = Math.round(desiredY);
        if (sSpec.clampBottom !== false) {
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
    const dry = copy.slides.map((slide) =>
      layoutSlide({ tpl: d.tpl, role: slide.role, content: slide, palette, canvas: d.tpl.canvas })
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
