// A local stand-in for Dodo Payments, for laptops only. It answers the two
// API calls the app makes (create a checkout, open the customer portal),
// serves a hosted-checkout page with a Pay button, and on Pay sends the same
// signed webhooks Dodo would (Standard Webhooks: webhook-id, -timestamp,
// -signature) to the app. Nothing here touches the real Dodo.
//
//   DODO_WEBHOOK_SECRET=whsec_… APP=http://127.0.0.1:3100 node tools/dodo-sim.mjs
//
// Point the app at it with DODO_API_BASE=http://127.0.0.1:3400 (dev only),
// DODO_API_KEY=sim and DODO_PRODUCTS=solo=pdt_sim_solo,grind=pdt_sim_grind,
// agency=pdt_sim_agency,p100=pdt_sim_p100,p250=pdt_sim_p250,p600=pdt_sim_p600
import http from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';

if (process.env.VERCEL || process.env.NODE_ENV === 'production') { console.error('dodo-sim is for laptops only'); process.exit(1); }
const PORT = Number(process.env.DODO_SIM_PORT || 3400);
const APP = (process.env.APP || 'http://127.0.0.1:3100').replace(/\/$/, '');
const SECRET = process.env.DODO_WEBHOOK_SECRET || '';
if (!SECRET) { console.error('set DODO_WEBHOOK_SECRET (whsec_ + base64) to the same value the app has'); process.exit(1); }
const KEY = Buffer.from(SECRET.replace(/^whsec_/, ''), 'base64');

const PRODUCTS = {
  pdt_sim_solo:   { name: 'Clipper',    cents: 1600,  kind: 'plan', slides: 200 },
  pdt_sim_grind:  { name: 'Pro',        cents: 3200,  kind: 'plan', slides: 500 },
  pdt_sim_agency: { name: 'Studio',     cents: 7900,  kind: 'plan', slides: 1500 },
  pdt_sim_p100:   { name: '100 slides', cents: 800,   kind: 'pack' },
  pdt_sim_p250:   { name: '250 slides', cents: 1800,  kind: 'pack' },
  pdt_sim_p600:   { name: '600 slides', cents: 4000,  kind: 'pack' },
};
const sessions = new Map();
const customers = new Map(); // email -> customer_id
const log = [];

const money = (c) => `$${(c / 100).toFixed(2)}`;
const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#F4F5F7;font-family:Manrope,Helvetica,Arial,sans-serif;color:#111}.card{max-width:460px;margin:48px auto;background:#fff;border-radius:16px;box-shadow:0 10px 40px -20px rgba(0,0,0,.35);padding:30px}h1{font-size:20px;margin:0 0 6px}.tag{display:inline-block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;margin-bottom:18px}.row{display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid #E5E7EB}.total{font-weight:700;font-size:18px}button,.btn{display:block;width:100%;margin-top:22px;padding:14px;border:0;border-radius:10px;background:#111;color:#fff;font-size:15px;font-weight:700;cursor:pointer;text-align:center;text-decoration:none}input{width:100%;padding:11px;border:1px solid #D1D5DB;border-radius:8px;margin:6px 0 12px;font:inherit}pre{background:#F4F5F7;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;word-break:break-word}small{color:#6B7280}</style></head><body><div class="card">${body}</div></body></html>`;

async function send(type, data) {
  const id = `msg_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const ts = Math.floor(Date.now() / 1000);
  const body = JSON.stringify({ business_id: 'bus_sim', type, timestamp: new Date().toISOString(), data });
  const sig = 'v1,' + createHmac('sha256', KEY).update(`${id}.${ts}.${body}`).digest('base64');
  const res = await fetch(`${APP}/api/webhooks/dodo`, { method: 'POST', headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': sig }, body });
  const text = await res.text();
  const entry = { type, id, status: res.status, reply: text.slice(0, 300) };
  log.push(entry); console.log(`→ ${type} ${res.status} ${text.slice(0, 120)}`);
  return entry;
}

const readJson = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } }); });
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const html = (res, code, s) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8' }); res.end(s); };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  if (req.method === 'POST' && p === '/checkouts') {
    const b = await readJson(req);
    const id = `cks_${randomUUID().slice(0, 8)}`;
    const email = b.customer?.email || 'buyer@example.com';
    if (!customers.has(email)) customers.set(email, `cus_${randomUUID().slice(0, 8)}`);
    sessions.set(id, { id, cart: b.product_cart || [], email, customer_id: customers.get(email), metadata: b.metadata || {}, return_url: b.return_url || `${APP}/app` });
    return json(res, 200, { session_id: id, checkout_url: `http://127.0.0.1:${PORT}/checkout/${id}` });
  }
  if (req.method === 'POST' && /^\/customers\/[^/]+\/customer-portal\/session$/.test(p)) {
    const cid = p.split('/')[2];
    return json(res, 200, { link: `http://127.0.0.1:${PORT}/portal/${cid}` });
  }
  if (req.method === 'GET' && p.startsWith('/checkout/')) {
    const s = sessions.get(p.split('/')[2]);
    if (!s) return html(res, 404, page('Not found', '<h1>No such checkout</h1>'));
    const rows = s.cart.map((c) => { const pr = PRODUCTS[c.product_id] || { name: c.product_id, cents: 0 }; return `<div class="row"><span>${pr.name}${pr.kind === 'plan' ? ' · monthly' : ''}</span><span>${money(pr.cents * (c.quantity || 1))}</span></div>`; }).join('');
    const total = s.cart.reduce((n, c) => n + ((PRODUCTS[c.product_id]?.cents || 0) * (c.quantity || 1)), 0);
    return html(res, 200, page('Checkout · Dodo (simulated)', `<span class="tag">Dodo Payments · simulated · test mode</span><h1>The Future Clips</h1><small>${s.email}</small>${rows}<div class="row total"><span>Total</span><span>${money(total)}</span></div>
      <form method="post" action="/checkout/${s.id}/pay"><label><small>Card number</small><input value="4242 4242 4242 4242" readonly></label><button type="submit">Pay ${money(total)}</button></form><small>No card is charged. On Pay, the same signed webhooks Dodo sends go to ${APP}.</small>`));
  }
  if (req.method === 'POST' && /^\/checkout\/[^/]+\/pay$/.test(p)) {
    const s = sessions.get(p.split('/')[2]);
    if (!s) return html(res, 404, page('Not found', '<h1>No such checkout</h1>'));
    const results = [];
    const now = new Date(); const next = new Date(now.getTime() + 30 * 864e5);
    const customer = { customer_id: s.customer_id, email: s.email };
    for (const c of s.cart) {
      const pr = PRODUCTS[c.product_id]; if (!pr) continue;
      if (pr.kind === 'plan') {
        const subscription_id = `sub_${randomUUID().slice(0, 8)}`;
        results.push(await send('subscription.active', { payload_type: 'Subscription', subscription_id, product_id: c.product_id, customer, metadata: s.metadata, status: 'active', previous_billing_date: now.toISOString(), next_billing_date: next.toISOString(), recurring_pre_tax_amount: pr.cents, currency: 'USD' }));
        results.push(await send('payment.succeeded', { payload_type: 'Payment', payment_id: `pay_${randomUUID().slice(0, 8)}`, subscription_id, product_cart: [{ product_id: c.product_id, quantity: 1 }], customer, metadata: s.metadata, total_amount: pr.cents, settlement_amount: pr.cents, currency: 'USD', status: 'succeeded' }));
      } else {
        results.push(await send('payment.succeeded', { payload_type: 'Payment', payment_id: `pay_${randomUUID().slice(0, 8)}`, product_cart: [{ product_id: c.product_id, quantity: c.quantity || 1 }], customer, metadata: s.metadata, total_amount: pr.cents, settlement_amount: pr.cents, currency: 'USD', status: 'succeeded' }));
      }
    }
    // a duplicate delivery, as Dodo retries sometimes: the app must answer duplicate
    return html(res, 200, page('Paid · Dodo (simulated)', `<span class="tag">Dodo Payments · simulated</span><h1>Payment complete</h1><small>Webhooks delivered to the app:</small><pre>${results.map((r) => `${r.type}  →  ${r.status}  ${r.reply}`).join('\n')}</pre><a class="btn" href="${s.return_url}">Back to The Future Clips</a>`));
  }
  if (req.method === 'GET' && p.startsWith('/portal/')) {
    return html(res, 200, page('Customer portal · Dodo (simulated)', `<span class="tag">Dodo Payments · simulated</span><h1>Manage your subscription</h1><small>Customer ${p.split('/')[2]}. In the real portal: card, invoices, cancel.</small><a class="btn" href="${APP}/app?page=settings&tab=plan">Back to The Future Clips</a>`));
  }
  if (req.method === 'GET' && p === '/') {
    return html(res, 200, page('Dodo simulator', `<span class="tag">Dodo Payments · simulated</span><h1>Products</h1>${Object.entries(PRODUCTS).map(([id, pr]) => `<div class="row"><span>${pr.name} <small>${id}</small></span><span>${money(pr.cents)}</span></div>`).join('')}<small>Webhooks sent so far: ${log.length}</small>`));
  }
  if (req.method === 'GET' && p === '/log') return json(res, 200, log);
  json(res, 404, { error: `no route ${req.method} ${p}` });
}).listen(PORT, '127.0.0.1', () => console.log(`dodo-sim on http://127.0.0.1:${PORT}  →  webhooks to ${APP}`));
