// The two lanes, as one resumable state machine.
//
// A set is copy → frames → render. Realtime ("priority") runs that in one
// process and returns in a minute or two. Batch runs the same words through
// the providers' batch endpoints at half price and comes back within the
// day. The difference is only WHEN each call returns, so both lanes share
// one state object and one `step()` that makes a single transition:
//
//   copy:submit → copy:wait → art:anchor:submit → art:anchor:wait
//     → art:frames:submit → art:frames:wait → render → done | failed
//
// A CLI loops `step` with a sleep; the hosted worker stores the state on
// the set row and calls `step` once per cron tick. Nothing here blocks on a
// batch. Every dollar in `state.usd` comes from a provider usage block.
import fs from 'node:fs';
import path from 'node:path';
import { buildCopyRequest, judgeCopy, feedbackFor, toRenderable } from './generate.mjs';
import { completeJson, extractJson } from './providers/claude.mjs';
import * as claudeBatch from './providers/claude-batch.mjs';
import { generate } from './providers/image.mjs';
import * as oaBatch from './providers/openai-batch.mjs';
import { planSet } from './art.mjs';
import { render } from './styles/registry.mjs';
import { enforce, bankFor, BANK } from './scenes.mjs';

export const STAGES = [
  'copy:submit', 'copy:wait', 'art:anchor:submit', 'art:anchor:wait',
  'art:frames:submit', 'art:frames:wait', 'render', 'done', 'failed',
];

/** A fresh state for one set. `lane` is 'priority' (realtime) or 'batch'. */
export function newState({ id, spec, instruction, slides, styleId, lane = 'batch', quality = 'medium', model = 'claude-opus-5', seed, look, mode }) {
  return {
    id, lane, instruction, slides, styleId: styleId ?? spec.content?.style ?? 'native',
    quality, model, seed: seed ?? `${spec.id}|${instruction}`, look: look ?? null, mode: mode ?? null,
    stage: 'copy:submit',
    copy: { attempts: 0, feedback: '', batchId: null, content: null, verdict: null, usd: 0 },
    art: { plan: null, anchorBatch: null, anchorFileId: null, anchorFile: null, framesBatch: null, entries: null, files: null, usd: 0, cached: 0, world: null, scenes: null },
    usd: 0, error: null, log: [],
  };
}

const note = (s, m) => { s.log.push(`${new Date().toISOString()} ${s.stage} ${m}`); };
const fail = (s, m) => { s.error = m; s.stage = 'failed'; note(s, `FAILED ${m}`); return s; };

/* ── copy ───────────────────────────────────────────────────────────────── */

async function copySubmit(s, { root, spec }) {
  if (s.copy.attempts >= 3) return fail(s, `copy non-compliant after 3 attempts: ${s.copy.verdict?.failures.join(' | ')}`);
  const req = buildCopyRequest({ spec, instruction: s.instruction, slides: s.slides, styleId: s.styleId, feedback: s.copy.feedback });
  s.copy.range = req.range;
  s.copy.attempts += 1;
  if (s.lane === 'priority') {
    const { data, usd } = await completeJson({ root, model: s.model, label: `lane:${s.id}:copy${s.copy.attempts}`, maxTokens: req.maxTokens, system: req.system, user: req.user });
    s.copy.usd += usd; s.usd += usd;
    return copyJudge(s, { spec, data });
  }
  const b = await claudeBatch.submitBatch(root, [{ customId: `${s.id}-copy-${s.copy.attempts}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64), model: s.model, system: req.system, user: req.user, maxTokens: req.maxTokens }]);
  s.copy.batchId = b.id;
  s.stage = 'copy:wait';
  note(s, `submitted ${b.id}`);
  return s;
}

async function copyWait(s, { root, spec }) {
  const st = await claudeBatch.batchStatus(root, s.copy.batchId);
  if (st.status !== 'ended') return s;
  const results = await claudeBatch.batchResults(root, s.copy.batchId);
  const r = Object.values(results)[0];
  if (!r?.ok) return fail(s, `copy batch: ${r?.error ?? 'no result'}`);
  s.copy.usd += r.usd; s.usd += r.usd;
  let data;
  try { data = extractJson(r.text); } catch (e) {
    // an unparseable reply is a failed attempt, fed back like any other
    s.copy.feedback = `\nYour previous reply could not be parsed (${e.message}). Reply with the JSON object only.`;
    s.stage = 'copy:submit';
    return s;
  }
  return copyJudge(s, { spec, data });
}

function copyJudge(s, { spec, data }) {
  const judged = judgeCopy({ spec, data, range: s.copy.range });
  s.copy.verdict = judged.verdict;
  s.copy.count = judged.count;
  if (!judged.verdict.pass) {
    s.copy.feedback = feedbackFor(judged.verdict);
    s.stage = 'copy:submit';
    note(s, `attempt ${s.copy.attempts} rejected: ${judged.verdict.failures.join(' | ')}`);
    return s;
  }
  s.copy.content = judged.data;
  s.stage = 'art:anchor:submit';
  note(s, `copy passed on attempt ${s.copy.attempts}, ${judged.count} slides, $${s.copy.usd.toFixed(4)}`);
  return s;
}

/* ── art ────────────────────────────────────────────────────────────────── */

/**
 * The art plan from the copy: scenes (enforced into one world for the feed
 * format), the subject, the mode. Same logic make-set had inline.
 */
function artPlan(s, { spec }) {
  const content = s.copy.content;
  let scenes = [content.hook?.scene, ...(content.ranked ?? []).map((r) => r.scene), content.closer?.scene]
    .map((sc, i) => sc || `the person, scene ${i + 1}`);
  const isGym = bankFor(spec.niche) === BANK.fitness;
  let world = null;
  let look = s.look ?? spec.assets?.look ?? 'cinematic';
  if (s.styleId === 'feed') {
    const appIndex = 1 + (content.ranked ?? []).findIndex((r) => r.showsApp);
    const e = enforce(scenes, { niche: spec.niche, appIndex: appIndex > 0 ? appIndex : -1, seed: s.seed, headings: (content.ranked ?? []).map((r) => r.name) });
    scenes = e.scenes; world = e.world;
    if (!s.look) look = world.look ?? look;
  }
  const mode = s.mode ?? (s.styleId === 'feed' && !isGym ? 'aspirational' : 'subject');
  const days = s.styleId === 'feed' && isGym && world?.id === 'life';
  const subject = content.subject && content.subject !== 'none' ? content.subject : 'A lean muscular man in his early twenties, short dark hair, light stubble.';
  s.art.world = world ? { id: world.id, label: world.label } : null;
  s.art.look = look;
  s.art.scenes = scenes;
  s.art.mode = mode;
  return planSet({ subject, scenes, look, quality: s.quality, w: 1080, h: 1920, id: s.id, mode, days });
}

const withSize = (plan, f) => ({ ...f, size: plan.size, quality: plan.quality });

/** Run `fn` over `items` with at most `n` in flight; results in input order. */
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }));
  return out;
}

async function anchorSubmit(s, ctx) {
  const { root, spec, cacheDir } = ctx;
  const plan = artPlan(s, { spec });
  s.art.plan = { size: plan.size, quality: plan.quality, mode: plan.mode };
  if (!plan.anchor) {
    // aspirational: no anchor, every frame is independent — straight to frames
    s.stage = 'art:frames:submit';
    return s;
  }
  if (s.lane === 'priority') {
    const r = await generate({ root, cacheDir, size: plan.size, quality: plan.quality, label: plan.anchor.label, prompt: plan.anchor.prompt });
    s.art.anchorFile = r.file; s.art.usd += r.usd ?? 0; s.usd += r.usd ?? 0; if (r.cached) s.art.cached++;
    s.stage = 'art:frames:submit';
    return s;
  }
  const b = await oaBatch.submitFrames(root, { cacheDir, frames: [withSize(plan, plan.anchor)] });
  if (!b.id) {
    // already in the cache from an earlier run — nothing to wait for
    s.art.anchorFile = b.entries[plan.anchor.label].file; s.art.cached++;
    s.stage = 'art:frames:submit';
    return s;
  }
  s.art.anchorBatch = { id: b.id, entries: b.entries, label: plan.anchor.label };
  s.stage = 'art:anchor:wait';
  note(s, `anchor batch ${b.id}`);
  return s;
}

async function anchorWait(s, { root }) {
  const st = await oaBatch.batchStatus(root, s.art.anchorBatch.id);
  if (!st.done) return s;
  const got = await oaBatch.collectFrames(root, s.art.anchorBatch);
  s.art.usd += got.usd; s.usd += got.usd;
  const file = got.files[s.art.anchorBatch.label];
  if (!file) return fail(s, `anchor: ${got.failed[s.art.anchorBatch.label] ?? st.status}`);
  s.art.anchorFile = file;
  s.stage = 'art:frames:submit';
  note(s, `anchor landed $${got.usd.toFixed(4)}`);
  return s;
}

async function framesSubmit(s, ctx) {
  const { root, spec, cacheDir } = ctx;
  const plan = artPlan(s, { spec });
  const frames = plan.frames(s.art.anchorFile).map((f) => withSize(plan, f));
  if (s.lane === 'priority') {
    // The frames after the anchor are independent, so they go out together:
    // four at a time, which turns six 20-second edits into ~40 s of wall
    // clock and keeps a 10-slide priority set inside the host's 300 s.
    const results = await pool(frames, ctx.concurrency ?? 4, (f) =>
      generate({ root, cacheDir, size: f.size, quality: f.quality, label: f.label, refs: f.refs, prompt: f.prompt }));
    for (const r of results) { s.art.usd += r.usd ?? 0; s.usd += r.usd ?? 0; if (r.cached) s.art.cached++; }
    s.art.files = [s.art.anchorFile, ...results.map((r) => r.file)].filter(Boolean);
    s.stage = 'render';
    return s;
  }
  // the reference goes up once as a File and is named by id on every line
  const refFileIds = {};
  const needsRef = frames.some((f) => f.refs.length);
  if (needsRef) {
    refFileIds[s.art.anchorFile] = await oaBatch.uploadFile(root, { bytes: fs.readFileSync(s.art.anchorFile), name: 'anchor.png', purpose: 'user_data', type: 'image/png' });
    s.art.anchorFileId = refFileIds[s.art.anchorFile];
  }
  const b = await oaBatch.submitFrames(root, { cacheDir, frames, refFileIds });
  s.art.framesBatch = { id: b.id, entries: b.entries, labels: frames.map((f) => f.label) };
  s.art.cached += b.cached;
  if (!b.id) {
    s.art.files = [s.art.anchorFile, ...frames.map((f) => b.entries[f.label].file)].filter(Boolean);
    s.stage = 'render';
    return s;
  }
  s.stage = 'art:frames:wait';
  note(s, `frames batch ${b.id} (${b.submitted} submitted, ${b.cached} cached)`);
  return s;
}

async function framesWait(s, { root }) {
  const st = await oaBatch.batchStatus(root, s.art.framesBatch.id);
  if (!st.done) return s;
  const got = await oaBatch.collectFrames(root, s.art.framesBatch);
  s.art.usd += got.usd; s.usd += got.usd;
  if (s.art.anchorFileId) { await oaBatch.deleteFile(root, s.art.anchorFileId); s.art.anchorFileId = null; }
  const missing = s.art.framesBatch.labels.filter((l) => !got.files[l]);
  if (missing.length) return fail(s, `frames failed: ${missing.map((l) => `${l}: ${got.failed[l] ?? st.status}`).join('; ')}`);
  s.art.files = [s.art.anchorFile, ...s.art.framesBatch.labels.map((l) => got.files[l])].filter(Boolean);
  s.stage = 'render';
  note(s, `frames landed $${got.usd.toFixed(4)}`);
  return s;
}

/* ── render ─────────────────────────────────────────────────────────────── */

async function renderStage(s, { root, spec, outDir }) {
  const content = s.copy.content;
  const renderable = toRenderable(spec, content, { appScreen: spec.assets?.app_screen, appIcon: spec.assets?.app_icon, photos: s.art.files });
  renderable.assets = { ...renderable.assets, look: s.art.look, photos: { dir: '.', credit: 'gpt-image-2' } };
  const r = await render({ spec: renderable, root, styleId: s.styleId, outDir });
  if (r.artUsd) { s.art.usd += r.artUsd; s.usd += r.artUsd; }
  fs.writeFileSync(path.join(outDir, 'content.json'), JSON.stringify({ content, photos: s.art.files }, null, 2));
  fs.writeFileSync(path.join(outDir, 'post.json'), JSON.stringify({
    caption: content.caption, bio: content.bio, hashtags: content.hashtags,
    compliance: s.copy.verdict, world: s.art.world, look: s.art.look, lane: s.lane,
    cost: { copy: +s.copy.usd.toFixed(4), art: +s.art.usd.toFixed(4), total: +s.usd.toFixed(4) },
  }, null, 2));
  s.files = r.files;
  s.canvas = r.canvas;
  s.stage = 'done';
  note(s, `rendered ${r.files.length} slides, total $${s.usd.toFixed(4)}`);
  return s;
}

/* ── the machine ────────────────────────────────────────────────────────── */

const HANDLERS = {
  'copy:submit': copySubmit,
  'copy:wait': copyWait,
  'art:anchor:submit': anchorSubmit,
  'art:anchor:wait': anchorWait,
  'art:frames:submit': framesSubmit,
  'art:frames:wait': framesWait,
  'render': renderStage,
};

/** Is this stage waiting on a provider batch (nothing to do until it ends)? */
export const isWaiting = (s) => s.stage.endsWith(':wait');
export const isTerminal = (s) => s.stage === 'done' || s.stage === 'failed';

/**
 * One transition. `ctx` = { root, spec, cacheDir, outDir }. Returns the
 * same state object, advanced (or unchanged if a batch is still running).
 * Provider errors mark the set failed rather than throwing, so a worker
 * tick never dies on one set.
 */
export async function step(s, ctx) {
  if (isTerminal(s)) return s;
  const h = HANDLERS[s.stage];
  if (!h) return fail(s, `unknown stage ${s.stage}`);
  try {
    return await h(s, ctx);
  } catch (e) {
    return fail(s, e.message);
  }
}

/**
 * Run to completion in one process (the CLI, tests, the priority lane on
 * the host). Batch waits poll every `everyMs`.
 */
export async function run(s, ctx, { everyMs = 20000, onStage } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let last = null;
  while (!isTerminal(s)) {
    const before = s.stage;
    await step(s, ctx);
    if (s.stage !== last) { onStage?.(s); last = s.stage; }
    if (isWaiting(s) && s.stage === before) await sleep(everyMs);
  }
  return s;
}
