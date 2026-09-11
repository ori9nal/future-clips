// Download the Pinterest reference set collected in the browser.
//
//   node tools/fetch-pinterest.mjs
//
// Pinterest serves the same asset at several widths under a size-prefixed path
// (/236x/, /474x/, /564x/, /736x/, /originals/). The grid only ever renders a
// thumbnail, so we walk DOWN from /originals/ and take the first size that
// actually exists — a 236px thumb is useless for reading type and layout.
//
// These are third-party designs kept as a reference corpus, the same way
// `Carousel examples/` already is. Source URLs are recorded alongside so every
// image can be traced back to its pin.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'reference/pinterest';
const SIZES = ['originals', '736x', '564x', '474x', '236x'];

const sets = [
  { name: 'carousel', file: `${OUT}/_paths-carousel.txt`, query: 'graphic design carousel' },
  { name: 'design', file: `${OUT}/_paths-design.txt`, query: 'graphic design' },
];

const manifest = [];
let ok = 0, fail = 0;

for (const set of sets) {
  if (!fs.existsSync(set.file)) { console.log(`skip ${set.name}: no ${set.file}`); continue; }
  const rel = fs.readFileSync(set.file, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  const dir = path.join(OUT, set.name);
  fs.mkdirSync(dir, { recursive: true });
  console.log(`\n── ${set.name}: ${rel.length} pins`);

  for (const r of rel) {
    const stem = r.split('/').pop();
    const dest = path.join(dir, stem);
    if (fs.existsSync(dest)) { console.log(`   have ${stem}`); ok++; continue; }

    let saved = false;
    for (const size of SIZES) {
      const url = `https://i.pinimg.com/${size}/${r}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 4096) continue;   // a placeholder, not a picture
        fs.writeFileSync(dest, buf);
        manifest.push({ file: path.join(dir, stem).replace(/\\/g, '/'), url, size, query: set.query, bytes: buf.length });
        console.log(`   ${size.padEnd(9)} ${stem}  ${(buf.length / 1024).toFixed(0)}KB`);
        saved = true; ok++;
        break;
      } catch { /* try the next size down */ }
    }
    if (!saved) { console.log(`   FAIL ${stem}`); fail++; }
  }
}

fs.writeFileSync(path.join(OUT, 'SOURCES.json'), JSON.stringify({
  note: 'Third-party designs collected from Pinterest as a visual reference corpus. Not our work, not for redistribution — kept to characterise the format the way "Carousel examples/" is.',
  collected: new Date().toISOString(),
  items: manifest,
}, null, 2));

console.log(`\n${ok} downloaded, ${fail} failed → ${OUT}`);
