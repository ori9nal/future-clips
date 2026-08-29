// Build a PHOTOGRAPHIC object library.
//
// GAP.md: drawn objects read as emoji and cannot carry aspiration. The
// reference format works because its objects are photographs of real, specific,
// wanted things. So these are generated as product photography and then matted
// to clean cutouts.
//
// Uses a free, keyless generation endpoint, so this runs today without credits.
// The prompt suffix is FIXED across the whole library — that shared lighting and
// background is what makes a set read as one shoot rather than as clip art.
//
//   node tools/gen-library.mjs --niche fitness [--only shoe,medal]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { cutout } from '../engine/source/cutout.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const NICHE = arg('--niche', 'fitness');
const ONLY = (arg('--only', '') || '').split(',').filter(Boolean);

// One studio, one light, one background — stated identically every time.
const PRODUCT_SUFFIX =
  'isolated on a pure white seamless background, soft even studio lighting, ' +
  'sharp focus, high detail, commercial product photography, no text, no watermark';
const PERSON_SUFFIX =
  'full body, isolated on a plain light grey studio background, soft directional ' +
  'studio lighting, sharp focus, editorial photography, no text, no watermark';

const NICHES = {
  fitness: {
    objects: {
      'shoe':        'a worn carbon-plate racing shoe, three-quarter side view',
      'medal':       'a marathon finisher medal on a striped ribbon, hanging',
      'watch':       'a black sports GPS watch, face up, showing a run screen',
      'bottle':      'a matte insulated sports water bottle, standing upright',
      'tub':         'a tub of creatine supplement powder, label facing forward',
      'dumbbell':    'a single hex rubber dumbbell, side view',
      'kettlebell':  'a black cast iron kettlebell, side view',
      'foam-roller': 'a textured foam roller lying horizontally',
      'shaker':      'a protein shaker bottle with a black lid',
      'plate':       'a single olympic weight plate standing on edge',
      'gel':         'an energy gel sachet lying flat',
      'strap':       'a heart rate chest strap monitor, coiled',
    },
    people: {
      'runner':      'a lean male distance runner mid-stride in a plain singlet and shorts',
      'runner-w':    'a female distance runner mid-stride in a plain running kit',
      'lifter':      'a muscular male athlete standing, arms at sides, plain shorts',
      'resting':     'an exhausted athlete sitting on the floor, head down, after training',
    },
  },
};

const spec = NICHES[NICHE];
if (!spec) { console.error(`no spec for niche "${NICHE}"`); process.exit(2); }

const OUT = path.join('assets/library', NICHE);
fs.mkdirSync(path.join(OUT, 'objects'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'people'), { recursive: true });

const genUrl = (prompt, seed, w, h) =>
  `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
  `?width=${w}&height=${h}&nologo=true&model=flux&seed=${seed}`;

async function generate(prompt, seed, w, h) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(genUrl(prompt, seed + attempt * 101, w, h), {
        headers: { 'user-agent': 'Mozilla/5.0' },
      });
      if (!r.ok) continue;
      const b = Buffer.from(await r.arrayBuffer());
      if (b.length > 8000) return b;
    } catch { /* retry */ }
  }
  return null;
}

const manifest = { niche: NICHE, generatedAt: new Date().toISOString(), items: [] };
let made = 0, failed = 0, seed = 1000;

for (const [kind, suffix, greyscale] of [
  ['objects', PRODUCT_SUFFIX, false],
  ['people', PERSON_SUFFIX, true],
]) {
  for (const [id, subject] of Object.entries(spec[kind])) {
    if (ONLY.length && !ONLY.includes(id)) continue;
    seed += 7;
    const prompt = `professional photograph of ${subject}, ${suffix}`;
    process.stdout.write(`${kind}/${id} … `);

    const raw = await generate(prompt, seed, 1024, 1024);
    if (!raw) { console.log('GEN FAILED'); failed++; continue; }

    let r;
    try { r = await cutout(raw); }
    catch (e) { console.log(`matte failed — ${e.message}`); failed++; continue; }

    if (!r.verdict.pass) { console.log(`rejected: ${r.verdict.fail.join('; ')}`); failed++; continue; }

    const file = path.join(OUT, kind, `${id}.png`);
    fs.writeFileSync(file, r.buf);

    // RESEARCH.md 4b: objects keep their own colour, people go greyscale.
    let bwFile = null;
    if (greyscale) {
      bwFile = file.replace(/\.png$/, '-bw.png');
      await sharp(r.buf).greyscale().linear(1.14, -18).png({ compressionLevel: 9 }).toFile(bwFile);
    }

    const meta = await sharp(r.buf).metadata();
    manifest.items.push({
      id, kind, prompt,
      file: file.split(path.sep).join('/'),
      bwFile: bwFile ? bwFile.split(path.sep).join('/') : null,
      w: meta.width, h: meta.height,
      aspect: +(meta.width / meta.height).toFixed(3),
      coverage: r.stats.coverage, halo: r.stats.halo,
      provenance: 'ai-element',
    });
    made++;
    console.log(`ok ${meta.width}x${meta.height} coverage=${r.stats.coverage} halo=${r.stats.halo}`);
  }
}

fs.writeFileSync(path.join(OUT, 'generated.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${made} made, ${failed} failed -> ${OUT}/generated.json`);
