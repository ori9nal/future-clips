// Creates (or finds) The Future Clips' six Dodo products with the REST API
// and prints the DODO_PRODUCTS line. Idempotent by product name. Use it for
// the test-mode account, or to re-create the catalogue in a new business;
// the live catalogue was created on 2026-09-18 (OWNER-ACTIONS 14).
//
//   DODO_API_KEY=… DODO_ENV=test node tools/dodo-products.mjs
//   DODO_API_KEY=… DODO_ENV=test node tools/dodo-products.mjs webhook=https://host/api/webhooks/dodo
//
// The key is read from the environment or .env.local and never printed.
import fs from 'node:fs';
import path from 'node:path';

function loadEnv(root) {
  const f = path.join(root, '.env.local');
  if (!fs.existsSync(f)) return {};
  return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}
const env = { ...loadEnv(process.cwd()), ...process.env };
const key = env.DODO_API_KEY;
if (!key || key === 'sim') { console.error('needs a real DODO_API_KEY (environment or .env.local)'); process.exit(1); }
const base = env.DODO_ENV === 'live' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return i < 0 ? [a, true] : [a.slice(0, i), a.slice(i + 1)]; }));

async function api(p, init = {}) {
  const res = await fetch(`${base}${p}`, { ...init, headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${p} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
const monthly = (cents) => ({ type: 'recurring_price', currency: 'USD', price: cents, payment_frequency_count: 1, payment_frequency_interval: 'Month', subscription_period_count: 1, subscription_period_interval: 'Month', tax_inclusive: false, purchasing_power_parity: false });
const once = (cents) => ({ type: 'one_time_price', currency: 'USD', price: cents, tax_inclusive: false, purchasing_power_parity: false });
const WANTED = [
  { sku: 'solo',   name: 'Clipper',    price: monthly(1600), description: '200 slides a month. One saved character style, the hook library, no AI watermark. Batch delivery within the day.' },
  { sku: 'grind',  name: 'Pro',        price: monthly(3200), description: '500 slides a month plus 50 priority slides. Unlimited character styles, HD export, priority render queue, view tracking.' },
  { sku: 'agency', name: 'Studio',     price: monthly(7900), description: '1,500 slides a month plus 150 priority slides. Up to 5 seats, multi-account tracking, bulk generation, priority support.' },
  { sku: 'p100',   name: '100 slides', price: once(800),     description: 'A pack of 100 extra slides for your workspace. Spent after the monthly allowance; never expires.' },
  { sku: 'p250',   name: '250 slides', price: once(1800),    description: 'A pack of 250 extra slides for your workspace. Spent after the monthly allowance; never expires.' },
  { sku: 'p600',   name: '600 slides', price: once(4000),    description: 'A pack of 600 extra slides for your workspace. Spent after the monthly allowance; never expires.' },
];

const existing = (await api('/products?page_size=100')).items ?? [];
const out = [];
for (const w of WANTED) {
  const found = existing.find((p) => p.name === w.name);
  if (found) { out.push([w.sku, found.product_id, 'kept']); continue; }
  const p = await api('/products', { method: 'POST', body: JSON.stringify({ name: w.name, description: w.description, price: w.price, tax_category: 'saas', metadata: { sku: w.sku, app: 'the-future-clips' } }) });
  out.push([w.sku, p.product_id, 'created']);
}
for (const [sku, id, what] of out) console.error(`${what.padEnd(8)} ${sku.padEnd(7)} ${id}`);
if (args.webhook) {
  const hooks = (await api('/webhooks')).data ?? [];
  const found = hooks.find((h) => h.url === args.webhook);
  if (found) console.error(`webhook kept   ${found.id} ${found.url}`);
  else { const h = await api('/webhooks', { method: 'POST', body: JSON.stringify({ url: args.webhook, description: 'The Future Clips app (app/api/webhooks/dodo)', metadata: { app: 'the-future-clips' } }) }); console.error(`webhook created ${h.id} ${h.url}`); }
  console.error('the signing secret is in the Dodo dashboard (Developer → Webhooks); it goes into DODO_WEBHOOK_SECRET');
}
console.log(`DODO_PRODUCTS=${out.map(([sku, id]) => `${sku}=${id}`).join(',')}`);
