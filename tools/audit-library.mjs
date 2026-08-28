// Re-audit an existing library against the CURRENT gates without re-matting.
//   node tools/audit-library.mjs --niche fitness --kind people [--prune]
import fs from 'node:fs';
import { componentStats, haloScore, judgeCutout } from '../engine/source/cutout.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const NICHE = arg('--niche', 'fitness'), KIND = arg('--kind', 'people');
const PRUNE = process.argv.includes('--prune');
const mf = `assets/library/${NICHE}/${KIND}.json`;
const m = JSON.parse(fs.readFileSync(mf, 'utf8'));

const keep = [], drop = [];
for (const it of m.items) {
  const buf = fs.readFileSync(it.file);
  const comp = await componentStats(buf);
  const halo = await haloScore(buf); // always fresh: a stored halo predates darkFringe
  const stats = { ...it, ...comp, ...halo, bbox: { x: 0, y: 0, w: it.w, h: it.h } };
  const v = judgeCutout(stats);
  Object.assign(it, comp);
  if (v.pass) { keep.push(it); console.log(`PASS  ${it.id}  comps=${comp.components} largest=${comp.largestShare} halo=${it.halo}`); }
  else { drop.push({ it, why: v.fail }); console.log(`DROP  ${it.id}  ${v.fail.join('; ')}`); }
}
console.log(`\n${keep.length} pass, ${drop.length} fail`);
if (PRUNE && drop.length) {
  for (const d of drop) for (const f of [d.it.file, d.it.bwFile]) { try { fs.unlinkSync(f); } catch {} }
  m.items = keep;
  fs.writeFileSync(mf, JSON.stringify(m, null, 2));
  console.log(`pruned ${drop.length}, library now ${keep.length}`);
} else if (drop.length) {
  m.items = m.items;
  fs.writeFileSync(mf, JSON.stringify(m, null, 2));
  console.log('(re-run with --prune to remove failures)');
}
