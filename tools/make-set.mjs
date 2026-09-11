// Few words in, a compliant rendered set out.
import fs from 'node:fs';
import path from 'node:path';
import { generateContent, toRenderable } from '../engine/generate.mjs';
import { generateSet } from '../engine/art.mjs';
import { costReport as imageCost } from '../engine/providers/image.mjs';
import { render } from '../engine/styles/registry.mjs';
import { costReport } from '../engine/providers/claude.mjs';

const ROOT = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
const id = args.campaign, instruction = args.ask, slides = Number(args.slides ?? 8);
if (!id || !instruction) { console.error('usage: make-set campaign=<id> ask="..." [slides=8] [style=native]'); process.exit(1); }

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${id}.json`), 'utf8'));
const styleId = args.style ?? spec.content?.style ?? 'native';

console.log(`\n▸ ${spec.brand} — "${instruction}" (${slides} slides, ${styleId})`);
const t = Date.now();
const { content, verdict, usd, attempts, failed } = await generateContent({
  root: ROOT, spec, instruction, slideCount: slides,
});
console.log(`  copy: ${attempts} attempt${attempts > 1 ? 's' : ''} · $${usd.toFixed(4)} · ${verdict.pass ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
verdict.failures.forEach((f) => console.log(`    FAIL ${f}`));
verdict.warnings.forEach((w) => console.log(`    warn ${w}`));
if (failed) { console.error('  refusing to render a non-compliant set'); process.exit(2); }

const appScreen = args.screen ?? spec.assets?.app_screen;
const appIcon = args.icon ?? spec.assets?.app_icon;

let photos = [];
let artUsd = 0;
if (args.art === 'ai') {
  // Generate the imagery instead of sourcing it. Scenes come from the copy
  // step, so the pictures illustrate the story rather than sitting beside it.
  let scenes = [
    content.hook?.scene,
    ...(content.ranked ?? []).map((r) => r.scene),
    content.closer?.scene,
  ].map((s, i) => s || `the person, scene ${i + 1}`);

  if (styleId === 'feed') {
    // The model does not get to pick between a Porsche and a train seat. A
    // dreary or repeated scene is swapped for one from the bank, in code.
    const appIndex = 1 + (content.ranked ?? []).findIndex((r) => r.showsApp);
    const { enforce } = await import('../engine/scenes.mjs');
    const e = enforce(scenes, { niche: spec.niche, appIndex: appIndex > 0 ? appIndex : -1, seed: id });
    if (e.replaced.length) console.log(`  scenes: replaced ${e.replaced.length} of ${scenes.length} (slides ${e.replaced.map((i) => i + 1).join(', ')})`);
    scenes = e.scenes;
  }
  process.stdout.write(`  art: generating ${scenes.length} frames at ${args.quality ?? 'medium'}… `);
  const art = await generateSet({
    root: ROOT, cacheDir: path.join(ROOT, 'output/gen/cache'),
    subject: content.subject ?? 'A person in their late twenties, plain dark clothing.',
    scenes, look: spec.assets?.look ?? 'cinematic',
    quality: args.quality ?? 'medium', w: 1080, h: 1920, id,
    // feed has no recurring person by design; everything else holds one
    mode: args.mode ?? (styleId === 'feed' ? 'aspirational' : 'subject'),
  });
  artUsd = art.usd;
  console.log(`$${art.usd.toFixed(4)} (${art.cached} cached)`);
  // hand the renderer absolute paths rather than ids from a photo folder
  photos = art.files;
} else {
  const photoDir = spec.assets?.photos?.dir ? path.join(ROOT, spec.assets.photos.dir) : null;
  photos = photoDir && fs.existsSync(photoDir)
    ? fs.readdirSync(photoDir).filter((f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith('_')).map((f) => f.replace(/\.\w+$/, ''))
    : [];
}
const renderable = toRenderable(spec, content, { appScreen, appIcon, photos });
if (args.art === 'ai') renderable.assets = { ...renderable.assets, photos: { dir: '.', credit: 'gpt-image-2' } };
const outDir = path.join(ROOT, 'output/sets', `${id}-${styleId}`);
const r = await render({ spec: renderable, root: ROOT, styleId, outDir });
fs.writeFileSync(path.join(outDir, 'post.json'), JSON.stringify({
  caption: content.caption, bio: content.bio, hashtags: content.hashtags,
  compliance: verdict,
  cost: { copy: +usd.toFixed(4), art: +artUsd.toFixed(4), total: +(usd + artUsd).toFixed(4) },
}, null, 2));
console.log(`  ${r.files.length} slides · ${r.canvas.w}x${r.canvas.h} · ${((Date.now() - t) / 1000).toFixed(1)}s`);
console.log(`  caption: ${content.caption}`);
console.log(`  bio:     ${content.bio}`);
console.log(`  cost: copy $${usd.toFixed(4)}${artUsd ? ` + art $${artUsd.toFixed(4)}` : ''} = $${(usd + artUsd).toFixed(4)}`);
console.log(`  ${outDir}`);
