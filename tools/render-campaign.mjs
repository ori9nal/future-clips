// Render a partner campaign from a concept file.
//   node tools/render-campaign.mjs --campaign campaigns/atlas-fitness.json \
//                                  --concepts concepts/atlas-fitness.json [--out output/atlas]
import fs from 'node:fs';
import path from 'node:path';
import { renderCarousel, loadTemplates } from '../engine/index.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const campaign = JSON.parse(fs.readFileSync(arg('--campaign', 'campaigns/atlas-fitness.json'), 'utf8'));
const concepts = JSON.parse(fs.readFileSync(arg('--concepts', 'concepts/atlas-fitness.json'), 'utf8'));
const OUT = arg('--out', 'output/atlas');
const only = arg('--template', 'f1-single-cutout');

const templates = loadTemplates().filter((t) => !only || t.id === only);
if (!templates.length) { console.error(`no template "${only}"`); process.exit(2); }
fs.rmSync(OUT, { recursive: true, force: true });

const rows = [];
for (let i = 0; i < concepts.concepts.length; i++) {
  const concept = concepts.concepts[i];
  try {
    const c = await renderCarousel({
      accountId: 'clipper-demo', campaign, concept, postIndex: i, outDir: OUT, templates,
    });
    rows.push({ id: c.id, slides: c.slides.length, hook: concept.hook,
      structure: concept.structure_type, rules: c.validation.ok ? 'PASS' : c.validation.errors,
      credits: c.credits.length });
    console.log(`${c.validation.ok ? 'PASS' : 'FAIL'}  ${c.id}  ${c.slides.length} slides  "${concept.hook}"`);
    if (!c.validation.ok) for (const e of c.validation.errors) console.log(`      ${e.rule}: ${e.detail}`);
  } catch (e) {
    console.log(`ERROR post ${i}: ${e.message}`);
    rows.push({ postIndex: i, error: e.message });
  }
}
fs.writeFileSync(path.join(OUT, 'SUMMARY.json'), JSON.stringify(rows, null, 2));
console.log(`\n${rows.filter(r => r.rules === 'PASS').length}/${concepts.concepts.length} passed campaign rules`);
