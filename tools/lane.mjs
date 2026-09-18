// Run one set through a lane end to end, from the command line.
//
//   node tools/lane.mjs campaign=apex-strength ask="..." lane=batch slides=6-8 style=feed
//   node tools/lane.mjs campaign=apex-strength ask="..." lane=priority slides=7
//
// The batch lane waits on the providers' batch endpoints (minutes, up to a
// day); the state is checkpointed to output/lanes/<id>.json after every
// transition so an interrupted run resumes with `resume=<id>` instead of
// paying twice.
import fs from 'node:fs';
import path from 'node:path';
import { newState, run } from '../engine/lanes.mjs';

const ROOT = process.cwd();
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));

const stateDir = path.join(ROOT, 'output/lanes');
fs.mkdirSync(stateDir, { recursive: true });

let s;
if (args.resume) {
  s = JSON.parse(fs.readFileSync(path.join(stateDir, `${args.resume}.json`), 'utf8'));
  // A checkpoint saved after a provider failure (a 429, a network drop) is
  // resumed from the last step it had completed, not replayed as "failed":
  // frames already generated are cache hits, so only the missing work is paid for.
  if (s.stage === 'failed') {
    const back = s.art?.files ? 'render' : s.art?.anchorFile ? 'art:frames:submit' : s.copy?.content ? 'art:anchor:submit' : 'copy:submit';
    s.log.push(`${new Date().toISOString()} resume  rewound from failed to ${back} (${s.error})`);
    s.stage = back; s.error = null;
    console.log(`  resuming from ${back}`);
  }
} else {
  const { campaign, ask } = args;
  if (!campaign || !ask) { console.error('usage: lane.mjs campaign=<id> ask="..." [lane=batch|priority] [slides=7|6-8] [style=feed] [quality=medium] [model=claude-opus-5]'); process.exit(1); }
  const slidesArg = String(args.slides ?? 7);
  const m = slidesArg.match(/^(\d+)\s*(?:-|\.\.)\s*(\d+)$/);
  const slides = m ? { min: +m[1], max: +m[2] } : Number(slidesArg);
  const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${campaign}.json`), 'utf8'));
  const id = `${campaign}-${args.lane ?? 'batch'}-${Date.now().toString(36)}`;
  s = newState({ id, spec, instruction: ask, slides, styleId: args.style, lane: args.lane ?? 'batch', quality: args.quality ?? 'medium', model: args.model, seed: args.seed, look: args.look, mode: args.mode });
  s.campaign = campaign;
}

const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${s.campaign}.json`), 'utf8'));
const ctx = { root: ROOT, spec, cacheDir: path.join(ROOT, 'output/gen/cache'), outDir: path.join(ROOT, 'output/sets', `${s.campaign}-${s.styleId}-${s.lane}`) };
const save = () => fs.writeFileSync(path.join(stateDir, `${s.id}.json`), JSON.stringify(s, null, 2));

const t0 = Date.now();
console.log(`\n▸ ${spec.brand} — "${s.instruction}" · ${s.lane} lane · ${s.styleId} · ${typeof s.slides === 'number' ? s.slides : `${s.slides.min}-${s.slides.max}`} slides · ${s.quality}`);
await run(s, ctx, {
  everyMs: Number(args.every ?? 20000),
  onStage: (st) => { save(); console.log(`  ${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s  ${st.stage}${st.log.length ? '  ' + st.log.at(-1).split(' ').slice(2).join(' ') : ''}`); },
});
save();
if (s.stage === 'failed') { console.error(`  FAILED: ${s.error}`); process.exit(2); }
console.log(`  ${s.files.length} slides · ${s.copy.count} asked · caption: ${s.copy.content.caption}`);
console.log(`  cost: copy $${s.copy.usd.toFixed(4)} + art $${s.art.usd.toFixed(4)} = $${s.usd.toFixed(4)} · ${((Date.now() - t0) / 1000).toFixed(0)}s wall · ${ctx.outDir}`);
