// Render every campaign across every template family — the spread the user reviews.
//   node tools/render-all.mjs
import fs from 'node:fs';
import path from 'node:path';
import { renderCarousel, loadTemplates } from '../engine/index.mjs';

const templates = loadTemplates();
const OUT = 'output/spread';
fs.rmSync(OUT, { recursive: true, force: true });

const campaigns = fs.readdirSync('campaigns').filter(f => f.endsWith('.json'));
const rows = [];
let post = 0;

for (const cf of campaigns) {
  const campaign = JSON.parse(fs.readFileSync(path.join('campaigns', cf), 'utf8'));
  const conceptFile = path.join('concepts', cf);
  if (!fs.existsSync(conceptFile)) { console.log(`skip ${campaign.id}: no concepts`); continue; }
  const concepts = JSON.parse(fs.readFileSync(conceptFile, 'utf8')).concepts;

  for (let ci = 0; ci < concepts.length; ci++) {
    for (const tpl of templates) {
      try {
        const c = await renderCarousel({
          accountId: 'spread', campaign, concept: concepts[ci], postIndex: post++,
          outDir: path.join(OUT, campaign.niche), templates: [tpl],
        });
        const matched = c.slideMeta.filter(m => m.subjectMatch?.matched).length;
        const withSubj = c.slideMeta.filter(m => m.subjectMatch).length;
        rows.push({ niche: campaign.niche, family: tpl.name, id: c.id, slides: c.slides.length,
          rules: c.validation.ok ? 'PASS' : 'FAIL', matched, withSubj });
        console.log(`${c.validation.ok ? 'PASS' : 'FAIL'}  ${campaign.niche.padEnd(8)} ${tpl.name.padEnd(16)} ${String(c.slides.length).padStart(2)} slides  subj-match ${matched}/${withSubj}`);
        if (!c.validation.ok) for (const e of c.validation.errors) console.log(`        ${e.rule}: ${e.detail}`);
      } catch (e) {
        console.log(`ERR   ${campaign.niche.padEnd(8)} ${tpl.name.padEnd(16)} ${String(e.message).slice(0, 150)}`);
        rows.push({ niche: campaign.niche, family: tpl.name, error: String(e.message).slice(0, 200) });
      }
    }
  }
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'SUMMARY.json'), JSON.stringify(rows, null, 2));
const ok = rows.filter(r => r.rules === 'PASS').length;
console.log(`\n${ok}/${rows.length} rendered and passed campaign rules`);
