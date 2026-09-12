// Anthropic Message Batches — the queued lane for copy.
//
// Same request text as the realtime call (engine/generate.mjs builds it once
// for both), submitted as a batch and collected later. The API prices batch
// requests at half the realtime rate; that halving is the whole reason the
// queued tier can be sold at $19 for 350 slides (see COST.md).
//
// A batch is opaque until it ends: there is no partial read. So the worker's
// job is submit → remember the batch id on the set → poll on a cron → judge
// the result when it lands → resubmit with feedback if the copy failed the
// compliance check. Every function here is one of those steps; nothing
// blocks except the `waitForBatch` helper the CLI uses.
import fs from 'node:fs';
import path from 'node:path';
import { RATES } from './claude.mjs';

const API = 'https://api.anthropic.com/v1/messages/batches';
const VERSION = '2023-06-01';

/** Batch prices: half of realtime, per million tokens. */
export const BATCH_RATES = Object.fromEntries(Object.entries(RATES).map(([m, r]) => [m, { in: r.in / 2, out: r.out / 2 }]));

function loadEnv(root) {
  const f = path.join(root, '.env.local');
  if (!fs.existsSync(f)) return {};
  return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

function apiKey(root) {
  const key = process.env.ANTHROPIC_API_KEY || loadEnv(root).ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing (env or .env.local)');
  return key;
}

async function call(root, url, init = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { 'x-api-key': apiKey(root), 'anthropic-version': VERSION, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!r.ok) {
    const body = await r.text();
    let msg = body.slice(0, 300);
    try { msg = JSON.parse(body).error?.message ?? msg; } catch { /* raw */ }
    throw new Error(`anthropic batch ${r.status}: ${msg}`);
  }
  return r;
}

/**
 * Submit one batch. `requests` is [{ customId, model, system, user, maxTokens }].
 * Returns the batch id to store on the set.
 */
export async function submitBatch(root, requests) {
  const body = {
    requests: requests.map((q) => ({
      custom_id: q.customId,
      params: {
        model: q.model ?? 'claude-opus-5',
        max_tokens: q.maxTokens ?? 8000,
        system: q.system,
        messages: [{ role: 'user', content: q.user }],
      },
    })),
  };
  const r = await call(root, API, { method: 'POST', body: JSON.stringify(body) });
  const j = await r.json();
  return { id: j.id, status: j.processing_status, counts: j.request_counts };
}

/** Current state of a batch: { status: 'in_progress' | 'ended', counts, resultsUrl }. */
export async function batchStatus(root, id) {
  const r = await call(root, `${API}/${id}`);
  const j = await r.json();
  return { id, status: j.processing_status, counts: j.request_counts, resultsUrl: j.results_url, expiresAt: j.expires_at };
}

/**
 * Results of an ended batch, keyed by custom_id. Each entry is
 * { ok, text, usage, usd, error }. usd is billed at the batch rate from the
 * usage block the API returns — never estimated.
 */
export async function batchResults(root, id) {
  const st = await batchStatus(root, id);
  if (st.status !== 'ended') throw new Error(`batch ${id} is ${st.status}, not ended`);
  const r = await call(root, st.resultsUrl);
  const lines = (await r.text()).split('\n').filter(Boolean);
  const out = {};
  for (const line of lines) {
    const row = JSON.parse(line);
    const res = row.result;
    if (res.type === 'succeeded') {
      const m = res.message;
      const text = (m.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      const rate = BATCH_RATES[m.model] ?? BATCH_RATES['claude-opus-5'];
      const usd = (m.usage.input_tokens / 1e6) * rate.in + (m.usage.output_tokens / 1e6) * rate.out;
      out[row.custom_id] = { ok: true, text, usage: m.usage, usd: +usd.toFixed(5), stop: m.stop_reason, model: m.model };
    } else {
      out[row.custom_id] = { ok: false, error: res.error?.message ?? res.type, usd: 0 };
    }
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** CLI/test convenience: poll until ended (default every 15 s, up to 24 h). */
export async function waitForBatch(root, id, { everyMs = 15000, maxMs = 24 * 3600 * 1000, onTick } = {}) {
  const t0 = Date.now();
  for (;;) {
    const st = await batchStatus(root, id);
    onTick?.(st);
    if (st.status === 'ended') return st;
    if (Date.now() - t0 > maxMs) throw new Error(`batch ${id} did not end within ${maxMs} ms`);
    await sleep(everyMs);
  }
}
