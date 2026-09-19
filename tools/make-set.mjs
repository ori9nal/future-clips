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
const id = args.campaign, instruction = args.ask;
// slides=7 means exactly seven; slides=6-8 (or 6..8) is a range the model picks inside
const slidesArg = String(args.slides ?? 8);
const rangeM = slidesArg.match(/^(\d+)\s*(?:-|\.\.)\s*(\d+)$/);
const slides = rangeM ? { min: +rangeM[1], max: +rangeM[2] } : Number(slidesArg);
if (!id || !instruction) { console.error('usage: make-set campaign=<id> ask="..." [slides=8] [style=native]'); process.exit(1); }

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${id}.json`), 'utf8'));
const styleId = args.style ?? spec.content?.style ?? 'native';

console.log(`\n▸ ${spec.brand} — "${instruction}" (${slides} slides, ${styleId})`);
const t = Date.now();
const { content, verdict, usd, attempts, failed, count } = await generateContent({
  root: ROOT, spec, instruction, slides, styleId, model: args.model,
});
console.log(`  copy: ${attempts} attempt${attempts > 1 ? 's' : ''} · $${usd.toFixed(4)} · ${verdict.pass ? 'COMPLIANT' : 'NON-COMPLIANT'} · ${count} slides`);
verdict.failures.forEach((f) => console.log(`    FAIL ${f}`));
verdict.warnings.forEach((w) => console.log(`    warn ${w}`));
if (failed) { console.error('  refusing to render a non-compliant set'); process.exit(2); }

const appScreen = args.screen ?? spec.assets?.app_screen;
const appIcon = args.icon ?? spec.assets?.app_icon;

let photos = [];
let artUsd = 0;
let look = args.look ?? spec.assets?.look ?? 'phone';
let world = null;
if (args.art === 'ai') {
  // Generate the imagery instead of sourcing it. The direction — scenes
  // enforced into shot types, the world, whether the person is held across
  // days — is engine/scenes.mjs direct(), shared with the lanes.
  const { direct } = await import('../engine/scenes.mjs');
  const d = direct({ spec, content, styleId, seed: args.seed ?? `${id}|${instruction}`, look: args.look, mode: args.mode });
  world = d.world; look = d.look;
  if (world) console.log(`  world: ${world.label} · grade: ${look} · shots: ${(d.shots ?? []).join(' ')}`);
  const appScreenAbs = appScreen ? path.join(ROOT, appScreen) : null;
  process.stdout.write(`  art: generating ${d.scenes.length} frames at ${args.quality ?? 'medium'} (${d.mode}${d.days ? ', days' : ''})… `);
  const art = await generateSet({
    root: ROOT, cacheDir: path.join(ROOT, 'output/gen/cache'),
    subject: d.subject, scenes: d.scenes, look,
    quality: args.quality ?? 'medium', w: 1080, h: 1920, id, mode: d.mode, days: d.days, wides: d.wides,
    appScreen: appScreenAbs && fs.existsSync(appScreenAbs) ? appScreenAbs : null,
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
renderable.assets = { ...renderable.assets, look, ...(args.pairing ? { pairing: args.pairing } : {}) };
if (args.art === 'ai') renderable.assets.photos = { dir: '.', credit: 'gpt-image-2' };
const outDir = path.join(ROOT, 'output/sets', `${id}-${styleId}`);
const r = await render({ spec: renderable, root: ROOT, styleId, outDir });
// a style that generates its own art (bedrock's figures) reports what it spent
if (r.artUsd) { artUsd += r.artUsd; console.log(`  figures: $${r.artUsd.toFixed(4)}`); }
// the model's copy and the frames it was given, so a bad round can be read
fs.writeFileSync(path.join(outDir, 'content.json'), JSON.stringify({ content, photos }, null, 2));
const pairing = renderable.content.pairing ?? null;
if (pairing) console.log(`  fonts: ${pairing.id} (${pairing.head} / ${pairing.body})`);
fs.writeFileSync(path.join(outDir, 'post.json'), JSON.stringify({
  caption: content.caption, bio: content.bio, hashtags: content.hashtags,
  compliance: verdict,
  world: world ? { id: world.id, label: world.label } : null, look, pairing,
  cost: { copy: +usd.toFixed(4), art: +artUsd.toFixed(4), total: +(usd + artUsd).toFixed(4) },
}, null, 2));
console.log(`  ${r.files.length} slides · ${r.canvas.w}x${r.canvas.h} · ${((Date.now() - t) / 1000).toFixed(1)}s`);
console.log(`  caption: ${content.caption}`);
console.log(`  bio:     ${content.bio}`);
console.log(`  cost: copy $${usd.toFixed(4)}${artUsd ? ` + art $${artUsd.toFixed(4)}` : ''} = $${(usd + artUsd).toFixed(4)}`);
console.log(`  ${outDir}`);
