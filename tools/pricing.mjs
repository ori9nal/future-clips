// The allowance calculator: how many slides a plan can include while the
// business keeps its margin after the agency's share and payment fees.
//
//   node tools/pricing.mjs                       # defaults: measured costs, 50% margin, 15% agency, 5% fees
//   node tools/pricing.mjs batch=0.02 priority=0.05 margin=0.5 agency=0.15 fees=0.05 use=0.6
//
// Model, per plan with price P per month:
//   budget for provider cost = P × (1 − margin − agency − fees)
//   cost at full use         = batch_slides × c_batch + priority_slides × c_priority (HD draws 3 slides, so it is already 3× inside the allowance)
//   with expected utilisation u, the same margin holds at cost × u, so the allowance can be budget / (c × u)
// Prints the largest allowances that hold the margin at 100% use and at the
// given utilisation, next to what the plans hold today (migration 0010).
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), Number(a.slice(i + 1))]; }));
const cBatch = args.batch ?? 0.027;      // $/slide, measured (COST.md, output/sets *-batch)
const cPrio = args.priority ?? 0.058;    // $/slide, measured over 18 priority sets
const margin = args.margin ?? 0.50, agency = args.agency ?? 0.15, fees = args.fees ?? 0.05, use = args.use ?? 0.6;
const share = 1 - margin - agency - fees;
const plans = [
  // there is no priority tier (0030) and every customer's slide goes through
  // the batch API (0031): the whole allowance is costed at c_batch
  { id: 'solo',   label: 'Clipper', price: 16, batch: 200,  priority: 0 },
  { id: 'grind',  label: 'Pro',     price: 32, batch: 400,  priority: 0 },
  { id: 'agency', label: 'Studio',  price: 79, batch: 1000, priority: 0 },
];
const packs = [{ id: 'p100', slides: 100, price: 8 }, { id: 'p250', slides: 250, price: 18 }, { id: 'p600', slides: 600, price: 40 }];
console.log(`cost/slide batch $${cBatch} priority $${cPrio} · margin ${margin * 100}% · agency ${agency * 100}% · fees ${fees * 100}% → ${Math.round(share * 100)}% of price may go to providers · expected use ${use * 100}%\n`);
console.log('plan     price  budget   today (batch+prio)  cost@100%  margin@100%  margin@use  | max batch@100% (keeping prio)  max batch@use');
for (const p of plans) {
  const budget = p.price * share;
  const cost = p.batch * cBatch + p.priority * cPrio;
  const m100 = 1 - agency - fees - cost / p.price, mUse = 1 - agency - fees - (cost * use) / p.price;
  const maxBatch100 = Math.max(0, Math.floor((budget - p.priority * cPrio) / cBatch));
  const maxBatchUse = Math.max(0, Math.floor((budget - p.priority * cPrio * use) / (cBatch * use)));
  console.log(`${p.label.padEnd(8)} $${String(p.price).padEnd(4)} $${budget.toFixed(2).padStart(6)}   ${String(p.batch).padStart(4)}+${String(p.priority).padEnd(3)}          $${cost.toFixed(2).padStart(6)}    ${(m100 * 100).toFixed(0).padStart(4)}%        ${(mUse * 100).toFixed(0).padStart(4)}%     | ${String(maxBatch100).padStart(5)}                         ${String(maxBatchUse).padStart(5)}`);
}
console.log('\npacks (one-off; a pack is spent on the batch lane): price → cost@100% and margin after agency+fees');
for (const k of packs) { const cost = k.slides * cBatch; console.log(`  ${k.id.padEnd(5)} ${String(k.slides).padStart(4)} slides $${k.price}  cost $${cost.toFixed(2)}  margin ${((1 - agency - fees - cost / k.price) * 100).toFixed(0)}%`); }
