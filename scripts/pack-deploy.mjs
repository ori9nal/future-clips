// Pack the app's source for a Vercel MCP deploy from the local checkout.
//
// The Vercel MCP deploy tool takes files inline (base64), and the app's
// tracked source is ~500 KB — more than one tool call carries. Gzipped it
// is ~130 KB, so the deployment is three files: package.json (so Vercel
// detects Next.js), vercel.json, and src.tgz holding everything else. The
// install command unpacks the tarball before `npm ci`; `prebuild` fetches
// the 56 fonts from Google Fonts (tools/fetch-fonts.mjs).
//
// Only tracked files go in (git ls-files), so the deploy is exactly the
// committed tree: no .env.local, no output/, nothing untracked. The repo is
// the source of truth; this is the transport until the Vercel GitHub App is
// installed on the repo's account, after which a git push deploys instead.
//
//   node scripts/pack-deploy.mjs      → deploy/src.tgz, deploy/files.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'deploy');
fs.mkdirSync(OUT, { recursive: true });

// what the running app needs; fonts come from prebuild, campaigns from the
// database, campaign assets (character ref, app screens) from the assets
// bucket at render time, and nothing under output/, design/ or the corpus
// --minimal: the auth-gated app without the render engine. Every route and
// page that needs engine/ checks lib/engine.ts engineAvailable() and answers
// 503 / a plain notice, so this package is complete on its own terms.
const MINIMAL = process.argv.includes('--minimal');
const INCLUDE = [
  'app', 'components', 'lib', ...(MINIMAL ? [] : ['engine', 'tools/fetch-fonts.mjs']),
  'middleware.ts', 'next.config.ts', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vercel.json', '.env.production',
];
for (const p of INCLUDE) if (!fs.existsSync(p)) throw new Error(`missing ${p}`);

// tracked files only, under the include roots
const tracked = execFileSync('git', ['ls-files', '-z', '--', ...INCLUDE], { cwd: ROOT }).toString().split('\0').filter(Boolean);
const list = path.join(OUT, 'files.txt');
fs.writeFileSync(list, tracked.join('\n') + '\n');

const tgz = path.join(OUT, 'src.tgz');
// relative paths: GNU tar on Windows reads `D:` as a remote host
execFileSync('tar', ['-czf', path.relative(ROOT, tgz), '--format=ustar', '-T', path.relative(ROOT, list)], { stdio: 'inherit', cwd: ROOT });
const b64 = fs.readFileSync(tgz).toString('base64');

// no engine means no fonts to fetch: the minimal package drops prebuild
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
if (MINIMAL) delete pkg.scripts.prebuild;
const files = [
  { file: 'package.json', data: JSON.stringify(pkg, null, 2) + '\n' },
  { file: 'vercel.json', data: fs.readFileSync('vercel.json', 'utf8') },
  { file: 'src.tgz', data: b64, encoding: 'base64' },
];
fs.writeFileSync(path.join(OUT, 'files.json'), JSON.stringify(files));
console.log(`${tracked.length} tracked files → src.tgz ${(fs.statSync(tgz).size / 1024).toFixed(0)} KB → base64 ${(b64.length / 1024).toFixed(0)} KB`);
console.log('projectSettings: framework nextjs, installCommand "tar xzf src.tgz && npm ci --no-audit --no-fund", buildCommand "npm run build"');
