// Source a photo set that is ONE person.
//
// A first-person story told over pictures of five different people reads as
// fake, and that is worse than a plain set — it is the one failure that costs
// trust rather than just polish. Dealing stills at random from a mixed pool
// guarantees it.
//
// Two signals find a coherent shoot without any vision model:
//   photographer id  — one photographer, one session
//   sequential ids   — Pexels numbers an upload batch consecutively, so a run
//                      of near-adjacent ids from one photographer is almost
//                      always one shoot of one subject
//
// Both together are strong enough that the result only needs a glance to
// confirm, which is what the contact sheet is for.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const KEY = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/PEXELS_API_KEY=(.+)/) || [])[1]?.trim();
if (!KEY) throw new Error('PEXELS_API_KEY missing from .env.local');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
const tag = args.tag;
const queries = String(args.q ?? '').split('|').map((s) => s.trim()).filter(Boolean);
const want = Number(args.want ?? 8);
if (!tag || !queries.length) {
  console.error('usage: source-subject tag=trader q="query one|query two" [want=8]');
  process.exit(1);
}

/* gather */
const byPhotographer = new Map();
for (const q of queries) {
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=80&orientation=portrait`,
    { headers: { Authorization: KEY } });
  if (!r.ok) { console.log(`  ! "${q}" → HTTP ${r.status}`); continue; }
  for (const p of (await r.json()).photos ?? []) {
    if (!byPhotographer.has(p.photographer_id)) byPhotographer.set(p.photographer_id, { name: p.photographer, photos: new Map() });
    byPhotographer.get(p.photographer_id).photos.set(p.id, { id: p.id, src: p.src.large2x, w: p.width, h: p.height });
  }
  await new Promise((s) => setTimeout(s, 320));
}

/* cluster each photographer's ids into upload batches */
const shoots = [];
for (const [pid, g] of byPhotographer) {
  const list = [...g.photos.values()].sort((a, b) => a.id - b.id);
  let run = [list[0]];
  for (let i = 1; i < list.length; i++) {
    if (list[i].id - list[i - 1].id <= 60) run.push(list[i]);
    else { if (run.length >= 3) shoots.push({ pid, name: g.name, run }); run = [list[i]]; }
  }
  if (run.length >= 3) shoots.push({ pid, name: g.name, run });
}
shoots.sort((a, b) => b.run.length - a.run.length);

if (!shoots.length) {
  console.error('no coherent shoot found — widen the queries');
  process.exit(2);
}

const best = shoots[0];
console.log(`best shoot: ${best.name} · ${best.run.length} frames · ids ${best.run[0].id}–${best.run[best.run.length - 1].id}`);
console.log(`runners-up: ${shoots.slice(1, 4).map((s) => `${s.name} (${s.run.length})`).join(', ') || 'none'}`);

/* download, keeping only genuinely portrait frames */
const dir = path.join(ROOT, 'output/subjects', tag);
fs.mkdirSync(dir, { recursive: true });
const kept = [];
for (const p of best.run) {
  if (kept.length >= want) break;
  const f = path.join(dir, `${p.id}.jpg`);
  if (!fs.existsSync(f)) {
    const r = await fetch(p.src);
    if (!r.ok) continue;
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  const md = await sharp(f).metadata();
  if (md.height / md.width < 1.25) { fs.unlinkSync(f); continue; }
  kept.push(p.id);
}

fs.writeFileSync(path.join(dir, 'shoot.json'), JSON.stringify({
  tag, photographer: best.name, photographer_id: best.pid, ids: kept, credit: 'Pexels',
}, null, 2));

/* contact sheet — the claim "one person" needs a human glance to confirm */
const TW = 240, TH = 427, comps = [];
for (let i = 0; i < kept.length; i++) {
  comps.push({ input: await sharp(path.join(dir, `${kept[i]}.jpg`)).resize(TW, TH, { fit: 'cover' }).jpeg().toBuffer(), left: i * TW, top: 0 });
}
await sharp({ create: { width: Math.max(1, kept.length) * TW, height: TH, channels: 3, background: '#111' } })
  .composite(comps).jpeg({ quality: 86 }).toFile(path.join(dir, 'sheet.jpg'));

console.log(`kept ${kept.length} → output/subjects/${tag}  ·  review output/subjects/${tag}/sheet.jpg`);
