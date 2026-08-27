// The gauntlet. One command per round:
//   node gauntlet/run.mjs --round N [--n 10] [--strict L]
//
// Generates N fresh carousels with fresh seeds, runs the 60 automated points,
// builds a contact sheet and a 200px thumbnail strip per carousel for the
// vision pass, and writes gauntlet/rounds/rN/report.json.
// Vision scores are supplied afterwards via `--vision path.json` and folded in.
import fs from 'node:fs';
import path from 'node:path';
import { renderCarousel, loadTemplates } from '../engine/index.mjs';
import { fingerprintCollisions } from '../engine/seed.mjs';
import { autoScore, RUBRIC } from './checks.mjs';
import { STRICT_TIERS, VISION_RUBRIC } from './strict.mjs';
import { contactSheet, thumbStrip } from '../tools/sheet.mjs';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ROUND = Number(arg('round', 1));
const N = Number(arg('n', 10));
const STRICT = Number(arg('strict', 0));
const CAMPAIGN = arg('campaign', `why-not-what-r${ROUND}`);
const OUT = arg('out', `output/round-${ROUND}`);

async function main() {
  const templates = loadTemplates();
  const strict = {};
  for (let t = 1; t <= STRICT; t++) Object.assign(strict, STRICT_TIERS[t] || {});

  console.log(`\n=== GAUNTLET ROUND ${ROUND} ===`);
  console.log(`templates: ${templates.map((t) => t.id).join(', ')}`);
  console.log(`carousels: ${N}   campaign seed: "${CAMPAIGN}"   strict tier: ${STRICT}`);
  console.log(`automated rubric: ${RUBRIC.reduce((a, b) => a + b.max, 0)} base` +
    (Object.keys(strict).length ? ` + ${Object.keys(strict).length} strict check(s)` : '') + '\n');

  fs.rmSync(OUT, { recursive: true, force: true });
  const results = [];
  const renderErrors = [];

  for (let i = 0; i < N; i++) {
    try {
      const c = await renderCarousel({
        accountId: 'drift', campaignId: CAMPAIGN, postIndex: i,
        outDir: OUT, templates,
      });
      const auto = await autoScore(c, c.tpl, { strict });
      const sheet = await contactSheet(c.files, path.join(c.dir, 'sheet.png'), { cell: 330, cols: Math.min(5, c.files.length) });
      const strip = await thumbStrip(c.files, path.join(c.dir, 'thumbs.png'));
      results.push({
        id: c.id, family: c.family, familyName: c.familyName,
        accentKey: c.accentKey, accent: c.accent, hookType: c.hookType,
        slideCount: c.slides.length, seed: c.seed, copyAttempts: c.copyAttempts,
        fingerprint: c.fingerprint, validation: c.validation,
        auto, sheet, strip, dir: c.dir,
        subjects: c.slideMeta.map((m) => m.subjectId),
      });
      const flag = auto.score === auto.max ? ' ' : '!';
      console.log(`${flag} ${c.id.padEnd(12)} ${c.familyName.padEnd(18)} ${String(c.slides.length).padStart(2)}sl ` +
        `${c.accentKey} ${c.hookType.padEnd(20)} auto ${String(auto.score).padStart(2)}/${auto.max}` +
        (c.copyAttempts ? `  (copy regen x${c.copyAttempts})` : ''));
      for (const f of auto.failures) console.log(`      ${f}`);
    } catch (e) {
      const trace = String(e.stack || '').split(/\r?\n/).slice(1, 6);
      renderErrors.push({ postIndex: i, message: e.message, stack: trace });
      console.log(`X post ${i}: ${e.message}`);
      for (const t of trace) console.log(`      ${t.trim()}`);
    }
  }

  const collisions = fingerprintCollisions(results.map((r) => ({ id: r.id, fingerprint: r.fingerprint })));
  const autoMax = results.length ? results[0].auto.max : 60;
  const autoMean = results.length ? results.reduce((a, r) => a + r.auto.score, 0) / results.length : 0;

  // aggregate which rubric lines are costing the most across the batch
  const byItem = {};
  for (const r of results) for (const it of r.auto.items) {
    byItem[it.id] ??= { id: it.id, label: it.label, lost: 0, max: it.max * results.length, fails: [] };
    byItem[it.id].lost += it.max - it.points;
    byItem[it.id].fails.push(...it.failures.map((f) => `${r.id}: ${f}`));
  }
  const worst = Object.values(byItem).filter((x) => x.lost > 0).sort((a, b) => b.lost - a.lost);

  const report = {
    round: ROUND, campaign: CAMPAIGN, n: N, strictTier: STRICT,
    autoMean: +autoMean.toFixed(2), autoMax,
    autoMeanScaled60: +(autoMean / autoMax * 60).toFixed(2),
    renderErrors, fingerprintCollisions: collisions,
    familyMix: results.reduce((m, r) => (m[r.familyName] = (m[r.familyName] || 0) + 1, m), {}),
    accentMix: results.reduce((m, r) => (m[r.accentKey] = (m[r.accentKey] || 0) + 1, m), {}),
    hookMix: results.reduce((m, r) => (m[r.hookType] = (m[r.hookType] || 0) + 1, m), {}),
    slideCountMix: results.reduce((m, r) => (m[r.slideCount] = (m[r.slideCount] || 0) + 1, m), {}),
    worstItems: worst.map((w) => ({ id: w.id, label: w.label, lost: w.lost, examples: w.fails.slice(0, 6) })),
    visionRubric: VISION_RUBRIC,
    carousels: results,
  };

  const dir = `gauntlet/rounds/r${ROUND}`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2));

  console.log(`\n-- automated mean: ${autoMean.toFixed(2)}/${autoMax}` +
    (autoMax !== 60 ? `  (= ${(autoMean / autoMax * 60).toFixed(2)}/60 on the base scale)` : ''));
  console.log(`-- render errors: ${renderErrors.length}`);
  console.log(`-- fingerprint collisions: ${collisions.length}` +
    (collisions.length ? ` -> ${collisions.map((c) => c.ids.join('+')).join(' | ')}` : ''));
  console.log(`-- family mix: ${JSON.stringify(report.familyMix)}`);
  console.log(`-- accent mix: ${JSON.stringify(report.accentMix)}`);
  if (worst.length) {
    console.log('\n-- rubric lines losing points:');
    for (const w of worst) console.log(`   ${String(w.lost).padStart(3)} pts  ${w.id.padEnd(14)} ${w.label}`);
  }
  console.log(`\nreport: ${dir}/report.json`);
  console.log(`sheets: ${results.map((r) => r.sheet).length} contact sheets + thumbnail strips under ${OUT}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
