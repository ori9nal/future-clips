// Few words in, a compliant rendered set out.
import fs from 'node:fs';
import path from 'node:path';
import { generateContent, toRenderable } from '../engine/generate.mjs';
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

const photoDir = spec.assets?.photos?.dir ? path.join(ROOT, spec.assets.photos.dir) : null;
const photos = photoDir && fs.existsSync(photoDir)
  ? fs.readdirSync(photoDir).filter((f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith('_')).map((f) => f.replace(/\.\w+$/, ''))
  : [];
const renderable = toRenderable(spec, content, { appScreen: args.screen ?? spec.assets?.app_screen, photos });
const outDir = path.join(ROOT, 'output/sets', `${id}-${styleId}`);
const r = await render({ spec: renderable, root: ROOT, styleId, outDir });
fs.writeFileSync(path.join(outDir, 'post.json'), JSON.stringify({
  caption: content.caption, bio: content.bio, hashtags: content.hashtags,
  compliance: verdict, cost: { copy: +usd.toFixed(4) },
}, null, 2));
console.log(`  ${r.files.length} slides · ${r.canvas.w}x${r.canvas.h} · ${((Date.now() - t) / 1000).toFixed(1)}s`);
console.log(`  caption: ${content.caption}`);
console.log(`  bio:     ${content.bio}`);
console.log(`  ${outDir}`);
