// Run the reference-feature extractor over a corpus of carousel posts and emit
// measured distributions.
//
//   node mining/analyse.mjs [--dir "Carousel examples"] [--covers-only]
//
// Output shape maps 1:1 to the `reference_features` table, so the Apify path
// (mining/scrape.mjs) writes the same rows for scraped posts. The only thing
// the local corpus lacks is engagement + captions, which is exactly what the
// scrape supplies.
import fs from 'node:fs';
import path from 'node:path';
import { slideFeatures } from './features.mjs';
import { subjectFeatures } from './subject.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const ROOT = arg('--dir', 'Carousel examples');
const COVERS_ONLY = process.argv.includes('--covers-only');
const OUT = 'mining/reference_features.json';

const IMG = /\.(jpe?g|png)$/i;

/** A "post" is any directory that directly contains images. */
function findPosts(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const imgs = entries.filter((e) => e.isFile() && IMG.test(e.name)).map((e) => e.name);
  if (imgs.length) out.push({ dir, images: imgs });
  for (const e of entries) if (e.isDirectory()) findPosts(path.join(dir, e.name), out);
  return out;
}

/** Slide order from either `slide-N` or a trailing `(N)`. */
function slideIndex(name) {
  const a = name.match(/slide-(\d+)/i);
  if (a) return +a[1];
  const b = name.match(/\((\d+)\)\.[a-z]+$/i);
  if (b) return +b[1];
  const c = name.match(/(\d+)\.[a-z]+$/i);
  return c ? +c[1] : 0;
}

const posts = findPosts(ROOT).map((p) => ({
  ...p,
  images: p.images.slice().sort((a, b) => slideIndex(a) - slideIndex(b)),
}));

console.log(`corpus: ${posts.length} posts, ${posts.reduce((s, p) => s + p.images.length, 0)} slides\n`);

const rows = [];
for (const post of posts) {
  const id = path.relative(ROOT, post.dir).replace(/\\/g, '/') || path.basename(post.dir);
  const slides = [];
  for (let i = 0; i < post.images.length; i++) {
    if (COVERS_ONLY && i > 0) break;
    const file = path.join(post.dir, post.images[i]);
    const f = await slideFeatures(file);
    f.index = i + 1;
    if (i === 0) {
      try { f.subject = await subjectFeatures(file); }
      catch (e) { f.subjectError = String(e.message || e); }
    }
    slides.push(f);
  }
  rows.push({ postId: id, slideCount: post.images.length, slides });
  const c = slides[0];
  console.log(
    `${id.padEnd(26)} n=${String(post.images.length).padStart(2)}  ` +
    `bg=${c.bg.isWhite ? 'WHITE' : c.bg.isNearWhite ? 'near ' : c.bg.isDark ? 'dark ' : 'other'} ` +
    `luma=${String(c.bg.borderLuma).padStart(6)}  clusters=${c.chroma.clusters}  ` +
    `subj=${c.subject ? String(c.subject.coveragePct).padStart(5) + '%' : '  n/a'} ` +
    `bleed=[${c.subject ? c.subject.bleedEdges.join(',') : ''}]  ${c.type.guess}`
  );
}

fs.mkdirSync('mining', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ root: ROOT, ranAt: new Date().toISOString(), posts: rows }, null, 2));

// ------------------------------------------------------------- distributions
const covers = rows.map((r) => r.slides[0]);
const allSlides = rows.flatMap((r) => r.slides);
const pct = (n, d) => `${((100 * n) / d).toFixed(1)}%`;
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
const quartiles = (a) => { const s = a.slice().sort((x, y) => x - y); const q = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return [q(0.25), q(0.5), q(0.75)]; };

const line = (label, v) => console.log('  ' + String(label).padEnd(34) + v);

console.log('\n================ MEASURED DISTRIBUTIONS ================\n');
console.log('BACKGROUND (covers, n=' + covers.length + ')');
line('white (strict)', pct(covers.filter((c) => c.bg.isWhite).length, covers.length));
line('white or near-white', pct(covers.filter((c) => c.bg.isNearWhite).length, covers.length));
line('dark', pct(covers.filter((c) => c.bg.isDark).length, covers.length));
line('median border luma', median(covers.map((c) => c.bg.borderLuma)));

console.log('\nBACKGROUND (all slides, n=' + allSlides.length + ')');
line('white or near-white', pct(allSlides.filter((c) => c.bg.isNearWhite).length, allSlides.length));
line('dark', pct(allSlides.filter((c) => c.bg.isDark).length, allSlides.length));

console.log('\nCHROMATIC CLUSTERS (all slides)');
for (const k of [0, 1, 2, 3]) {
  const n = allSlides.filter((c) => (k === 3 ? c.chroma.clusters >= 3 : c.chroma.clusters === k)).length;
  line(k === 3 ? '3 or more' : `${k} cluster${k === 1 ? '' : 's'}`, `${pct(n, allSlides.length)}  (${n})`);
}
line('median chromatic pixel share', median(allSlides.map((c) => c.chroma.chromaticPct)) + '%');

const withSubj = covers.filter((c) => c.subject && c.subject.hasSubject);
console.log('\nSUBJECT (covers)');
line('cover has a matted subject', pct(withSubj.length, covers.length));
if (withSubj.length) {
  line('median subject coverage', median(withSubj.map((c) => c.subject.coveragePct)) + '%');
  line('bleeds >=1 edge', pct(withSubj.filter((c) => c.subject.bleedEdges.length).length, withSubj.length));
  const edges = {};
  for (const c of withSubj) for (const e of c.subject.bleedEdges) edges[e] = (edges[e] || 0) + 1;
  for (const [e, n] of Object.entries(edges).sort((a, b) => b[1] - a[1])) line(`  bleeds ${e}`, `${pct(n, withSubj.length)} (${n})`);
}

console.log('\nSLIDE COUNT');
const counts = rows.map((r) => r.slideCount);
line('quartiles (p25 / median / p75)', quartiles(counts).join(' / '));
line('range', Math.min(...counts) + ' - ' + Math.max(...counts));

console.log('\nTYPE (approximate, aggregate only)');
const guesses = {};
for (const s of allSlides) guesses[s.type.guess] = (guesses[s.type.guess] || 0) + 1;
for (const [g, n] of Object.entries(guesses).sort((a, b) => b[1] - a[1])) line(g, `${pct(n, allSlides.length)} (${n})`);
line('median type centroid (0=top,1=bot)', median(allSlides.map((s) => s.ink.typeCentroid).filter((v) => v != null)));
line('median ink coverage', median(allSlides.map((s) => s.ink.inkPct)) + '%');

console.log('\nFURNITURE (all slides)');
line('handle detected', pct(allSlides.filter((s) => s.furniture.handleLikely).length, allSlides.length));
line('arrow detected', pct(allSlides.filter((s) => s.furniture.arrowLikely).length, allSlides.length));

console.log('\nCANVAS');
const aspects = {};
for (const s of allSlides) { const k = s.aspect.toFixed(2); aspects[k] = (aspects[k] || 0) + 1; }
for (const [a, n] of Object.entries(aspects).sort((x, y) => y[1] - x[1]).slice(0, 4)) line(`aspect ${a}`, `${pct(n, allSlides.length)} (${n})`);

console.log(`\nwrote ${OUT}`);
