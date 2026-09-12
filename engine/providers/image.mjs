// Image generation, against the real API.
//
// Everything here is written against observed behaviour, not inference —
// gpt-image-2 shipped after the model's training cutoff, so the parameters and
// the response shape were probed first (tools/probe-image-api.mjs). Measured on
// 2026-09-06 with a live key:
//
//   returns          b64_json only, no url
//   portrait sizes   1024x1536 · 1024x1792 · 832x1216 · auto  (all accepted)
//   1024x1536        low 158 tok / medium 1372 / high 5488
//   wall clock       low ~9s · medium ~19s · high ~67s
//
// High quality costs 35x low and takes seven times as long, so the default is
// deliberately not high: a set is many images, and the one that carries the
// brand is worth paying for while the rest are not.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { stripPng } from '../clean.mjs';

const API = 'https://api.openai.com/v1';

/**
 * gpt-image-2 list prices per token (developers.openai.com/api/docs/pricing,
 * read 2026-09-12): text in $5/1M, image in $8/1M, cached in $2/1M, image
 * out $30/1M. Every edit call carries the reference as ~1536 IMAGE INPUT
 * tokens (seen in the usage block), i.e. $0.012 per frame on top of the
 * output - more than a low-quality frame's own pixels cost. Billing only
 * output + text, as this file did until today, under-counted a 7-slide
 * subject set by about $0.07.
 */
const USD_PER_OUTPUT_TOKEN = 30 / 1e6;
const USD_PER_TEXT_INPUT_TOKEN = 5 / 1e6;
const USD_PER_IMAGE_INPUT_TOKEN = 8 / 1e6;
const USD_PER_CACHED_INPUT_TOKEN = 2 / 1e6;

/** Sizes the API accepts, with the aspect each actually is. */
export const SIZES = {
  '1024x1536': 1024 / 1536,   // 0.667 — 2:3
  '1024x1792': 1024 / 1792,   // 0.571 — closest to 9:16
  '832x1216': 832 / 1216,     // 0.684
  '1024x1024': 1,
  '1536x1024': 1536 / 1024,
};

/** The accepted size whose aspect is nearest the canvas, so the crop is small. */
export function sizeFor(w, h) {
  const want = w / h;
  return Object.entries(SIZES).sort((a, b) => Math.abs(a[1] - want) - Math.abs(b[1] - want))[0][0];
}

export function loadEnv(root) {
  const f = path.join(root, '.env.local');
  if (!fs.existsSync(f)) return {};
  return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One request, with backoff on the failures that are worth retrying.
 *
 * 429 and 5xx are transient. A 400 is a bad request and retrying it just spends
 * the same money on the same mistake, so it throws immediately with the API's
 * own message rather than a generic one.
 */
async function request(url, init, { tries = 4 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(url, init);
    if (r.ok) return r.json();
    const body = await r.text();
    let msg = body.slice(0, 300);
    try { msg = JSON.parse(body).error?.message ?? msg; } catch { /* keep raw */ }
    last = new Error(`image API ${r.status}: ${msg}`);
    if (r.status !== 429 && r.status < 500) throw last;
    await sleep(1500 * 2 ** i);
  }
  throw last;
}

/* ── cost ledger ────────────────────────────────────────────────────────── */

export const ledger = { calls: 0, cached: 0, usd: 0, tokens: 0, entries: [] };

function bill(label, usage) {
  const out = usage?.output_tokens ?? 0;
  const usd = usdFor(usage);
  ledger.calls += 1;
  ledger.usd += usd;
  ledger.tokens += out;
  ledger.entries.push({ label, out, usd: +usd.toFixed(5) });
  return usd;
}

export function costReport() {
  return {
    calls: ledger.calls, cachedHits: ledger.cached,
    outputTokens: ledger.tokens, usd: +ledger.usd.toFixed(4),
    entries: ledger.entries,
  };
}

/* ── cache store ────────────────────────────────────────────────────────── */

/**
 * The frame cache is a directory of content-addressed PNGs. On a laptop that
 * is the whole story. On a host whose filesystem is thrown away between
 * invocations, a STORE mirrors it: `pull(id, file)` fetches an entry into
 * the directory before the existence check, `push(id, file)` uploads a new
 * one after the write. Both are best effort — a store outage costs a
 * regeneration, never a failed set. Set with `useCacheStore()`; null = local only.
 */
let store = null;
export function useCacheStore(s) { store = s; }

export async function cachePull(id, file) {
  if (fs.existsSync(file) || !store) return fs.existsSync(file);
  try {
    const bytes = await store.pull(id);
    if (!bytes) return false;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
    return true;
  } catch { return false; }
}

export async function cachePush(id, file) {
  if (!store) return;
  try { await store.push(id, fs.readFileSync(file)); } catch { /* next time */ }
}

/* ── generation ─────────────────────────────────────────────────────────── */

const key = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 20);

/** The image model in use: env override, else gpt-image-2. */
export function imageModel(root) {
  return loadEnv(root).OPENAI_IMAGE_MODEL || process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';
}

/**
 * Where a frame lives in the cache, from its inputs alone. Shared by the
 * realtime call and the batch lane so a frame paid for in a batch is found by
 * the next realtime request with the same inputs, and vice versa.
 */
export function cacheEntry({ root, cacheDir, prompt, size = '1024x1536', quality = 'low', refs = [], variant = 0 }) {
  const model = imageModel(root);
  const refHashes = refs.map((f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12));
  const id = key({ model, prompt, size, quality, refHashes, variant });
  return { id, model, file: path.join(cacheDir, `img-${id}.png`) };
}

/** Dollars for one image call from its usage block; the batch lane halves this. */
export function usdFor(usage) {
  const out = usage?.output_tokens ?? 0;
  const d = usage?.input_tokens_details ?? {};
  const cached = d.cached_tokens ?? 0;
  const txt = (d.text_tokens ?? usage?.input_tokens ?? 0);
  const img = d.image_tokens ?? 0;
  // cached tokens are a subset of the input (in practice the reference
  // image on a repeat edit) billed at the cached rate instead of the full one
  return out * USD_PER_OUTPUT_TOKEN
    + txt * USD_PER_TEXT_INPUT_TOKEN
    + img * USD_PER_IMAGE_INPUT_TOKEN
    - cached * (USD_PER_IMAGE_INPUT_TOKEN - USD_PER_CACHED_INPUT_TOKEN);
}

/**
 * Generate an image, caching on the full input.
 *
 * The cache is content-addressed on everything that affects the pixels, so an
 * unchanged prompt never costs twice — which matters more here than in a text
 * pipeline, because a high-quality image is 35x the price of a low one.
 *
 * @param {object} o
 * @param {string} o.prompt
 * @param {string} [o.size]     one of SIZES; defaults to portrait 2:3
 * @param {string} [o.quality]  low | medium | high
 * @param {string[]} [o.refs]   file paths used as reference images (edit mode)
 * @param {string} o.cacheDir
 * @param {string} o.root
 */
export async function generate(o) {
  const { root, cacheDir, prompt, size = '1024x1536', quality = 'low', refs = [], label = 'image', variant = 0 } = o;
  const env = loadEnv(root);
  const apiKey = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY missing from .env.local');

  // `variant` is part of the key so best-of-N draws genuinely separate
  // samples; without it every variant collapses onto one cache entry.
  // Content-addressed: the filename is the hash of the INPUTS only. The label
  // is a ledger annotation, not part of identity — having it in the filename
  // meant the identical sheet requested by the CLI and by the API missed each
  // other's cache entry and was paid for twice ($0.126, found the hard way).
  const { id, model, file: out } = cacheEntry({ root, cacheDir, prompt, size, quality, refs, variant });
  fs.mkdirSync(cacheDir, { recursive: true });
  if (await cachePull(id, out)) { ledger.cached += 1; return { file: out, cached: true, usd: 0 }; }

  let json;
  if (refs.length) {
    // Edit-with-reference: the character stays the same across poses because the
    // previous render is passed back in, rather than hoping two prompts land in
    // the same place.
    const form = new FormData();
    form.set('model', model);
    form.set('prompt', prompt);
    form.set('size', size);
    form.set('quality', quality);
    for (const f of refs) {
      form.append('image[]', new Blob([fs.readFileSync(f)], { type: 'image/png' }), path.basename(f));
    }
    json = await request(`${API}/images/edits`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form });
  } else {
    json = await request(`${API}/images/generations`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
    });
  }

  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`image API returned no b64_json for "${label}"`);
  // the provider's C2PA manifest (caBX) is dropped here, so nothing
  // downstream ever sees a frame that carries one
  fs.writeFileSync(out, stripPng(Buffer.from(b64, 'base64')));
  await cachePush(id, out);
  const usd = bill(label, json.usage);
  return { file: out, cached: false, usd, usage: json.usage };
}

/**
 * Generate, then keep only the best of N by a caller-supplied score.
 *
 * Generation is not reliable enough to take the first result on trust for the
 * one asset a whole set is built around, and it is far too expensive to do this
 * for every image — so it is opt-in per call rather than a default.
 */
export async function best(n, score, o) {
  const runs = [];
  for (let i = 0; i < n; i++) {
    const r = await generate({ ...o, label: `${o.label ?? 'image'}-v${i}`, variant: i });
    runs.push({ ...r, score: await score(r.file) });
  }
  runs.sort((a, b) => b.score - a.score);
  return runs;
}
