// Render one campaign in one style (or in its declared style).
import fs from 'node:fs';
import path from 'node:path';
import { render, byId, stylesFor } from '../engine/styles/registry.mjs';

const ROOT = process.cwd();
const [id, styleArg] = process.argv.slice(2);
if (!id) { console.error('usage: render-style <campaign-id> [style]'); process.exit(1); }

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${id}.json`), 'utf8'));
const styleId = styleArg || spec.content?.style || 'native';
const outDir = path.join(ROOT, 'output/sets', `${id}-${styleId}`);

const t = Date.now();
const r = await render({ spec, root: ROOT, styleId, outDir });
console.log(`${spec.brand.padEnd(10)} ${styleId.padEnd(10)} ${String(r.files.length).padStart(2)} slides  ${r.canvas.w}x${r.canvas.h}  ${((Date.now() - t) / 1000).toFixed(1)}s`);
if (!styleArg) {
  console.log('  also suits:', stylesFor(spec.niche).filter((s) => s.fit !== 'stretch' && s.id !== styleId).map((s) => s.id).join(', ') || '—');
}
