// The volume rule the corpus implies, stated as an inequality:
//   cover  <  closer  <=  min(interiors)
// This reports the real rendered word counts per family so the copy banks can be
// tuned against the actual templates rather than against a guess.
import { loadTemplates, roleFor } from '../engine/index.mjs';
import { layoutSlide } from '../engine/layout.mjs';
import { makePalette } from '../engine/palette.mjs';
import { buildCopy, HOOK_TYPES } from '../engine/copy.mjs';
import { rng as mk } from '../engine/seed.mjs';

const templates = loadTemplates();
let bad = 0, total = 0;
for (const tpl of templates) {
  const rows = [];
  for (const hook of tpl.hookTypes) {
    for (const n of [tpl.slideCount[0], tpl.slideCount[1]]) {
      const pal = makePalette('accent-A');
      // mirror the engine: try every written closer length, keep the best
      let best = null;
      for (const closerLen of [0, 1, 2]) {
        const copy = buildCopy(mk(1234 + n), { slideCount: n, hookType: hook, closerLen });
        const counts = copy.slides.map((s, i) => {
          const r = layoutSlide({ tpl, role: roleFor(tpl, s, i), content: s, palette: pal, canvas: tpl.canvas });
          return r.ok ? r.renderedWords : NaN;
        });
        if (counts.some(Number.isNaN)) continue;
        const cover = counts[0], closer = counts[counts.length - 1];
        const interiors = counts.slice(1, -1);
        const ok = cover < closer && closer <= Math.min(...interiors);
        const score = (cover < closer ? 100 : -(cover - closer)) + (closer <= Math.min(...interiors) ? 100 : -(closer - Math.min(...interiors))) + closerLen;
        if (!best || score > best.score) best = { score, ok, cover, closer, interiors, closerLen };
      }
      if (!best) { rows.push(`   FAIL ${hook.padEnd(20)} n=${n}  layout unsatisfiable`); total++; bad++; continue; }
      const { ok, cover, closer, interiors } = best;
      total++; if (!ok) bad++;
      rows.push(`   ${ok ? 'ok  ' : 'FAIL'} ${hook.padEnd(20)} n=${n}  cover=${cover}  closer=${closer}  interiors=[${interiors.join(',')}]`);
    }
  }
  console.log(tpl.id);
  for (const r of rows) console.log(r);
}
console.log(`\n${total - bad}/${total} combinations satisfy  cover < closer <= min(interiors)`);
