import fs from 'node:fs';
import path from 'node:path';
import { ingestBrief } from '../engine/ingest.mjs';
const ROOT = process.cwd();
const file = process.argv[2];
if (!file) { console.error('usage: ingest <brief.md>'); process.exit(1); }
const brief = fs.readFileSync(path.resolve(ROOT, file), 'utf8');
const t = Date.now();
const { spec, usd } = await ingestBrief({ root: ROOT, brief });
const out = path.join(ROOT, 'campaigns', `${spec.id}.json`);
fs.writeFileSync(out, JSON.stringify(spec, null, 2));
console.log(`${spec.brand} → ${path.relative(ROOT, out)}  ($${usd.toFixed(4)}, ${((Date.now() - t) / 1000).toFixed(1)}s)`);
