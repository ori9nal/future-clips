// Acceptance test for the image API.
//
// gpt-image-2 shipped after this assistant's training cutoff, so the model id,
// the parameter names and the response shape are all assumptions until a real
// call returns. The handoff package guessed at them and never ran one. This
// probes the cheapest possible call and reports exactly what came back, so the
// provider is written against observed behaviour rather than inference.
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const KEY = env.OPENAI_API_KEY;
if (!KEY) throw new Error('OPENAI_API_KEY missing from .env.local');

const call = async (path, body) => {
  const t = Date.now();
  const r = await fetch(`https://api.openai.com/v1${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON error body */ }
  return { ok: r.ok, status: r.status, ms: Date.now() - t, json, text };
};

/* 1. what models can this key actually see? */
{
  const r = await fetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${KEY}` } });
  if (!r.ok) {
    console.log(`models list: HTTP ${r.status} — ${(await r.text()).slice(0, 200)}`);
  } else {
    const ids = (await r.json()).data.map((m) => m.id);
    const img = ids.filter((i) => /image|dall/i.test(i)).sort();
    console.log(`models visible: ${ids.length}`);
    console.log(`image models  : ${img.join(', ') || '(none)'}`);
  }
}

/* 2. the cheapest real generation, against each candidate id */
const candidates = [env.OPENAI_IMAGE_MODEL, 'gpt-image-2', 'gpt-image-1'].filter((v, i, a) => v && a.indexOf(v) === i);
for (const model of candidates) {
  const res = await call('/images/generations', {
    model, prompt: 'a plain flat mid-grey square, no detail', size: '1024x1024', quality: 'low', n: 1,
  });
  if (res.ok) {
    const d = res.json.data?.[0] ?? {};
    console.log(`\n${model}: OK ${res.ms}ms`);
    console.log(`  returns    : ${Object.keys(d).join(', ') || '(empty)'}`);
    console.log(`  b64 bytes  : ${d.b64_json ? Buffer.from(d.b64_json, 'base64').length : '—'}`);
    console.log(`  url        : ${d.url ? 'yes' : 'no'}`);
    console.log(`  usage      : ${JSON.stringify(res.json.usage ?? null)}`);
    if (d.b64_json) fs.writeFileSync(`output/_probe-${model}.png`, Buffer.from(d.b64_json, 'base64'));
    break;
  }
  console.log(`\n${model}: HTTP ${res.status} — ${res.json?.error?.message ?? res.text.slice(0, 300)}`);
}
