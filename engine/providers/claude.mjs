// Claude, as the reasoning stage of the slideshow pipeline.
//
// The SKILL is the system prompt: it defines the job, the output contract and
// the self-check. Nothing here re-states the creative rules — duplicating them
// in code is how the two drift apart, and the skill file is the thing the user
// edits.
//
// The contract says "emit a single JSON object, no prose". Models comply with
// that most of the time, so the parser is written for the rest of the time:
// fenced blocks are unwrapped, and a leading sentence is tolerated by scanning
// for the outermost balanced object rather than trusting the first brace.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

/** Per-million token rates, Claude 5 family. */
export const RATES = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 2, out: 10 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-fable-5': { in: 10, out: 50 },
};

export const ledger = { calls: 0, inTok: 0, outTok: 0, usd: 0, entries: [] };

export function costReport() {
  return { calls: ledger.calls, inputTokens: ledger.inTok, outputTokens: ledger.outTok, usd: +ledger.usd.toFixed(4), entries: ledger.entries };
}

function loadEnv(root) {
  const f = path.join(root, '.env.local');
  if (!fs.existsSync(f)) return {};
  return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

/** The outermost balanced {...}, so a stray preamble does not break parsing. */
function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fence ? fence[1] : text;
  const start = body.indexOf('{');
  if (start < 0) throw new Error('no JSON object in response');
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(body.slice(start, i + 1));
  }
  throw new Error('unbalanced JSON object in response');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One completion, retried on the transient failures only.
 *
 * @param {object} o
 * @param {string} o.root
 * @param {string} o.system   the skill text
 * @param {string} o.user     the job spec
 * @param {string} [o.model]
 * @param {number} [o.maxTokens]
 */
export async function complete(o) {
  const { root, system, user, model = 'claude-opus-5', maxTokens = 16000, label = 'blueprint' } = o;
  const env = loadEnv(root);
  const key = env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY missing from .env.local');

  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
      body: JSON.stringify({
        model, max_tokens: maxTokens, system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      let msg = body.slice(0, 300);
      try { msg = JSON.parse(body).error?.message ?? msg; } catch { /* raw */ }
      last = new Error(`anthropic ${r.status}: ${msg}`);
      if (r.status !== 429 && r.status < 500) throw last;
      await sleep(2000 * 2 ** attempt);
      continue;
    }
    const j = await r.json();
    // A refusal returns 200 with a stop_reason, so it must be checked before
    // the content is read — otherwise it looks like an empty response.
    if (j.stop_reason === 'refusal') {
      throw new Error(`model declined: ${j.stop_details?.category ?? 'unspecified'}`);
    }
    const text = (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    const rate = RATES[model] ?? RATES['claude-opus-5'];
    const usd = (j.usage.input_tokens / 1e6) * rate.in + (j.usage.output_tokens / 1e6) * rate.out;
    ledger.calls += 1; ledger.inTok += j.usage.input_tokens; ledger.outTok += j.usage.output_tokens; ledger.usd += usd;
    ledger.entries.push({ label, model, in: j.usage.input_tokens, out: j.usage.output_tokens, usd: +usd.toFixed(5) });
    return { text, usage: j.usage, usd, stop: j.stop_reason };
  }
  throw last;
}

/** Complete and parse, retrying once with the parser error fed back. */
export async function completeJson(o) {
  const first = await complete(o);
  try {
    return { data: extractJson(first.text), usd: first.usd, raw: first.text };
  } catch (e) {
    const retry = await complete({
      ...o,
      label: `${o.label ?? 'blueprint'}-retry`,
      user: `${o.user}\n\nYour previous reply could not be parsed (${e.message}). Reply with the JSON object only — no prose, no code fence.`,
    });
    return { data: extractJson(retry.text), usd: first.usd + retry.usd, raw: retry.text };
  }
}
