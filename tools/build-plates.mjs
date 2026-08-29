// Fetch full-bleed BACKGROUND plates for the depth format. Plates are never
// matted — they are graded and composited whole — so this path skips the ONNX
// worker entirely and is therefore fast.
//   node --env-file=.env.local tools/build-plates.mjs --niche fitness
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sourceStock, creditFor } from '../engine/source/stock.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const NICHE = arg('--niche', 'fitness');
const KEEP = Number(arg('--keep', 2));
const cfg = JSON.parse(fs.readFileSync('library/niches.json', 'utf8'));
const queries = cfg.niches?.[NICHE]?.plates || [];
if (!queries.length) { console.error(`no plate queries for "${NICHE}"`); process.exit(2); }

const OUT = path.join('assets/library', NICHE, 'plates');
fs.mkdirSync(OUT, { recursive: true });
const mf = path.join('assets/library', NICHE, 'plates.json');
const manifest = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')) : { niche: NICHE, kind: 'plates', items: [] };
const known = new Set(manifest.items.map((i) => i.id));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);

for (const q of queries) {
  console.log(`\n── ${q}`);
  // 'plate' mood: calm and mid-toned, because type sits on top of it
  const found = await sourceStock(q, { mood: 'plate', take: KEEP * 3, perProvider: 10, orientation: 'portrait',
    onLog: (m) => console.log('   ' + m) });
  let kept = 0;
  for (const c of found) {
    if (kept >= KEEP) break;
    const id = `${c.candidate.provider}-${c.candidate.id}`;
    if (known.has(id)) continue;
    const file = path.join(OUT, `${slug(q)}-${id}.jpg`);
    // store at canvas scale: 1080x1350 cover
    await sharp(c.buf).resize(1080, 1350, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 88 }).toFile(file);
    manifest.items.push({ id, query: q, file: file.split(String.fromCharCode(92)).join('/'), probe: c.probe, credit: creditFor(c.candidate) });
    known.add(id); kept++;
    console.log(`   KEEP ${path.basename(file)}`);
  }
}
fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));
console.log(`\nplates: ${manifest.items.length} in ${mf}`);
