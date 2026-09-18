// The engine's guarantees, checked without spending anything:
//   1. every rendered slide on disk is pixels only (no C2PA, no text chunks)
//   2. stripPng removes a provider frame's manifest and keeps the pixels
//   3. the copy judge enforces the slide range and the caption emojis
//   4. slideRange clamps the ask to the brief
// Run: node tools/test-engine.mjs   (exit 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';
import { inspectPng, stripPng, assertClean } from '../engine/clean.mjs';
import { slideRange, judgeCopy, EMOJI_RX, buildCopyRequest, BRAND_SPEAK } from '../engine/generate.mjs';
import { enforce, direct, SHOTS } from '../engine/scenes.mjs';
import { planSet } from '../engine/art.mjs';
import { deslop, strengthFor } from '../engine/deslop.mjs';
import sharp from 'sharp';

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

// 5. deslop: seeded, so a set re-renders byte-identically; strength 0 is the identity; the pass changes the pixels
{
  const src = await sharp({ create: { width: 240, height: 320, channels: 3, background: '#5a7fb0' } })
    .composite([{ input: Buffer.from('<svg width="240" height="320"><rect x="20" y="40" width="120" height="180" fill="#101014"/><circle cx="180" cy="90" r="40" fill="#f2c14e"/></svg>'), blend: 'over' }])
    .png().toBuffer();
  const a = await deslop(src, { seed: 'set:1', width: 240, height: 320 });
  const b = await deslop(src, { seed: 'set:1', width: 240, height: 320 });
  const c = await deslop(src, { seed: 'set:2', width: 240, height: 320 });
  const z = await deslop(src, { seed: 'set:1', width: 240, height: 320, strength: 0 });
  const raw = async (buf) => sharp(buf).removeAlpha().raw().toBuffer();
  ok(a.equals(b), 'deslop is deterministic for a seed');
  ok(!a.equals(c), 'deslop differs between seeds (crop and grain)');
  ok((await raw(z)).equals(await raw(src)), 'deslop at strength 0 leaves the pixels untouched');
  const [ra, rs] = [await raw(a), await raw(src)];
  let sumA = 0, sumS = 0; for (let i = 0; i < ra.length; i++) { sumA += ra[i]; sumS += rs[i]; }
  // measured knobs (2026-09-13): a bright frame still loses a little exposure,
  // but a tenth, not a fifth — the reference gym family sits at L≈87, not 60
  ok(sumA < sumS && sumA > sumS * 0.84, `deslop underexposes a bright frame slightly (mean ${(sumA / ra.length).toFixed(1)} from ${(sumS / rs.length).toFixed(1)})`);
  // the grain is measured, not guessed: flat-area residual noise on the
  // reference is 1.3–1.6 at 720 px; the script's knobs gave 4.5
  const lum = (buf) => { const out = new Float32Array(buf.length / 3); for (let i = 0; i < out.length; i++) out[i] = 0.2126 * buf[i * 3] + 0.7152 * buf[i * 3 + 1] + 0.0722 * buf[i * 3 + 2]; return out; };
  const noise = (L, w, h) => { let r2 = 0, n = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; const nb = [L[i - w - 1], L[i - w], L[i - w + 1], L[i - 1], L[i], L[i + 1], L[i + w - 1], L[i + w], L[i + w + 1]].sort((p, q) => p - q); const d = L[i] - nb[4]; r2 += d * d; n++; } return Math.sqrt(r2 / n); };
  const nz = noise(lum(ra), 240, 320);
  ok(nz > 0.6 && nz < 3.0, `deslop grain is in the reference band (flat-area noise ${nz.toFixed(2)}, reference 1.3–1.6, script 4.5)`);
  ok(strengthFor('phone') === 1 && strengthFor('cinematic') < 1, 'the camera-roll look gets the full recipe, graded looks a lighter one');
}

// 6. the copy judge's phone-format rules: brand-speak, specificity, em-dash repair
{
  const data = { hook: { lines: ['Top 5 — moves'], sub: [] }, ranked: [{ name: 'a', lines: ['elevate your training'], showsApp: true }, { name: 'b', lines: ['3 x 10'] }, { name: 'c', lines: ['no numbers'] }, { name: 'd', lines: ['none here either'] }], closer: { lines: ['z'], cta: 'go' }, caption: 'x 💪 🔥', bio: '', hashtags: [] };
  const j = judgeCopy({ spec, data: JSON.parse(JSON.stringify(data)), range: slideRange(spec, 6), styleId: 'feed' });
  ok(j.verdict.failures.some((f) => /elevate/.test(f)), 'judge rejects brand-speak on a slide ("elevate")');
  ok(j.verdict.failures.some((f) => /carry a number/.test(f)), 'judge rejects a set where fewer than half the items carry a number');
  ok(j.data.hook.lines[0] === 'Top 5, moves', `judge repairs an em dash on a slide to a comma ("${j.data.hook.lines[0]}")`);
  ok(BRAND_SPEAK.test('unlock your potential') && !BRAND_SPEAK.test('the gamechanger fr') && !BRAND_SPEAK.test('laterals are non negotiable'), 'BRAND_SPEAK catches the LLM words and spares the corpus ones');
  const jb = judgeCopy({ spec, data: JSON.parse(JSON.stringify(data)), range: slideRange(spec, 6), styleId: 'bedrock' });
  ok(!jb.verdict.failures.some((f) => /elevate|carry a number/.test(f)), 'the phone-format rules do not apply to bedrock');
}

// 7. scene enforcement: shot types rotate, the app slot is the phone shot, the closer is a lifestyle beat
{
  const e = enforce(new Array(8).fill('x'), { niche: 'fitness', appIndex: 5, seed: 't', headings: ['Hammer curl', 'Preacher curl', 'Deloading', 'Rear delts', 'App', 'Spider curl'] });
  ok(e.shots[0] === 'mirror' && e.shots[5] === 'phone' && e.shots[7] === 'outdoors', `gym shots: ${e.shots.join(' ')}`);
  ok(e.shots.slice(1).every((t, i) => i === 0 || t !== e.shots[i]), 'no shot type repeats back to back');
  ok(/hammer curl/.test(e.scenes[1]) && /No face/.test(e.scenes[1]), 'a heading that names a lift shows that lift with no face');
  ok(e.scenes.every((sc) => /Not a photoshoot/.test(sc)), 'every gym frame carries the camera line');
  const t = enforce(new Array(7).fill('x'), { niche: 'trading', appIndex: 4, seed: 't' });
  ok(t.times.filter((x) => x === 'day').length >= 3, `trading set is at least 40 % daylight (${t.times.join(' ')})`);
  ok(new Set(t.shots).size === t.shots.length, 'no trading kind repeats in a set');
  const f = enforce(new Array(7).fill('x'), { niche: 'nutrition', seed: 't' });
  ok(new Set(f.shots).size === f.shots.length && f.scenes.every((sc) => /Not food photography/.test(sc)), `food set: ${f.shots.join(' ')}`);
  // the app frame is an edit of the screenshot, not of the anchor
  const plan = planSet({ subject: 's', scenes: ['a', SHOTS.phone.frame({}), 'c no face'], appScreen: '/x/app.png', days: true, id: 'p' });
  const fr = plan.frames('/x/anchor.png');
  ok(fr[0].refs[0] === '/x/app.png' && fr[1].refs[0] === '/x/anchor.png', 'the phone-on-a-bench frame references the screenshot; the rest reference the anchor');
  const d = direct({ spec, content: { hook: { lines: ['h'] }, ranked: [{ name: 'a' }, { name: 'b', showsApp: true }, { name: 'c' }], closer: { lines: ['z'] } }, styleId: 'feed', seed: 't' });
  ok(d.days && d.mode === 'subject' && d.look === 'phone' && d.appIndex === 2, `direct(): gym feed is subject+days, phone look, app at ${d.appIndex}`);
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
