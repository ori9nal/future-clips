// Reject see-through library subjects — they read as half-erased on white.
//   node tools/translucency-check.mjs --niche fitness --kind people [--apply]
import fs from 'node:fs';
import { translucency, TRANSLUCENCY_MAX } from '../../engine/_attic/source/cutout.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const NICHE = arg('--niche', 'fitness'), KIND = arg('--kind', 'people');
const APPLY = process.argv.includes('--apply');
const mf = `assets/library/${NICHE}/${KIND}.json`;
const m = JSON.parse(fs.readFileSync(mf, 'utf8'));

const keep = [];
for (const it of m.items) {
  const d = await translucency(fs.readFileSync(it.file));
  it.translucency = d.translucency;
  const bad = d.translucency > TRANSLUCENCY_MAX;
  console.log(`${bad ? 'DROP' : 'KEEP'}  ${it.id.padEnd(26)} translucency=${d.translucency}`);
  if (bad) { if (APPLY) for (const f of [it.file, it.bwFile]) { try { fs.unlinkSync(f); } catch {} } }
  else keep.push(it);
}
if (APPLY) { m.items = keep; fs.writeFileSync(mf, JSON.stringify(m, null, 2)); }
console.log(`
${keep.length} kept (max translucency ${TRANSLUCENCY_MAX})`);
