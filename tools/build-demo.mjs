// Builds the demo workspace's fixtures from sets this machine rendered:
// resized slides under public/demo/<set>/slide-N.webp (shipped with the app,
// so the hosted demo needs no Storage) and lib/demo-manifest.ts with the
// sets, their copy, and the campaigns they belong to (a .ts module so it
// bundles everywhere without JSON import attributes). Idempotent; re-run
// after rendering better sets. Laptops only (needs output/ and ImageMagick).
//
//   node tools/build-demo.mjs            # the default pick (10 sets)
//   node tools/build-demo.mjs apex-strength-feed-priority signal-hooks-poster-priority …
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectPng } from '../engine/clean.mjs';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'public', 'demo');
const MANIFEST = path.join(ROOT, 'lib', 'demo-manifest.ts');
const STYLES = 'feed|native|bedrock|mascot|rail|clinical|editorial|document|poster|pastel';
// Re-picked by Product 2026-09-19 (E11) against the visual target. Out:
// vestra-closet (a fashion brief rendered as night-city cars, Product 3/10),
// ledger-money (the same fault, 5), meridian-vo2 (near-empty clinical pages
// with one repeated face, 5), summit-craft (abstract design cards, 4),
// signal-hooks (striking, but marketing is not a clipping niche, 5) — all
// five are QUALITY.md F26/F27. In: the four families built from the owner's
// own references (86 / 87 / 84 / 83 against those references) and the
// illustrated programme, which shows a style that is not photography.
const DEFAULT = [
  'apex-strength-feed-priority', 'tradelens-app-reachify-feed-priority',
  'attire-outfit-planner-feed-priority', 'pitchly-football-coach-feed-priority',
  'clearlog-skin-tracker-feed-priority', 'dosis-glp1-tracker-feed-priority',
  'core-creatine-feed-priority', 'fuel-prep-native-priority',
  'northbound-trail-rail-priority', 'bedrock-form-bedrock-priority',
];
const picks = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
const magick = fs.existsSync('/usr/bin/magick') ? 'magick' : 'convert';

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function campaignSpec(id) {
  // campaigns/<id>.json is the brief on disk (the same shape the database row carries); the key is the file name
  const c = readJson(path.join(ROOT, 'campaigns', `${id}.json`)) ?? readJson(path.join(ROOT, 'assets', 'campaigns', `${id}.json`));
  if (!c) return null;
  return {
    id, brand: c.brand ?? id, product: c.product ?? '', niche: c.niche ?? '',
    requirements: { min_slides: c.requirements?.min_slides ?? 5, max_slides: c.requirements?.max_slides ?? 10 },
    assets: { palette: c.assets?.palette ?? [] }, content: { style: c.content?.style ?? null }, guidance: c.guidance ?? null,
  };
}

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const sets = []; const specs = new Map();
let day = 1;
for (const name of picks) {
  const dir = path.join(ROOT, 'output', 'sets', name);
  const m = name.match(new RegExp(`^(.*)-(${STYLES})-(priority|batch)$`));
  if (!m || !fs.existsSync(dir)) { console.error(`skip ${name}: not a lane set on this machine`); continue; }
  const [, campaign, style, lane] = m;
  const post = readJson(path.join(dir, 'post.json')) ?? {};
  const content = readJson(path.join(dir, 'content.json'))?.content ?? null;
  const slides = fs.readdirSync(dir).filter((f) => /^slide-\d+\.png$/.test(f)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  if (!slides.length) { console.error(`skip ${name}: no slides`); continue; }
  const spec = specs.get(campaign) ?? campaignSpec(campaign);
  if (!spec) { console.error(`skip ${name}: no assets/campaigns/${campaign}.json`); continue; }
  specs.set(campaign, spec);
  fs.mkdirSync(path.join(OUT, name), { recursive: true });
  const urls = [];
  for (const f of slides) {
    const outName = f.replace(/\.png$/, '.webp');
    execFileSync(magick, [path.join(dir, f), '-resize', '540x', '-quality', '74', path.join(OUT, name, outName)], { stdio: ['ignore', 'ignore', 'inherit'] });
    urls.push(`/demo/${name}/${outName}`);
  }
  // what the metadata gate did for this set: its own record when the render
  // wrote one, and in every case a fresh check that the shipped slides are pixels
  const verified = slides.every((f) => { try { return inspectPng(path.join(dir, f)).clean; } catch { return false; } });
  const clean = { ...(post.clean ?? { frames: 0, stripped: [] }), slides: slides.length, verified };
  sets.push({
    clean,
    id: `demo-${name}`, name, campaign_id: campaign, style, lane, slides: slides.length,
    ask: content?.hook?.lines?.join(' ') ?? name.replace(/-/g, ' '),
    caption: post.caption ?? content?.caption ?? null,
    hashtags: content?.hashtags ?? [], bio: content?.bio ?? null,
    cost_usd: post.cost?.total ?? null, days_ago: day, urls,
  });
  day += day < 3 ? 1 : 3; // recent ones close together, then spread over the month
  console.error(`${name}: ${slides.length} slides → public/demo/${name}/`);
}
const manifest = { built_at: new Date().toISOString(), sets, specs: [...specs.values()].sort((a, b) => a.brand.localeCompare(b.brand)) };
fs.writeFileSync(MANIFEST, '// Generated by tools/build-demo.mjs; do not edit by hand.\nconst manifest = ' + JSON.stringify(manifest, null, 2) + ' as const;\nexport default manifest;\n');
const bytes = execFileSync('du', ['-sb', OUT]).toString().split('\t')[0];
console.error(`${sets.length} sets, ${specs.size} campaigns, ${(bytes / 1024 / 1024).toFixed(1)} MB under public/demo, manifest at lib/demo-manifest.ts`);
