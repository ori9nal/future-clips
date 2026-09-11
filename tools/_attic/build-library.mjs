// Build a per-niche cutout library from licensed stock.
//
//   node --env-file=.env.local tools/build-library.mjs --niche fitness [--kind people]
//                                                      [--per-query 8] [--keep 2]
//
// This is the compounding asset the corrected brief describes: matting costs
// ~5.2 CPU-seconds and is paid ONCE per subject, so a library built now makes
// every future carousel in that niche nearly free. Everything is cached by
// content hash, so re-running only pays for genuinely new candidates.
//
// Every kept cutout carries its attribution record. Nothing ships without one.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { sourceStock, creditFor } from '../../engine/_attic/source/stock.mjs';
import { cutout, cleanMatte, toBW, subjectTone, judgeCutout } from '../../engine/_attic/source/cutout.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const NICHE = arg('--niche', 'fitness');
const KIND = arg('--kind', 'people');
const PER_QUERY = Number(arg('--per-query', 8));
const KEEP = Number(arg('--keep', 2));

const cfg = JSON.parse(fs.readFileSync('library/niches.json', 'utf8'));
const queries = cfg.niches?.[NICHE]?.[KIND];
if (!queries) { console.error(`no queries for niche "${NICHE}" kind "${KIND}"`); process.exit(2); }

const OUT = path.join('assets/library', NICHE, KIND);
fs.mkdirSync(OUT, { recursive: true });

const manifestPath = path.join('assets/library', NICHE, `${KIND}.json`);
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { niche: NICHE, kind: KIND, items: [] };
const known = new Set(manifest.items.map((i) => i.provider + ':' + i.id));

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

let considered = 0, matted = 0, kept = 0, rejected = [];

for (const q of queries) {
  console.log(`\n── ${q}`);
  const found = await sourceStock(q, {
    mood: 'subject', take: PER_QUERY, perProvider: PER_QUERY * 2, orientation: 'portrait',
    onLog: (m) => console.log('   ' + m),
  });
  let keptForQuery = 0;
  for (const cand of found) {
    if (keptForQuery >= KEEP) break;
    const tag = cand.candidate.provider + ':' + cand.candidate.id;
    if (known.has(tag)) { console.log(`   skip ${tag} (already in library)`); continue; }
    considered++;
    let r;
    try { r = await cutout(cand.buf); } catch (e) { console.log(`   matte failed ${tag}: ${e.message}`); continue; }
    matted++;
    if (!r.verdict.pass) {
      rejected.push({ tag, why: r.verdict.fail });
      console.log(`   reject ${tag}: ${r.verdict.fail.join('; ')}`);
      continue;
    }
    const name = `${slug(q)}-${cand.candidate.provider}-${cand.candidate.id}.png`;
    const file = path.join(OUT, name);
    fs.writeFileSync(file, r.buf);

    // A B&W variant is what F1 actually composites; cache it beside the colour
    // original so the render path never grades at request time.
    const bwFile = file.replace(/\.png$/, '-bw.png');
    // clean before measuring or writing: the raw matte carries a translucent
    // haze that both inflates the bounding box and shows as a ghost on white
    const cleaned = (await cleanMatte(r.buf)).buf;
    fs.writeFileSync(file, cleaned);
    const meta = await sharp(cleaned).metadata();
    fs.writeFileSync(bwFile, await toBW(cleaned));
    const tone = await subjectTone(cleaned);
    const toneVerdict = judgeCutout({ ...r.stats, ...tone });
    if (!toneVerdict.pass) {
      rejected.push({ tag, why: toneVerdict.fail });
      console.log(`   reject ${tag}: ${toneVerdict.fail.join('; ')}`);
      for (const g of [file, bwFile]) { try { fs.unlinkSync(g); } catch {} }
      continue;
    }

    manifest.items.push({
      id: `${cand.candidate.provider}-${cand.candidate.id}`,
      provider: cand.candidate.provider,
      query: q,
      file: file.replace(/\\/g, '/'),
      bwFile: bwFile.replace(/\\/g, '/'),
      w: meta.width, h: meta.height,
      aspect: +(meta.width / meta.height).toFixed(3),
      coverage: r.stats.coverage, fill: r.stats.fill, halo: r.stats.halo, ...tone,
      edgeSoftness: r.stats.edgeSoftness,
      probe: cand.probe,
      credit: creditFor(cand.candidate),
    });
    known.add(tag);
    kept++; keptForQuery++;
    console.log(`   KEEP  ${name}  ${meta.width}x${meta.height} coverage=${r.stats.coverage} fill=${r.stats.fill} halo=${r.stats.halo}`);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`\nconsidered ${considered}, matted ${matted}, kept ${kept}, library now ${manifest.items.length} items`);
console.log(`manifest: ${manifestPath}`);
if (rejected.length) {
  console.log(`\nrejected ${rejected.length}:`);
  for (const r of rejected.slice(0, 12)) console.log(`  ${r.tag}: ${r.why.join('; ')}`);
}
