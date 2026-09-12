// OpenAI Batch API — the queued lane for frames.
//
// /v1/images/generations and /v1/images/edits both take batch requests at
// half the realtime price, which is the other half of the queued tier's
// margin (copy goes through Anthropic's batch endpoint; see claude-batch.mjs).
// Shapes below were probed against the live API on 2026-09-12, not inferred:
//
//   - a batch line is {custom_id, method:'POST', url, body}; the body for
//     edits is JSON, not multipart, and the reference goes in `images`
//     (an ARRAY) — `image` is rejected with "use 'images' (array)".
//   - the reference is passed by Files API id: upload the anchor PNG with
//     purpose "user_data" first, then {file_id} in `images`. (A data: URL
//     inline works too, but the anchor is ~2 MB and the batch file cap is
//     200 MB; ids keep the JSONL tiny.)
//   - results come back as b64_json with the same usage block as realtime;
//     cost is billed from that block at half rate.
//   - a bad body fails the LINE, not the batch: it lands in error_file_id
//     with a 400 and the API's own message.
//
// Frames go into the same content-addressed cache the realtime provider
// uses (cacheEntry), so a frame paid for here is a cache hit for every
// later request with the same inputs — and a set whose frames were already
// generated realtime submits nothing.
import fs from 'node:fs';
import path from 'node:path';
import { cacheEntry, usdFor, loadEnv, cachePull, cachePush } from './image.mjs';
import { stripPng } from '../clean.mjs';

const API = 'https://api.openai.com/v1';

function apiKey(root) {
  const key = process.env.OPENAI_API_KEY || loadEnv(root).OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY missing (env or .env.local)');
  return key;
}

async function call(root, url, init = {}) {
  const r = await fetch(url, { ...init, headers: { authorization: `Bearer ${apiKey(root)}`, ...(init.headers ?? {}) } });
  if (!r.ok) {
    const body = await r.text();
    let msg = body.slice(0, 300);
    try { msg = JSON.parse(body).error?.message ?? msg; } catch { /* raw */ }
    throw new Error(`openai batch ${r.status}: ${msg}`);
  }
  return r;
}

/** Upload a file to the Files API; returns its id. */
export async function uploadFile(root, { bytes, name, purpose, type = 'application/octet-stream' }) {
  const fd = new FormData();
  fd.append('purpose', purpose);
  fd.append('file', new Blob([bytes], { type }), name);
  const j = await (await call(root, `${API}/files`, { method: 'POST', body: fd })).json();
  return j.id;
}

/** Delete an uploaded file (the anchor once its frames have landed). Never throws. */
export async function deleteFile(root, id) {
  try { await call(root, `${API}/files/${id}`, { method: 'DELETE' }); } catch { /* already gone */ }
}

/** How a reference image is named inside a batch edit body. */
export const refField = (fileId) => ({ file_id: fileId });

/**
 * Plan → batch. `frames` is [{ label, prompt, refs, size, quality, variant }]
 * as planSet() produces (with size/quality applied by the caller). Frames
 * already in the cache are skipped and reported in `cached`; if nothing is
 * left to draw, no batch is created and `id` is null.
 *
 * Every frame in one submission must hit the same endpoint (a batch has ONE
 * endpoint), so the caller submits the anchor (generations) and the edits
 * (edits) as two batches; aspirational sets are one batch of generations.
 */
export async function submitFrames(root, { cacheDir, frames, refFileIds = {} }) {
  const lines = [];
  const entries = {};
  let cached = 0;
  const endpoints = new Set();
  for (const f of frames) {
    const entry = cacheEntry({ root, cacheDir, prompt: f.prompt, size: f.size, quality: f.quality, refs: f.refs ?? [], variant: f.variant ?? 0 });
    entries[f.label] = { ...entry, label: f.label, prompt: f.prompt, refs: f.refs ?? [] };
    if (await cachePull(entry.id, entry.file)) { cached++; continue; }
    const edit = (f.refs ?? []).length > 0;
    endpoints.add(edit ? '/v1/images/edits' : '/v1/images/generations');
    const body = { model: entry.model, prompt: f.prompt, size: f.size, quality: f.quality, n: 1, output_format: 'png' };
    if (edit) {
      body.images = f.refs.map((r) => {
        const id = refFileIds[r];
        if (!id) throw new Error(`no uploaded file id for reference ${r}`);
        return refField(id);
      });
    }
    lines.push(JSON.stringify({ custom_id: f.label.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64), method: 'POST', url: edit ? '/v1/images/edits' : '/v1/images/generations', body }));
  }
  if (endpoints.size > 1) throw new Error('one batch, one endpoint: split generations and edits');
  if (!lines.length) return { id: null, submitted: 0, cached, entries };

  const [endpoint] = endpoints;
  const inputId = await uploadFile(root, { bytes: Buffer.from(lines.join('\n') + '\n'), name: 'frames.jsonl', purpose: 'batch', type: 'application/jsonl' });
  const j = await (await call(root, `${API}/batches`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ input_file_id: inputId, endpoint, completion_window: '24h' }),
  })).json();
  return { id: j.id, status: j.status, submitted: lines.length, cached, entries, endpoint };
}

/** { status, counts, outputFileId, errorFileId } — status is the API's own lifecycle word. */
export async function batchStatus(root, id) {
  const j = await (await call(root, `${API}/batches/${id}`)).json();
  return {
    id, status: j.status, counts: j.request_counts,
    outputFileId: j.output_file_id, errorFileId: j.error_file_id,
    done: ['completed', 'failed', 'expired', 'cancelled'].includes(j.status),
    errors: j.errors?.data ?? null,
  };
}

async function fileLines(root, id) {
  if (!id) return [];
  const t = await (await call(root, `${API}/files/${id}/content`)).text();
  return t.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/**
 * Collect a finished batch into the cache. For each custom_id in `entries`
 * (from submitFrames) the PNG is written to its content-addressed path,
 * stripped of the provider's C2PA manifest, and billed at the batch rate from
 * the usage block. Returns { files: {label: path}, usd, failed: {label: msg} }.
 */
export async function collectFrames(root, { id, entries }) {
  const st = await batchStatus(root, id);
  if (!st.done) throw new Error(`batch ${id} is ${st.status}`);
  const out = { files: {}, usd: 0, failed: {}, status: st.status };
  const safe = (l) => l.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64);
  const byId = Object.fromEntries(Object.keys(entries).map((l) => [safe(l), l]));
  for (const row of await fileLines(root, st.outputFileId)) {
    row.custom_id = byId[row.custom_id] ?? row.custom_id;
    const e = entries[row.custom_id];
    if (!e) continue;
    const body = row.response?.body;
    const b64 = body?.data?.[0]?.b64_json;
    if (row.response?.status_code !== 200 || !b64) { out.failed[row.custom_id] = JSON.stringify(body?.error ?? body).slice(0, 200); continue; }
    fs.mkdirSync(path.dirname(e.file), { recursive: true });
    fs.writeFileSync(e.file, stripPng(Buffer.from(b64, 'base64')));
    await cachePush(e.id, e.file);
    out.files[row.custom_id] = e.file;
    out.usd += usdFor(body.usage) / 2;
  }
  for (const row of await fileLines(root, st.errorFileId)) {
    row.custom_id = byId[row.custom_id] ?? row.custom_id;
    out.failed[row.custom_id] = row.error?.message ?? row.response?.body?.error?.message ?? 'failed';
  }
  // frames that were already cached at submit time count as delivered
  for (const [label, e] of Object.entries(entries)) {
    if (!out.files[label] && !out.failed[label] && fs.existsSync(e.file)) out.files[label] = e.file;
  }
  out.usd = +out.usd.toFixed(5);
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** CLI/test convenience: poll until the batch is done. */
export async function waitForBatch(root, id, { everyMs = 20000, maxMs = 24 * 3600 * 1000, onTick } = {}) {
  const t0 = Date.now();
  for (;;) {
    const st = await batchStatus(root, id);
    onTick?.(st);
    if (st.done) return st;
    if (Date.now() - t0 > maxMs) throw new Error(`batch ${id} did not finish within ${maxMs} ms`);
    await sleep(everyMs);
  }
}
