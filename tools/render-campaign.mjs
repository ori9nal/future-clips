// Render any campaign in any style. One entry point for the CLI and the UI.
import fs from 'node:fs';
import path from 'node:path';
import { renderCampaign, copyOf, preflightFonts } from '../engine/render-native.mjs';
import { logicCheck } from '../engine/judge.mjs';

const ROOT = process.cwd();
const [id, style = 'native'] = process.argv.slice(2);
if (!id) { console.error('usage: render-campaign <campaign-id> [native|mascot]'); process.exit(1); }

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${id}.json`), 'utf8'));
const outDir = path.join(ROOT, 'output/sets', `${id}-${style}`);

await preflightFonts(ROOT);
const logic = logicCheck(copyOf(spec));
const files = await renderCampaign({ spec, root: ROOT, style, outDir });

console.log(`${spec.brand} · ${style} · ${files.length} slides -> output/sets/${id}-${style}`);
console.log(`logic: ${logic.pass ? 'PASS' : 'FAIL'}`);
logic.failures.forEach((f) => console.log('  FAIL', f));
logic.warnings.forEach((w) => console.log('  warn', w));
