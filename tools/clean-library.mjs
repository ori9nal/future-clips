// Remove stray components from every cutout in a library, then re-audit.
//   node tools/clean-library.mjs --niche fitness --kind people
import fs from 'node:fs';
import sharp from 'sharp';
import { cleanMatte, componentStats, judgeCutout, toBW, subjectTone } from '../engine/source/cutout.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const NICHE = arg('--niche', 'fitness'), KIND = arg('--kind', 'people');
const mf = `assets/library/${NICHE}/${KIND}.json`;
const m = JSON.parse(fs.readFileSync(mf, 'utf8'));

const keep = [];
for (const it of m.items) {
  const src = fs.readFileSync(it.file);
  const { buf, removed, removedShare } = await cleanMatte(src);
  if (removed) {
    fs.writeFileSync(it.file, buf);
    fs.writeFileSync(it.bwFile, await toBW(buf));
    const meta = await sharp(buf).metadata();
    it.w = meta.width; it.h = meta.height; it.aspect = +(meta.width / meta.height).toFixed(3);
  }
  const comp = await componentStats(fs.readFileSync(it.file));
  Object.assign(it, comp, { cleanedShare: removedShare || 0 });
  const v = judgeCutout({ ...it, bbox: { x: 0, y: 0, w: it.w, h: it.h } });
  console.log(`${v.pass ? 'PASS' : 'DROP'}  ${it.id}  removed=${removedShare || 0}  comps=${comp.components} largest=${comp.largestShare}`);
  if (v.pass) keep.push(it); else { for (const f of [it.file, it.bwFile]) { try { fs.unlinkSync(f); } catch {} } }
}
m.items = keep;
fs.writeFileSync(mf, JSON.stringify(m, null, 2));
console.log(`\nlibrary now ${keep.length} items`);
