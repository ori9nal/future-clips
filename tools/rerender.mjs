// Re-render a set from its saved copy and frames — no model calls, no cost.
//
// Every make-set run writes content.json (the copy and the frame paths). A
// font change, a numbering fix or a caption tweak should not cost another
// forty cents of image generation to look at, so this re-runs only the
// render step. `pairing=` pins a font pairing, `look=` a grade.
import fs from 'node:fs';
import path from 'node:path';
import { toRenderable } from '../engine/generate.mjs';
import { render } from '../engine/styles/registry.mjs';

const ROOT = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
const id = args.campaign, styleId = args.style ?? 'feed';
if (!id) { console.error('usage: rerender campaign=<id> [style=feed] [pairing=<id>] [look=<look>]'); process.exit(1); }

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${id}.json`), 'utf8'));
const outDir = path.join(ROOT, 'output/sets', `${id}-${styleId}`);
const { content, photos } = JSON.parse(fs.readFileSync(path.join(outDir, 'content.json'), 'utf8'));
const post = JSON.parse(fs.readFileSync(path.join(outDir, 'post.json'), 'utf8'));

spec.content = { ...spec.content, style: styleId };
const renderable = toRenderable(spec, content, { appScreen: spec.assets?.app_screen, appIcon: spec.assets?.app_icon, photos });
renderable.assets = { ...renderable.assets, look: args.look ?? post.look, photos: { dir: '.', credit: 'gpt-image-2' }, ...(args.pairing ? { pairing: args.pairing } : {}) };
const t = Date.now();
const r = await render({ spec: renderable, root: ROOT, styleId, outDir });
post.pairing = renderable.content.pairing ?? post.pairing;
post.look = renderable.assets.look;
fs.writeFileSync(path.join(outDir, 'post.json'), JSON.stringify(post, null, 2));
console.log(`  re-rendered ${r.files.length} slides · fonts ${post.pairing?.id} · ${((Date.now() - t) / 1000).toFixed(1)}s · cost $0`);
