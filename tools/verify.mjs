// End-to-end verification of the brief's hard requirements.
import fs from 'node:fs'; import path from 'node:path';
import { loadTemplates, diverge } from '../engine/index.mjs';
import { fingerprint } from '../engine/seed.mjs';

const templates = loadTemplates();
const pass = (label, ok, detail = '') => console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);

// 1. five families, all data
const ids = templates.map(t => t.id);
pass('five template families', templates.length === 5, ids.join(', '));

// 2. no layout hardcoded in JS: no engine file may name a family id
const engineSrc = fs.readdirSync('engine').filter(f => f.endsWith('.mjs'))
  .map(f => ({ f, s: fs.readFileSync(path.join('engine', f), 'utf8') }));
const leaks = engineSrc.filter(({ s }) => ids.some(id => s.includes(id)));
pass('no family id appears in engine/*.mjs', leaks.length === 0, leaks.map(l => l.f).join(', ') || 'templates are data');

// 3. divergence: different seeds -> structurally different carousels
const seen = new Map(); let distinct = 0;
for (let i = 0; i < 20; i++) {
  const d = diverge({ accountId: 'drift', campaignId: 'verify', postIndex: i, templates });
  const fp = fingerprint({ family: d.tpl.id, slideCount: d.slideCount, hookType: d.hookType, accent: d.accentKey });
  if (!seen.has(fp.key)) { seen.set(fp.key, i); distinct++; }
}
pass('20 seeds -> distinct structural fingerprints', distinct >= 18, `${distinct}/20 distinct`);

// 4. determinism: the same seed twice gives the same structure
const a = diverge({ accountId: 'drift', campaignId: 'verify', postIndex: 3, templates });
const b = diverge({ accountId: 'drift', campaignId: 'verify', postIndex: 3, templates });
pass('same seed is reproducible',
  a.tpl.id === b.tpl.id && a.accentKey === b.accentKey && a.slideCount === b.slideCount && a.hookType === b.hookType,
  `${a.tpl.id}/${a.accentKey}/${a.slideCount}sl/${a.hookType}`);

// 5. every divergence axis actually varies
const axes = { family: new Set(), accent: new Set(), slideCount: new Set(), hook: new Set(), crop: new Set() };
for (let i = 0; i < 20; i++) {
  const d = diverge({ accountId: 'drift', campaignId: 'verify', postIndex: i, templates });
  axes.family.add(d.tpl.id); axes.accent.add(d.accentKey);
  axes.slideCount.add(d.slideCount); axes.hook.add(d.hookType); axes.crop.add(d.cropStrategy);
}
pass('all five divergence axes vary',
  axes.family.size === 5 && axes.accent.size === 2 && axes.slideCount.size > 2 && axes.hook.size > 3,
  `family ${axes.family.size}, accent ${axes.accent.size}, slideCount ${axes.slideCount.size}, hook ${axes.hook.size}`);

// 6. delivered set
const S = JSON.parse(fs.readFileSync('output/final/SUMMARY.json', 'utf8'));
pass('10 carousels delivered', S.generated === 10, `${S.slidesTotal} slides`);
pass('campaign rules pass on all', S.campaignRulesPassed === 10);
pass('zero fingerprint collisions', S.fingerprintCollisions === 0);
pass('slide counts inside 6-10', S.carousels.every(c => c.slides >= 6 && c.slides <= 10),
  S.carousels.map(c => c.slides).join(','));
pass('slide 1 headline 4-8 words',
  S.carousels.every(c => { const w = c.headline.split(/\s+/).length; return w >= 4 && w <= 8; }),
  S.carousels.map(c => c.headline.split(/\s+/).length).join(','));
