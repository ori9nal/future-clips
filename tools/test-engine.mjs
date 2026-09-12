// The engine's guarantees, checked without spending anything:
//   1. every rendered slide on disk is pixels only (no C2PA, no text chunks)
//   2. stripPng removes a provider frame's manifest and keeps the pixels
//   3. the copy judge enforces the slide range and the caption emojis
//   4. slideRange clamps the ask to the brief
// Run: node tools/test-engine.mjs   (exit 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';
import { inspectPng, stripPng, assertClean } from '../engine/clean.mjs';
import { slideRange, judgeCopy, EMOJI_RX, buildCopyRequest } from '../engine/generate.mjs';

const ROOT = process.cwd();
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) failed++; };

// 1. rendered slides are clean
const setsDir = path.join(ROOT, 'output/sets');
let slides = 0, dirty = [];
if (fs.existsSync(setsDir)) {
  for (const d of fs.readdirSync(setsDir)) {
    const dir = path.join(setsDir, d);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((f) => /^slide-\d+\.png$/.test(f))) {
      slides++;
      const r = inspectPng(path.join(dir, f));
      if (!r.clean) dirty.push(`${d}/${f}: ${r.offending.map((o) => o.chunk).join(',')}`);
    }
  }
}
ok(slides > 0 && dirty.length === 0, `${slides} rendered slides on disk, ${dirty.length} carrying metadata${dirty.length ? ' -> ' + dirty.slice(0, 3).join('; ') : ''}`);

// 2. a raw provider frame carries caBX; stripped it does not; pixels identical
const cacheDir = path.join(ROOT, 'output/gen/cache');
const raw = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir).filter((f) => f.endsWith('.png')).map((f) => path.join(cacheDir, f)) : [];
const withManifest = raw.find((f) => inspectPng(f).chunks.includes('caBX'));
if (withManifest) {
  const before = fs.readFileSync(withManifest);
  const after = stripPng(before);
  const ib = inspectPng(before), ia = inspectPng(after);
  ok(!ib.clean && ia.clean && ia.chunks.join() === 'IHDR,IDAT,IEND', `stripPng: ${ib.chunks.join(',')} -> ${ia.chunks.join(',')} (${before.length - after.length} bytes of manifest removed)`);
  // same IHDR + IDAT bytes = same pixels
  const idat = (b) => { let p = 8, out = []; while (p + 8 <= b.length) { const len = b.readUInt32BE(p), t = b.toString('latin1', p + 4, p + 8); if (t === 'IDAT' || t === 'IHDR') out.push(b.subarray(p + 8, p + 8 + len)); p += 12 + len; if (t === 'IEND') break; } return Buffer.concat(out); };
  ok(idat(before).equals(idat(after)), 'stripPng keeps IHDR and IDAT byte-identical (pixels untouched)');
  let threw = false; try { assertClean([withManifest]); } catch { threw = true; }
  ok(threw, 'assertClean throws on a frame that still carries the manifest');
} else {
  console.log('skip stripPng: no raw provider frame with caBX in the cache');
}

// 3. copy judge
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns/apex-strength.json'), 'utf8'));
const three = { hook: { lines: ['a'], sub: [] }, ranked: [{ name: 'x', lines: ['y'] }], closer: { lines: ['z'], cta: 'go' }, caption: 'plain caption', bio: '', hashtags: [] };
const j = judgeCopy({ spec, data: JSON.parse(JSON.stringify(three)), range: slideRange(spec, 7) });
ok(!j.verdict.pass && j.verdict.failures.some((f) => /slides returned/.test(f)), `judge rejects 3 slides for an ask of 7: "${j.verdict.failures.find((f) => /slides returned/.test(f))}"`);
ok(j.verdict.failures.some((f) => /no emoji/.test(f)), 'judge rejects a caption without emoji');
ok(EMOJI_RX.test('lifts I show up for 💪📈') && !EMOJI_RX.test('no emoji here'), 'EMOJI_RX matches emoji and only emoji');

// 4. slideRange
const r1 = slideRange(spec, 7), r2 = slideRange(spec, { min: 6, max: 8 }), r3 = slideRange(spec, { min: 3, max: 12 });
ok(r1.exact && r1.min === 7, 'slideRange(7) is exact');
ok(!r2.exact && r2.min === 6 && r2.max === 8, 'slideRange(6-8) is a range');
ok(r3.min === (spec.requirements.min_slides ?? 5) && r3.max === (spec.requirements.max_slides ?? 10), `slideRange(3-12) clamps to the brief (${r3.min}-${r3.max})`);
const req = buildCopyRequest({ spec, instruction: 'x', slides: { min: 6, max: 8 } });
ok(/between 6 and 8 slides/.test(req.user) && /2-3 emojis/.test(req.user), 'request text carries the range and the caption rule');

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
