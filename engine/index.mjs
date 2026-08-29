// The generator. One entry point: renderCarousel().
//
// Divergence -> copy -> layout (fit + collide) -> four composited layers -> PNG.
// A layout failure is never papered over: it triggers a copy regeneration with
// shorter text, and only a genuinely unsatisfiable spec reaches the caller as an
// error. Nothing here knows what "F2" is — families are JSON.
import fs from 'node:fs';
import path from 'node:path';
import { h32, rng as makeRng, fingerprint } from './seed.mjs';
import { BRAND, ACCENTS, makePalette, makePaletteFrom, accentKeysOf } from './palette.mjs';
import { buildCopy } from './copy.mjs';
import { conceptToSlides } from './concept.mjs';
import { layoutSlide, layoutFurniture, safeBox, coverage } from './layout.mjs';
import { renderVectorLayer } from './render-type.mjs';
import { renderBackground, prepareSubject, composeSlide, assertAssetAllowed } from './compose.mjs';
import { validateCarousel } from './validate.mjs';
import { isProcedural, renderProcedural, shapeClassOf } from './subjects.mjs';
import { pickSubject } from './match.mjs';
import { buildCards } from './cards.mjs';
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
const LIBRARY_DIR = 'assets/library';

// Per-niche cutout libraries, loaded once per process. These are real matted
// photographs with attribution, built by tools/build-library.mjs — the thing
// that replaced procedural silhouettes.
const _libCache = new Map();
export function loadLibrary(niche, kind) {
  const key = `${niche}/${kind}`;
  if (_libCache.has(key)) return _libCache.get(key);
  const f = path.join(LIBRARY_DIR, niche, `${kind}.json`);
  if (!fs.existsSync(f)) throw new Error(`cutout library missing: ${f} — run tools/build-library.mjs --niche ${niche} --kind ${kind}`);
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!m.items?.length) throw new Error(`cutout library ${f} is empty`);
  _libCache.set(key, m);
  return m;
}

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
  // Hooks are stratified for the same reason families are: two posts sharing
  // family + slide count + hook + accent produce an identical structural
  // fingerprint, which is what a reader perceives as "templated".
  const hookCycle = Math.floor(postIndex / tpl.hookTypes.length);
  const hookOrder = makeRng(h32(accountId, campaignId, tpl.id, 'hook', hookCycle)).shuffle(tpl.hookTypes);
  const hookType = hookOrder[postIndex % tpl.hookTypes.length];
  const cropStrategy = r.pick(tpl.cropStrategies ?? ['contain']);
  return { seed, rng: r, tpl, accentKey, slideCount, hookType, cropStrategy };
}

/**
 * `bleed` is either a pixel overhang (legacy templates) or a list of edge names
 * (the brief's schema). Edge names carry no magnitude — the overhang for those
 * comes from the anchor plus dx/dy — so they normalise to 0 here.
 */
const bleedPx = (b) => (typeof b === 'number' && Number.isFinite(b) ? b : 0);

/** Edges a subject is DECLARED to exit, for the bleed quality gate. */
export const bleedEdgesOf = (b) => (Array.isArray(b) ? b : []);

function subjectSpecFor(roleSpec, rng, cropStrategy, palette, slideIndex = 0, rotateOffset = 0, niche = null,
  intent = null, used = null) {
  const s = roleSpec.subject;
  if (!s) return null;

  // A library subject is a real matted photograph, chosen to ANSWER THE SLIDE.
  // Walking the library by index guaranteed variety and guaranteed irrelevance;
  // the intent match is what ties the picture to the words. `used` keeps one
  // carousel from repeating a subject.
  if (s.library) {
    const useNiche = s.library.niche || niche;
    if (!useNiche) throw new Error('library subject requires a niche (campaign.niche or template library.niche)');
    const lib = loadLibrary(useNiche, s.library.kind || 'people');
    const chosen = pickSubject(lib.items, intent, { used: used || new Set(), minScore: s.library.minScore ?? 0.25 });
    if (!chosen) return null;
    const { item, score, matched } = chosen;
    if (used) used.add(item.id);
    const src = s.library.variant === 'bw' && item.bwFile ? item.bwFile : item.file;
    return {
      ...s, id: item.id, src, credit: item.credit,
      matchScore: score, matched,
      fit: cropStrategy, heightPct: s.heightPct ?? 0.5,
    };
  }
  // Rotating the pool by slide index guarantees no two consecutive slides reuse
  // the same object; random picks from a 5-item pool collide roughly 1 slide in 5.
  // Rotate through silhouette CLASSES, then through members of the class, so a
  // ring is never followed by another ring even when the pool is ring-heavy.
  let id = s.id;
  if (s.pool) {
    if (s.rotate === false) id = s.pool[rng.int(s.pool.length)];
    else {
      const classes = [...new Set(s.pool.map(shapeClassOf))];
      const cls = classes[(rotateOffset + slideIndex) % classes.length];
      const members = s.pool.filter((m) => shapeClassOf(m) === cls);
      id = members[Math.floor((rotateOffset + slideIndex) / classes.length) % members.length];
    }
  }
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

async function renderSlide({ tpl, slide, slideIndex, slideCount, palette, outFile, rngSlide, cropStrategy, rotateOffset, displayCap, niche, brand, usedSubjects }) {
  const cardWarnings = [];
  const role = roleFor(tpl, slide, slideIndex);
  const roleSpec = tpl.roles[role];
  const canvas = tpl.canvas;

  const laid = layoutSlide({ tpl, role, content: slide, palette, canvas, displayCap });
  if (!laid.ok) return { ok: false, ...laid };

  // subject placement, including the declared overlap with a named type slot
  let subject = null;
  const sSpec = subjectSpecFor(roleSpec, rngSlide, cropStrategy, palette, slideIndex, rotateOffset, niche,
    slide.imageIntent, usedSubjects);
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
          // never float: keep the contact edge at or below the canvas foot.
          // `bleed` is a pixel overhang in the legacy templates and a list of
          // edge names in the brief's schema; an array reaching the arithmetic
          // silently produced NaN and crashed the compositor, so normalise.
          subject.rect.y = Math.min(subject.rect.y, canvas.h - subject.rect.h + bleedPx(sSpec.bleed));
        }
      }
    }
    // A subject crossing a DISPLAY line is the corpus idiom. A subject sitting on
    // body copy is a mistake — round 3 buried two cover kickers behind a figure.
    // Push the subject clear of any non-display slot it obscures.
    if (subject) {
      const displayIds = new Set((roleSpec.type || [])
        .filter((t) => t.hierarchy === 'display' || t.id === sSpec.overlapSlot).map((t) => t.id));
      for (const r of laid.rects) {
        if (displayIds.has(r.id)) continue;
        const cov = coverage(r, subject.rect);
        if (cov > 0.1) {
          const push = r.y + r.h + 14 - subject.rect.y;
          if (push > 0) subject.rect.y += Math.round(push);
        }
      }
    }
  }

  const furniture = layoutFurniture({
    tpl, role: slide.role, slideIndex, slideCount, palette, brand: brand || BRAND,
  });

  const bgCtx = { canvas, rng: rngSlide, ...palette, plate: null };
  const bgSpec = { ...roleSpec.background };
  if (bgSpec.type === 'photo' && bgSpec.pool) {
    bgSpec.src = path.join('assets/inhouse-only/plates', bgSpec.pool[rngSlide.int(bgSpec.pool.length)]);
  }
  // A photo background can also come from the campaign's own plate library,
  // walked by slide index so one carousel does not open and close on the same
  // landscape.
  if (bgSpec.type === 'photo' && bgSpec.library && niche) {
    const plates = loadLibrary(bgSpec.library.niche || niche, bgSpec.library.kind || 'plates');
    const item = plates.items[(rotateOffset + slideIndex) % plates.items.length];
    bgSpec.src = item.file;
    bgSpec.credit = item.credit;
  }
  bgCtx.plate = bgSpec.type === 'flat' ? bgSpec.fill : 'paper';
  const background = await renderBackground(bgSpec, bgCtx);

  // rules and swatches sit under the cutout, the way the corpus does it
  const underLayer = ((laid.underShapes || []).length || (laid.underBlocks || []).length)
    ? (await renderVectorLayer({
        width: canvas.w, height: canvas.h,
        blocks: laid.underBlocks || [], shapes: laid.underShapes || [],
      })).png
    : null;
  const typeLayer = (await renderVectorLayer({
    width: canvas.w, height: canvas.h, blocks: laid.blocks, shapes: laid.shapes,
  })).png;
  // empirical proof that the model matched the render: the type layer's real ink
  // bbox, which the gauntlet compares against the safe box independently
  const typeInk = await inkBBox(typeLayer);
  const furnitureLayer = (await renderVectorLayer({
    width: canvas.w, height: canvas.h, blocks: furniture.blocks, shapes: furniture.shapes,
  })).png;

  // Cards: decoration with depth. Declared back-to-front; `z:"front"` puts a
  // panel in front of the subject.
  const cardSpecs = (roleSpec.cards || []).map((c) => ({ ...c }));
  for (const c of cardSpecs) {
    if (c.library && niche) {
      const lib = loadLibrary(c.library.niche || niche, c.library.kind || 'plates');
      const item = lib.items[(rotateOffset + slideIndex + (c.offset ?? 0)) % lib.items.length];
      c.src = c.library.variant === 'bw' && item.bwFile ? item.bwFile : item.file;
    }
  }
  const built = await buildCards(cardSpecs, { canvas, rng: rngSlide, ...palette, plate: bgCtx.plate },
    (m) => cardWarnings.push(m));
  const cardsBack = built.filter((_, i) => (cardSpecs[i].z ?? 'back') !== 'front');
  const cardsFront = built.filter((_, i) => cardSpecs[i].z === 'front');

  await composeSlide({ background, underLayer, cardsBack, cardsFront, subject, typeLayer, furnitureLayer, canvas, out: outFile });

  return {
    ok: true,
    file: outFile,
    rects: laid.rects,
    subjectRect: subject?.rect ?? null,
    subjectId: sSpec?.id ?? null,
    credit: sSpec?.credit ?? null,
    cardWarnings,
    subjectMatch: sSpec ? { score: sSpec.matchScore ?? null, matched: sSpec.matched ?? null, intent: slide.imageIntent ?? null } : null,
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
  outDir = 'output/run', templates = loadTemplates(), maxRetries = 8,
  niche = null, campaign = null, concept = null,
}) {
  // A partner campaign supplies its own brand kit, niche and rules. Falling back
  // to the built-in brand keeps the old sleep-app path working unchanged.
  if (campaign) {
    campaignId = campaign.id ?? campaignId;
    niche = niche ?? campaign.niche ?? null;
  }
  const d = diverge({ accountId, campaignId, postIndex, templates });
  const palette = campaign?.brand
    ? makePaletteFrom(campaign.brand, accentKeysOf(campaign.brand)[postIndex % accentKeysOf(campaign.brand).length])
    : makePalette(d.accentKey);
  const id = `${d.tpl.id.split('-')[0]}-p${String(postIndex).padStart(2, '0')}-${d.accentKey.slice(-1)}`;
  const dir = path.join(outDir, id);

  /**
   * The corpus volume curve, stated as an inequality:
   *     cover  <  closer  <=  min(interiors)
   * Shaving words until it happened to hold was fragile — 16 of 38 template/hook
   * combinations failed. The closer now carries three written lengths and the
   * engine SOLVES for the one that satisfies the inequality against the real
   * rendered word counts of this particular template.
   */
  const solveCloserLen = (mk3, base) => {
    let best = 1, bestScore = -Infinity;
    for (const len of [0, 1, 2]) {
      const c = buildCopy(mk3(), { ...base, closerLen: len });
      const counts = c.slides.map((slide, i) => {
        const r = layoutSlide({ tpl: d.tpl, role: roleFor(d.tpl, slide, i), content: slide,
          palette, canvas: d.tpl.canvas });
        return r.ok ? r.renderedWords : NaN;
      });
      if (counts.some(Number.isNaN)) continue;
      const cover = counts[0], closer = counts[counts.length - 1];
      const minInt = Math.min(...counts.slice(1, -1));
      // strictly satisfied beats nearly satisfied; ties broken toward a fuller closer
      const score = (cover < closer ? 100 : -(cover - closer)) + (closer <= minInt ? 100 : -(closer - minInt)) + len;
      if (score > bestScore) { bestScore = score; best = len; }
    }
    return best;
  };

  // A CONCEPT bypasses the copy banks entirely: the idea engine already decided
  // what every slide says, so there is nothing to regenerate. The layout dry-run
  // still runs, and a concept that cannot be laid out is a hard error rather
  // than something the renderer silently trims.
  if (concept) {
    const built = conceptToSlides(concept);
    const cover0 = layoutSlide({ tpl: d.tpl, role: 'cover', content: built.slides[0], palette, canvas: d.tpl.canvas });
    const cap0 = cover0.ok && cover0.displaySize ? cover0.displaySize * (d.tpl.hierarchyRatio ?? 0.68) : undefined;
    const dry = built.slides.map((slide, i) =>
      layoutSlide({ tpl: d.tpl, role: roleFor(d.tpl, slide, i), content: slide, palette,
        canvas: d.tpl.canvas, displayCap: i === 0 ? undefined : cap0 }));
    const bad = dry.map((r, i) => ({ r, i })).filter((x) => !x.r.ok);
    if (bad.length) {
      throw new Error(
        `${d.tpl.id} concept "${concept.hook}": layout unsatisfiable — ` +
        bad.map((x) => `s${x.i + 1}:${x.r.reason}(${x.r.slot})`).join(', ') +
        ' — the idea engine must emit shorter copy for this slot');
    }
    return await renderFromCopy({ d, palette, copy: built, dir, id, postIndex, niche, campaign, copyAttempts: 0 });
  }

  let attempt = 0, copy = null, failures = [];
  for (; attempt <= maxRetries; attempt++) {
    const base = { slideCount: d.slideCount, hookType: d.hookType, shorten: attempt, hookPick: attempt };
    const closerLen = solveCloserLen(() => makeRng(d.seed + attempt * 7919), base);
    const rCopy = makeRng(d.seed + attempt * 7919);
    copy = buildCopy(rCopy, { ...base, closerLen });

    // dry-run every slide's layout before rendering a single pixel
    const cover0 = layoutSlide({ tpl: d.tpl, role: 'cover', content: copy.slides[0], palette, canvas: d.tpl.canvas });
    const cap0 = cover0.ok && cover0.displaySize ? cover0.displaySize * (d.tpl.hierarchyRatio ?? 0.68) : undefined;
    const dry = copy.slides.map((slide, i) =>
      layoutSlide({ tpl: d.tpl, role: roleFor(d.tpl, slide, i), content: slide, palette,
        canvas: d.tpl.canvas, displayCap: i === 0 ? undefined : cap0 })
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

  return await renderFromCopy({ d, palette, copy, dir, id, postIndex, niche, campaign,
    accountId, campaignId, copyAttempts: attempt });
}

/**
 * Everything downstream of "we have final copy": layout cap, per-slide render,
 * furniture, fingerprint, validation, manifest. Shared by the copy-bank path and
 * the concept path so the two cannot drift apart.
 */
async function renderFromCopy({ d, palette, copy, dir, id, postIndex, niche, campaign,
  accountId = 'drift', campaignId = null, copyAttempts = 0 }) {
  fs.mkdirSync(dir, { recursive: true });
  const rotateOffset = makeRng(d.seed ^ 0x5bd1e995).int(97);
  // measure the cover's display size once, then cap every later slide against it
  const coverLaid = layoutSlide({
    tpl: d.tpl, role: 'cover', content: copy.slides[0], palette, canvas: d.tpl.canvas,
  });
  const displayCap = coverLaid.ok && coverLaid.displaySize
    ? coverLaid.displaySize * (d.tpl.hierarchyRatio ?? 0.68) : undefined;
  const files = [];
  const slideMeta = [];
  const credits = [];
  // one carousel never repeats a cutout
  const usedSubjects = new Set();
  for (let i = 0; i < copy.slides.length; i++) {
    const slide = copy.slides[i];
    const outFile = path.join(dir, `${String(i + 1).padStart(2, '0')}.png`);
    const rngSlide = makeRng(d.seed + i * 104729);
    const r = await renderSlide({
      tpl: d.tpl, slide, slideIndex: i, slideCount: copy.slides.length,
      palette, outFile, rngSlide, cropStrategy: d.cropStrategy, rotateOffset,
      displayCap: i === 0 ? undefined : displayCap, niche, brand: campaign?.brand, usedSubjects,
    });
    if (!r.ok) throw new Error(`render failed on slide ${i + 1}: ${r.reason} (${r.slot})`);
    files.push(outFile);
    if (r.credit) credits.push({ slide: i + 1, ...r.credit });
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
    seed: d.seed, family: d.tpl.id, familyName: d.tpl.name, displayCap,
    accentKey: palette.accentKey, accent: palette.accent,
    hookType: copy.hookType, slides: copy.slides, canvas: d.tpl.canvas,
    tpl: d.tpl, furnitureByRole, cropStrategy: d.cropStrategy,
    copyAttempts, slideMeta,
    brand: campaign?.brand ?? BRAND,
    rules: campaign?.rules ?? null,
    // Attribution travels with the carousel. A set that used licensed stock
    // cannot be delivered without the record of what it used.
    credits,
    fingerprint: fingerprint({
      family: d.tpl.id, slideCount: copy.slides.length,
      hookType: copy.hookType, accent: palette.accentKey,
    }),
  };
  carousel.validation = validateCarousel(carousel);

  const { tpl, ...serialisable } = carousel;
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(serialisable, null, 2));
  return carousel;
}

export { assertAssetAllowed, safeBox };
