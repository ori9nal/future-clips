import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'Carousel examples';
function walk(dir, out=[]) {
  for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jpe?g|png|webp)$/i.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const rows = [];
for (const f of files) {
  try {
    const m = await sharp(f).metadata();
    rows.push({f, w:m.width, h:m.height, ratio:(m.width/m.height).toFixed(4)});
  } catch(e) { rows.push({f, err:e.message}); }
}
const byDim = {};
for (const r of rows) { const k = `${r.w}x${r.h} (${r.ratio})`; byDim[k]=(byDim[k]||0)+1; }
console.log('TOTAL IMAGES:', rows.length);
console.log('--- dimension histogram ---');
for (const [k,v] of Object.entries(byDim).sort((a,b)=>b[1]-a[1])) console.log(v.toString().padStart(4), k);
fs.writeFileSync('tools/corpus-meta.json', JSON.stringify(rows,null,1));
