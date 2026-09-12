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
let look = args.look ?? spec.assets?.look ?? 'cinematic';
let world = null;
if (args.art === 'ai') {
  // Generate the imagery instead of sourcing it. Scenes come from the copy
  // step, so the pictures illustrate the story rather than sitting beside it.
  let scenes = [
    content.hook?.scene,
    ...(content.ranked ?? []).map((r) => r.scene),
    content.closer?.scene,
  ].map((s, i) => s || `the person, scene ${i + 1}`);

  // Feed imagery is enforced in code, and the set is locked to ONE world —
  // one time of day and palette, or for gym one location — which is what
  // makes six separate generations read as one post rather than six. The
  // world also picks the grade, so a bright midday set is not then crushed
  // into a night look by a hard-coded "cinematic".
  const { enforce, bankFor, BANK } = await import('../engine/scenes.mjs');
  const isGym = bankFor(spec.niche) === BANK.fitness;
  if (styleId === 'feed') {
    const appIndex = 1 + (content.ranked ?? []).findIndex((r) => r.showsApp);
    // the seed carries the ask, so two sets from one campaign land in
    // different worlds instead of the same one every time
    const e = enforce(scenes, {
      niche: spec.niche, appIndex: appIndex > 0 ? appIndex : -1, seed: args.seed ?? `${id}|${instruction}`,
      headings: (content.ranked ?? []).map((r) => r.name),
    });
    scenes = e.scenes;
    world = e.world;
    if (!args.look) look = world.look ?? look;
    console.log(`  world: ${world.label} · grade: ${look}`);
  }
  // The trading feed has no recurring person (a car, a pool, a window). The
  // gym feed IS one person — one lifter, one session — so it holds the
  // subject across frames exactly as the reference sets do.
  const mode = args.mode ?? (styleId === 'feed' && !isGym ? 'aspirational' : 'subject');
  process.stdout.write(`  art: generating ${scenes.length} frames at ${args.quality ?? 'medium'} (${mode})… `);
  const art = await generateSet({
    root: ROOT, cacheDir: path.join(ROOT, 'output/gen/cache'),
    subject: content.subject && content.subject !== 'none' ? content.subject : 'A lean muscular man in his early twenties, short dark hair, light stubble.',
    scenes, look,
    quality: args.quality ?? 'medium', w: 1080, h: 1920, id, mode,
    // the gym feed is one person across many days — hold the face, not the clothes
    days: styleId === 'feed' && isGym && world?.id === 'life',
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
