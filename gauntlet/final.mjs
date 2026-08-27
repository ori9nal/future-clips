// Produce the deliverable set: 10 DRIFT carousels into output/final/,
// scored at the hardest rubric tier, with contact sheets and a summary.
//   node gauntlet/final.mjs
import fs from 'node:fs';
import path from 'node:path';
import { renderCarousel, loadTemplates } from '../engine/index.mjs';
import { fingerprintCollisions } from '../engine/seed.mjs';
import { autoScore } from './checks.mjs';
import { STRICT_TIERS } from './strict.mjs';
import { contactSheet, thumbStrip } from '../tools/sheet.mjs';

const OUT = 'output/final';
const N = 10;

const strict = {};
for (let t = 1; t <= 3; t++) Object.assign(strict, STRICT_TIERS[t]);

const templates = loadTemplates();
fs.rmSync(OUT, { recursive: true, force: true });

const rows = [];
for (let i = 0; i < N; i++) {
  const c = await renderCarousel({
    accountId: 'drift', campaignId: 'why-not-what-final', postIndex: i,
    outDir: OUT, templates,
  });
  const auto = await autoScore(c, c.tpl, { strict });
  await contactSheet(c.files, path.join(c.dir, 'sheet.png'), { cell: 330, cols: Math.min(5, c.files.length) });
  await thumbStrip(c.files, path.join(c.dir, 'thumbs.png'));
  rows.push({
    id: c.id, family: c.familyName, accent: c.accentKey, accentHex: c.accent,
    slides: c.slides.length, hook: c.hookType, seed: c.seed,
    headline: c.slides[0].headline, kicker: c.slides[0].kicker,
    cta: c.slides[c.slides.length - 1].headline,
    fingerprint: c.fingerprint.hash, copyAttempts: c.copyAttempts,
    campaignRules: c.validation.ok ? 'PASS' : c.validation.errors,
    auto: `${auto.score}/${auto.max}`, autoFailures: auto.failures,
    subjects: c.slideMeta.map((m) => m.subjectId).filter(Boolean),
    files: c.files.map((f) => path.basename(f)),
  });
  console.log(`${c.id.padEnd(12)} ${c.familyName.padEnd(18)} ${String(c.slides.length).padStart(2)}sl ` +
    `${c.accentKey} ${String(auto.score).padStart(2)}/${auto.max}  rules:${c.validation.ok ? 'PASS' : 'FAIL'}  "${c.slides[0].headline}"`);
  for (const f of auto.failures) console.log(`      ${f}`);
}

const scores = rows.map((r) => Number(r.auto.split('/')[0]));
const max = Number(rows[0].auto.split('/')[1]);
const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
const collisions = fingerprintCollisions(rows.map((r) => ({ id: r.id, fingerprint: { key: r.fingerprint } })));

const summary = {
  generated: rows.length,
  slidesTotal: rows.reduce((a, r) => a + r.slides, 0),
  automatedMean: +mean.toFixed(2), automatedMax: max,
  automatedMeanScaled60: +(mean / max * 60).toFixed(2),
  perfectSets: scores.filter((s) => s === max).length,
  campaignRulesPassed: rows.filter((r) => r.campaignRules === 'PASS').length,
  fingerprintCollisions: collisions.length,
  familyMix: rows.reduce((m, r) => (m[r.family] = (m[r.family] || 0) + 1, m), {}),
  accentMix: rows.reduce((m, r) => (m[r.accent] = (m[r.accent] || 0) + 1, m), {}),
  hookMix: rows.reduce((m, r) => (m[r.hook] = (m[r.hook] || 0) + 1, m), {}),
  carousels: rows,
};
fs.writeFileSync(path.join(OUT, 'SUMMARY.json'), JSON.stringify(summary, null, 2));

console.log(`\n${rows.length} carousels, ${summary.slidesTotal} slides -> ${OUT}/`);
console.log(`automated ${mean.toFixed(2)}/${max} (= ${(mean / max * 60).toFixed(2)}/60)  ` +
  `| ${summary.perfectSets}/10 perfect | campaign rules ${summary.campaignRulesPassed}/10 | collisions ${collisions.length}`);
console.log(`family mix ${JSON.stringify(summary.familyMix)}  accent mix ${JSON.stringify(summary.accentMix)}`);
