// Invent a whole campaign from a few words, then build a set from it.
//
// Nothing in here is hand-authored per campaign. The master prompt lives in
// this file; a user types a niche and the machine writes the brief, the brief
// is ingested into enforceable rules by the same extractor real briefs go
// through, the photography is sourced as ONE coherent shoot, the copy is
// generated and compliance-checked, and the set renders.
//
// The brief is written as PROSE on purpose. Having the model emit a spec
// directly would skip the extractor — and the extractor is the part that has to
// work on real agency briefs, so it should be exercised by every run rather
// than only by the ones a human pastes.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { complete, costReport as claudeCost } from '../engine/providers/claude.mjs';
import { ingestBrief } from '../engine/ingest.mjs';
import { generateContent, toRenderable } from '../engine/generate.mjs';
import { render } from '../engine/styles/registry.mjs';

const ROOT = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
const ask = args.niche;
if (!ask) { console.error('usage: invent-campaign niche="gym supplement brand, UK" [slides=8] [style=native]'); process.exit(1); }
const slides = Number(args.slides ?? 8);

/* ── the master prompt ──────────────────────────────────────────────────── */

const INVENT = `You invent realistic creator-marketing campaign briefs — the kind an agency sends to
clippers who get paid per thousand views.

Write the brief as PROSE, exactly as an agency would send it. Markdown headings and bullets.
No JSON.

A convincing brief has all of these, and they must be specific, not generic:

- The product, in one short paragraph. Name it. Say what it actually does.
- A naming rule if the client has one — many do ("always write X, never just Y"). Include one
  roughly half the time, and when you do, state plainly that a post breaking it does not meet
  the brief.
- Platform, content language, and audience requirements.
- Hard rules: what gets a post rejected. Include banned claims that fit the category — a
  supplement brand bans health claims, a finance app bans profit promises, a skincare brand
  bans "clinically proven".
- A placement rule tied to slide count, phrased as a small table, if the product is something
  that must be shown.
- Slide count guidance, a sentence on what performs, and the angles that work.
- Pay rate per 1,000 views, minimum payout, maximum per post, total budget.
- How and where clippers register.

Then, AFTER the brief, on its own line, output exactly:

---SOURCING---
{"photo_queries":["4-6 Pexels search phrases that would find ONE person in this niche photographed
across a single session — favour phrases like 'man working laptop home office' over 'business
concept'"],"subject_tag":"one-word-slug","style":"native","look":"cinematic|steel|sunlit|clean|ash"}

Rules: invent the brand, do not use a real company. Numbers must be plausible for the category.
Never write a brief that asks for medical, financial or legal advice.`;

/* ── 1. invent ──────────────────────────────────────────────────────────── */

console.log(`\n▸ inventing: "${ask}"`);
let t = Date.now();
const invented = await complete({
  root: ROOT, model: 'claude-opus-5', label: 'invent', maxTokens: 8000,
  system: INVENT, user: `Niche / product: ${ask}`,
});

const [briefText, sourcingRaw] = invented.text.split('---SOURCING---');
let sourcing = {};
try { sourcing = JSON.parse((sourcingRaw ?? '').match(/\{[\s\S]*\}/)?.[0] ?? '{}'); } catch { /* fall back below */ }
console.log(`  brief written · $${invented.usd.toFixed(4)} · ${((Date.now() - t) / 1000).toFixed(1)}s`);

/* ── 2. ingest, through the same extractor real briefs use ──────────────── */

t = Date.now();
const { spec, usd: ingestUsd } = await ingestBrief({ root: ROOT, brief: briefText.trim() });
fs.mkdirSync(path.join(ROOT, 'briefs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'briefs', `${spec.id}.md`), briefText.trim());
console.log(`  ${spec.brand} · rules extracted · $${ingestUsd.toFixed(4)} · ${((Date.now() - t) / 1000).toFixed(1)}s`);
const R = spec.rules ?? {};
if (R.required_phrase) console.log(`    naming: always "${R.required_phrase}"${R.never_bare ? `, never bare "${R.never_bare}"` : ''}`);
if (spec.requirements?.app_placement?.length) {
  console.log(`    placement: ${spec.requirements.app_placement.map((p) => `${p.when_slides.join('–')} → slide ${p.on_slides.join(' or ')}`).join(' · ')}`);
}
console.log(`    banned: ${(R.banned_claims ?? []).join(' · ') || 'none'}`);

/* ── 3. source ONE subject ──────────────────────────────────────────────── */

const tag = sourcing.subject_tag || spec.id;
const dir = path.join(ROOT, 'output/subjects', tag);
if (!fs.existsSync(path.join(dir, 'shoot.json'))) {
  const q = (sourcing.photo_queries ?? []).join('|');
  if (!q) { console.error('  the invention step returned no photo queries'); process.exit(2); }
  console.log(`  sourcing subject "${tag}"…`);
  execFileSync(process.execPath, [path.join(ROOT, 'tools/source-subject.mjs'), `tag=${tag}`, `q=${q}`, 'want=9'],
    { cwd: ROOT, stdio: 'inherit' });
} else {
  console.log(`  subject "${tag}" already sourced`);
}
const shoot = JSON.parse(fs.readFileSync(path.join(dir, 'shoot.json'), 'utf8'));
spec.assets = spec.assets ?? {};
spec.assets.photos = { dir: `output/subjects/${tag}`, credit: 'Pexels', subject: `one person, ${shoot.photographer}` };
spec.assets.look = sourcing.look ?? 'cinematic';
spec.content = { style: args.style ?? sourcing.style ?? 'native' };
fs.writeFileSync(path.join(ROOT, 'campaigns', `${spec.id}.json`), JSON.stringify(spec, null, 2));

/* ── 4. generate + check + render ───────────────────────────────────────── */

const instruction = args.ask ?? `a first-person story that fits this product, ${slides} slides`;
t = Date.now();
const { content, verdict, usd: genUsd, attempts, failed } = await generateContent({
  root: ROOT, spec, instruction, slideCount: slides,
});
console.log(`  copy: ${attempts} attempt${attempts > 1 ? 's' : ''} · $${genUsd.toFixed(4)} · ${verdict.pass ? 'COMPLIANT' : 'NON-COMPLIANT'}`);
verdict.failures.forEach((f) => console.log(`    FAIL ${f}`));
if (failed) { console.error('  refusing to render a non-compliant set'); process.exit(3); }

const photos = fs.readdirSync(dir).filter((f) => /^\d+\.jpg$/.test(f)).map((f) => f.replace('.jpg', ''));
const renderable = toRenderable(spec, content, { photos, appScreen: spec.assets?.app_screen });
const styleId = spec.content.style;
const outDir = path.join(ROOT, 'output/sets', `${spec.id}-${styleId}`);
const r = await render({ spec: renderable, root: ROOT, styleId, outDir });

const cost = claudeCost();
const report = {
  id: spec.id, brand: spec.brand, niche: spec.niche, style: styleId,
  slides: r.files.length, subject: shoot.photographer, subjectFrames: photos.length,
  caption: content.caption, bio: content.bio, hashtags: content.hashtags,
  compliance: verdict,
  cost: { invent: +invented.usd.toFixed(4), ingest: +ingestUsd.toFixed(4), copy: +genUsd.toFixed(4), total: +cost.usd.toFixed(4) },
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`  ${r.files.length} slides · ${r.canvas.w}x${r.canvas.h} · one subject (${photos.length} frames)`);
console.log(`  TOTAL $${report.cost.total}  (invent ${report.cost.invent} + ingest ${report.cost.ingest} + copy ${report.cost.copy})`);
console.log(`  ${outDir}`);
