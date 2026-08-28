// Regenerate B&W variants under the current tone targets and drop near-duplicate
// subjects (same shoot returned twice by a stock search).
//   node tools/dedupe-library.mjs --niche fitness --kind people [--apply]
import fs from 'node:fs';
import { toBW, perceptualHash, hammingDistance, DUPLICATE_DISTANCE } from '../engine/source/cutout.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const NICHE = arg('--niche', 'fitness'), KIND = arg('--kind', 'people');
const APPLY = process.argv.includes('--apply');
const mf = `assets/library/${NICHE}/${KIND}.json`;
const m = JSON.parse(fs.readFileSync(mf, 'utf8'));

const keep = [], dropped = [];
for (const it of m.items) {
  const buf = fs.readFileSync(it.file);
  if (APPLY) fs.writeFileSync(it.bwFile, await toBW(buf));
  it.phash = await perceptualHash(fs.readFileSync(it.bwFile));

  // Same photographer, same niche => almost always the same shoot: same model,
  // outfit and light, different pose. A perceptual hash does NOT catch this
  // (it measures pose, and the poses genuinely differ) but it is exactly what
  // reads as an error when two such frames land on consecutive slides.
  const sameAuthor = it.credit?.author
    ? keep.find((k) => k.credit?.provider === it.credit.provider && k.credit?.author === it.credit.author)
    : null;
  const clash = sameAuthor || keep.find((k) => hammingDistance(k.phash, it.phash) < DUPLICATE_DISTANCE);
  if (clash) {
    const why = sameAuthor ? `same photographer "${it.credit.author}"` : `phash distance ${hammingDistance(clash.phash, it.phash)}`;
    dropped.push({ id: it.id, like: clash.id, why });
    console.log(`DROP  ${it.id}  ~ ${clash.id} (${why})`);
    if (APPLY) for (const f of [it.file, it.bwFile]) { try { fs.unlinkSync(f); } catch {} }
    continue;
  }
  keep.push(it);
  console.log(`KEEP  ${it.id}`);
}
if (APPLY) { m.items = keep; fs.writeFileSync(mf, JSON.stringify(m, null, 2)); }
console.log(`\n${keep.length} kept, ${dropped.length} near-duplicates${APPLY ? ' removed' : ' (dry run — pass --apply)'}`);
