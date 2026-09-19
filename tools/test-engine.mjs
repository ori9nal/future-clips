// The engine's guarantees, checked without spending anything:
//   1. every rendered slide on disk is pixels only (no C2PA, no text chunks)
//   2. stripPng removes a provider frame's manifest and keeps the pixels
//   3. the copy judge enforces the slide range and the caption emojis
//   4. slideRange clamps the ask to the brief
// Run: node tools/test-engine.mjs   (exit 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';
import { inspectPng, stripPng, assertClean } from '../engine/clean.mjs';
import { slideRange, judgeCopy, EMOJI_RX, buildCopyRequest, BRAND_SPEAK, toRenderable, liftedFrom } from '../engine/generate.mjs';
import { enforce, direct, SHOTS } from '../engine/scenes.mjs';
import { systemFor } from '../engine/generate.mjs';
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
  // numbering direction (docs/QUALITY.md §4, D-103): countdown only when rated or ranked
  const down = { hook: { lines: ['6 habits that made me consistent'], sub: [] }, ranked: [{ name: '5. one pair', lines: ['3 x 10'] }, { name: '4. risk', lines: ['1% per trade'] }, { name: '3. journal', lines: ['2 lines a night'] }], closer: { lines: ['z'], cta: 'go' }, caption: 'x 💪 🔥', bio: '', hashtags: [], numbering: 'countdown' };
  const jd = judgeCopy({ spec, data: JSON.parse(JSON.stringify(down)), range: slideRange(spec, 5), styleId: 'feed' });
  ok(jd.data.numbering === 'up' && jd.data.ranked[0].name === 'one pair' && jd.verdict.repairs.some((n) => /renumbered/.test(n)), `a countdown of habits with nothing rated or ranked is renumbered 1 → N without a retry (${jd.data.ranked.map((r) => r.name).join(', ')})`);
  const rated = { ...down, ranked: down.ranked.map((r, i) => ({ ...r, score: `${i + 3}/10` })) };
  ok(judgeCopy({ spec, data: JSON.parse(JSON.stringify(rated)), range: slideRange(spec, 5), styleId: 'feed' }).data.numbering === 'countdown', 'a rated countdown keeps counting down');
  const topN = { ...down, hook: { lines: ['top 3 things i check'], sub: [] } };
  ok(judgeCopy({ spec, data: JSON.parse(JSON.stringify(topN)), range: slideRange(spec, 5), styleId: 'feed' }).data.numbering === 'countdown', 'a "top N" ranking may count down');
  const up = { ...down, numbering: 'up', ranked: down.ranked.map((r) => ({ ...r, name: r.name.replace(/^\d+\.\s*/, '') })) };
  const ju = judgeCopy({ spec, data: JSON.parse(JSON.stringify(up)), range: slideRange(spec, 5), styleId: 'feed' });
  ok(ju.data.numbering === 'up' && !ju.verdict.repairs.some((n) => /renumbered/.test(n)), 'a count-up list passes untouched');
  ok(toRenderable(spec, ju.data).content.numbering === 'up', 'toRenderable keeps "up" so the renderers count 1 -> N');
  // F19 (round 6): a hook that promises N things is numbered even when the model says "none"
  const none4 = { ...up, numbering: 'none', hook: { lines: ['4 apps a beginner', 'trader ACTUALLY needs'], sub: [] } };
  ok(toRenderable(spec, JSON.parse(JSON.stringify(none4))).content.numbering === 'up', 'a "4 apps" hook with numbering none renders 1 → N');
  const story = { ...up, numbering: 'none', hook: { lines: ['how i went from 60kg', 'to 80kg in a year'], sub: [] } };
  ok(toRenderable(spec, JSON.parse(JSON.stringify(story))).content.numbering === 'none', 'a story hook with numbering none stays unnumbered');
  // F21 (round 6b): items past the promised count are unnumbered bonus tips
  const five = { ...none4, ranked: [...none4.ranked, { name: 'how i actually use them', lines: ['6am news'] }, { name: 'a routine', lines: ['x'] }] };
  const rb = toRenderable(spec, JSON.parse(JSON.stringify(five))).content.ranked;
  ok(!rb[0].bonus && !rb[3].bonus && rb[4].bonus, `after a "4 apps" hook the fifth item is a bonus (${rb.map((r) => r.bonus ? 'b' : 'n').join('')})`);
  // F25 (round 11): hand numbers past the promised count are dropped too; an apps hook must count its apps
  const hand5 = { ...five, hook: { lines: ['3 apps i check', 'before every session'], sub: [] }, ranked: five.ranked.map((r, i) => ({ ...r, name: `${i + 1}. ${r.name}` })) };
  const rh = toRenderable(spec, JSON.parse(JSON.stringify(hand5))).content.ranked;
  ok(rh[2].rank === 3 && rh[3].bonus && rh[3].rank == null && rh[4].rank == null, `hand numbers past "3 apps" are dropped (${rh.map((r) => r.rank ?? '-').join(' ')})`);
  const tsp = { ...spec, niche: 'trading', rules: {}, requirements: {} };
  const mism = { hook: { lines: ['3 apps i check', 'before every session'], sub: [] }, ranked: [{ name: 'Forex Factory', lines: ['8:30am'] }, { name: 'TradingView', lines: ['4h then 15m'] }, { name: 'MetaTrader 5', lines: ['1% risk'] }, { name: 'TradeLens App', lines: ['1 screenshot'], showsApp: true }, { name: 'my 15 min routine', lines: ['news at 8'] }], closer: { lines: ['z'], cta: 'go' }, caption: 'x 📈 ☕', bio: '', hashtags: [] };
  const jm = judgeCopy({ spec: tsp, data: JSON.parse(JSON.stringify(mism)), range: slideRange(tsp, 7), styleId: 'feed' });
  ok(jm.verdict.failures.some((f) => /promises 3 apps but 4 are listed/.test(f)), 'the judge rejects a "3 apps" hook over four apps');
  const match4 = { ...mism, hook: { lines: ['4 apps i check', 'before every session'], sub: [] } };
  ok(!judgeCopy({ spec: tsp, data: JSON.parse(JSON.stringify(match4)), range: slideRange(tsp, 7), styleId: 'feed' }).verdict.failures.some((f) => /promises/.test(f)), 'a "4 apps" hook over four apps passes');
}

// 7. scene enforcement: shot types rotate, the app slot is the phone shot, the closer is a lifestyle beat
{
  const e = enforce(new Array(8).fill('x'), { niche: 'fitness', appIndex: 5, seed: 't', headings: ['Hammer curl', 'Preacher curl', 'Deloading', 'Rear delts', 'App', 'Spider curl'] });
  ok(e.shots[0] === 'mirror' && e.shots[5] === 'phone' && e.shots[7] === 'mirror-dim', `gym shots: ${e.shots.join(' ')} (the closer is the bedroom mirror, set-08 slide 7)`);
  const eo = enforce(['mirror', 'x', 'x', 'x', 'x', 'x', 'x', 'outdoors, on the beach'], { niche: 'fitness', appIndex: 5, seed: 't', headings: ['Hammer curl', 'Preacher curl', 'Deloading', 'Rear delts', 'App', 'Spider curl'] });
  ok(eo.shots[7] === 'outdoors', 'a closer the model asked for outdoors stays outdoors');
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
  // F6 (2026-09-18): a part seen from behind or the side is never asked for as a POV of one's own body
  for (const seed of ['a', 'b', 'c']) {
    const e2 = enforce(new Array(7).fill('x'), { niche: 'fitness', appIndex: 4, seed, headings: ['Barbell row', 'Lat pulldown', 'Calf raise', 'app', 'Shrugs'] });
    ok(![e2.shots[1], e2.shots[2], e2.shots[3], e2.shots[5]].includes('pov'), `seed ${seed}: back, calf and trap headings never draw a POV (${e2.shots.join(' ')})`);
  }
  // F6b (round 3): "Seated cable row" is a row, not a cable curl; a behind part in a mirror is shot over the shoulder
  const e3 = enforce(new Array(6).fill('x'), { niche: 'fitness', appIndex: -1, seed: 'q', headings: ['Seated cable row', 'Kroc rows', 'Cable curl', 'Barbell row'] });
  ok(e3.shots[1] !== 'pov' && /back from behind mid row/.test(e3.scenes[1]), `"Seated cable row" draws the back (${e3.shots[1]})`);
  const e4 = enforce(['mirror, gym', 'crop', 'crop', 'mirror, back to the glass', 'crop', 'outdoors'], { niche: 'fitness', appIndex: -1, seed: 'q', headings: ['Kroc rows', 'Lat pulldown', 'Barbell row', 'Cable curl'] });
  ok(e4.shots[3] !== 'mirror' && e4.shots[3] !== 'pov' && /back from behind mid row/.test(e4.scenes[3]), `a row heading never takes the mirror or the POV, even when the model hints mirror (${e4.shots.join(' ')})`);
  ok(/mid cable curl/.test(e4.scenes[4]), 'a cable curl still maps to the curl anatomy');
  // F17: the subject-mode anchor names ordinary imperfections; the edits inherit the face and do not repeat it
  const sp = planSet({ subject: 'a man', scenes: ['mirror', 'crop no face'], mode: 'subject', days: true, id: 's' });
  ok(/ordinary-looking person/.test(sp.anchor.prompt) && !/ordinary-looking person/.test(sp.frames('/x/a.png')[0].prompt), 'the anchor carries the ordinary-face line; the edits do not');
  // F6c (round 5): RDLs are a hinge from behind; hanging leg raises are abs, not legs
  const e5 = enforce(new Array(6).fill('x'), { niche: 'fitness', appIndex: -1, seed: 'r', headings: ['Barbell RDLs', 'Hanging leg raises', 'Bulgarian split squats', 'Cable curl'] });
  ok(/Romanian deadlift/.test(e5.scenes[1]) && e5.shots[1] !== 'pov', `RDLs map to the hinge from behind (${e5.shots[1]})`);
  ok(/abs tensed|hanging leg raise/.test(e5.scenes[2]) && !/squat/.test(e5.scenes[2]), 'hanging leg raises map to abs, not the squat line');
  // F18 (round 5): a beach, boat or pool closer is never in a hoodie
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const e6 = enforce(new Array(6).fill('x'), { niche: 'fitness', appIndex: -1, seed, headings: ['a', 'b', 'c', 'd'] });
    const first = e6.scenes[5].split('. ')[0];
    ok(!(/beach|boat|pool/i.test(first) && /hoodie|sweatpants|joggers|t-shirt|tee/i.test(first)), `seed ${seed}: the outdoors closer dresses for its place (${first.slice(0, 60)}…)`);
  }
  // F20 (round 7): a frame with nobody in it references nothing, in subject mode too
  const so = planSet({ subject: 'a man', scenes: ['mirror', 'A shaker bottle on a bench, nobody in the frame.', 'crop no face'], mode: 'subject', days: true, id: 'o' });
  const sof = so.frames('/x/a.png');
  ok(sof[0].refs.length === 0 && /No person in the frame/.test(sof[0].prompt) && sof[1].refs[0] === '/x/a.png', 'the object frame is its own generation; the crop still references the anchor');
  // F24 (round 10): "grip" no longer routes pull-ups and pulldowns to the hammer curl
  const e7 = enforce(new Array(6).fill('x'), { niche: 'fitness', appIndex: -1, seed: 'g', headings: ['Wide grip pull ups', 'Wide grip lat pulldown', 'Grip work', 'Cable curl'] });
  ok(/chin-up/.test(e7.scenes[1]) && /mid cable row|back from behind mid row/.test(e7.scenes[2]) && e7.shots[2] !== 'pov' && /hammer curl/.test(e7.scenes[3]), `pull ups → chin-up, lat pulldown → a row from behind, grip work → forearm (${e7.shots.slice(1, 4).join(' ')})`);
  // F12 (2026-09-18): when the hook names the life's car, later car frames are edits of the hook frame
  const ap = planSet({ subject: 'none', scenes: ['a matte black Lamborghini parked on a street', 'a desk with two monitors', 'a matte black Lamborghini in an underground car park'], mode: 'aspirational', id: 'w' });
  ok(ap.anchor && ap.anchor.i === 0 && ap.anchor.refs.length === 0, 'aspirational plan takes the car hook as its anchor');
  const wf = ap.frames('/x/hook.png');
  ok(wf[0].refs.length === 0 && wf[1].refs[0] === '/x/hook.png' && /SAME CAR/.test(wf[1].prompt), 'the second car frame references the hook; the desk frame stays independent');
  ok(planSet({ subject: 'none', scenes: ['a pool at night', 'a matte black Lamborghini parked'], mode: 'aspirational', id: 'w2' }).anchor === null, 'no car in the hook: no anchor, every frame independent');
}

// 9. F23: a slide line lifted from a reference example is rejected; digits and the hook are exempt
{
  ok(/before it moves/.test(liftedFrom('every red folder event before it moves the market') ?? ''), `a 4-word run from set-01 is a lift (${liftedFrom('every red folder event before it moves the market')})`);
  ok(liftedFrom('smooth, customizable, just elite') !== null, 'a short verbatim phrase is a lift');
  ok(liftedFrom('i check it 8am, before london, no entries 15 mins either side') === null, 'an original line is not');
  ok(liftedFrom('- Lat Pulldown 3 x 10 twice a week') === null, 'a sets-x-reps line with digits is not');
  const tspec = { ...spec, niche: 'trading', rules: {}, requirements: {} };
  const lift = { hook: { lines: ['3 trading apps i wish i had in year one'], sub: [] }, ranked: [{ name: 'Forex Factory', lines: ['every red folder event', 'before it moves the market'] }, { name: 'TradingView', lines: ['2-4 pairs, 4h then 15m'] }, { name: 'x', lines: ['1% risk'] }], closer: { lines: ['z'], cta: 'go' }, caption: 'x 📈 ☕', bio: '', hashtags: [] };
  const jl = judgeCopy({ spec: tspec, data: JSON.parse(JSON.stringify(lift)), range: slideRange(tspec, 5), styleId: 'feed' });
  ok(jl.verdict.failures.some((f) => /slide 2 repeats a reference post/.test(f)) && !jl.verdict.failures.some((f) => /slide 1 repeats/.test(f)), 'the judge rejects the lifted item line and leaves the formulaic hook alone');
}

// 8. a tag line in "score" is repaired away; an x/10 rating is kept (2026-09-18)
{
  const tag = { hook: { lines: ['4 trading apps i check, ranked'], sub: [] }, ranked: [{ name: 'Forex Factory', score: 'news first', lines: ['8am, 15 mins'] }, { name: 'TradingView', score: '9/10', lines: ['2 layouts'] }, { name: 'MetaTrader 5', score: '', lines: ['1% risk'] }], closer: { lines: ['z'], cta: 'go' }, caption: 'x 📈 ☕', bio: '', hashtags: [] };
  const jt = judgeCopy({ spec, data: JSON.parse(JSON.stringify(tag)), range: slideRange(spec, 5), styleId: 'feed' });
  ok(jt.data.ranked[0].score === '' && jt.data.ranked[1].score === '9/10', `a tag line in "score" is blanked, a rating is kept (repairs: ${jt.verdict.repairs.length})`);
  // F14: the trading family never rates
  const tspec = { ...spec, niche: 'trading', rules: {}, requirements: {} };
  const jr = judgeCopy({ spec: tspec, data: JSON.parse(JSON.stringify(tag)), range: slideRange(tspec, 5), styleId: 'feed' });
  ok(jr.data.ranked[1].score === '', 'an x/10 on a trading item is dropped (the wealth references never rate)');
  // F15: a wealth mistake stays on the kinds it belongs to
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const t2 = enforce(new Array(7).fill('x'), { niche: 'trading', appIndex: 4, seed });
    const bad = t2.scenes.findIndex((sc, i) => /traffic cone/.test(sc) && !/^(car|behind|street|garage|petrol)$/.test(t2.shots[i]));
    ok(bad < 0, `seed ${seed}: no traffic cone away from the street (${t2.shots.join(' ')})`);
  }
}

// 10. the rail style (Grow with Alex): its own shape, an editorial art mode, the pair fields kept
{
  const sys = systemFor('rail');
  ok(/"verdict"/.test(sys) && /"tags"/.test(sys) && /"quiet"/.test(sys) && /named thing/i.test(sys), 'the rail shape carries loud/quiet, notes, verdict and tags');
  const rspec = { ...spec, id: 'summit-craft', niche: 'design', content: { style: 'rail' }, rules: {}, requirements: {}, assets: {} };
  const rc = { hook: { loud: 'layouts', quiet: 'steal my', lines: ['steal my layouts'], sub: [], tags: ['a', 'b', 'c'], scene: 'a red hut on a blue plain' }, ranked: [{ name: 'The Stack', quiet: 'the safe one', lines: ['one', 'two', 'three'], verdict: 'use it when unsure', scene: 'a stack of cards on sand' }, { name: 'The Band', quiet: 'a room for words', lines: ['a', 'b', 'c'], verdict: 'when the photo is busy', scene: 'a lighthouse' }], closer: { loud: 'STACK', quiet: 'comment', lines: ['drop STACK below for the full set'], cta: 'follow for more', scene: 'a horse in fog' }, caption: 'x 📈 ☕', bio: '', hashtags: [], numbering: 'up' };
  const d = direct({ spec: rspec, content: rc, styleId: 'rail', seed: 't' });
  ok(d.mode === 'editorial' && d.look === 'alex' && !d.days && d.scenes.length === 4 && /red hut/.test(d.scenes[0]), `rail direction: editorial mode, alex look, the model's scenes kept (${d.mode}/${d.look})`);
  const plan = planSet({ subject: 'none', scenes: d.scenes, look: d.look, mode: d.mode, id: 'p' });
  const fr = plan.frames();
  ok(plan.anchor === null && fr.length === 4 && fr.every((f) => f.refs.length === 0) && /cinematic editorial photograph/.test(fr[0].prompt) && /No text, no letters/.test(fr[0].prompt), 'editorial frames are independent generations under the alex look and the editorial guard');
  const r = toRenderable({ ...rspec }, JSON.parse(JSON.stringify(rc)));
  ok(r.content.hook.loud === 'layouts' && r.content.hook.tags.length === 3 && r.content.ranked[0].verdict === 'use it when unsure' && r.content.ranked[0].quiet === 'the safe one' && r.content.closer.loud === 'STACK', 'toRenderable keeps the rail fields');
  const jr = judgeCopy({ spec: rspec, data: JSON.parse(JSON.stringify(rc)), range: slideRange(rspec, 4), styleId: 'rail' });
  ok(jr.verdict.pass, `a rail set passes the judge (${jr.verdict.failures.join('; ') || 'no failures'})`);
  const lifted = { ...rc, closer: { ...rc.closer, lines: ['comment LAYOUT and i will send you all eight'] } };
  ok(!judgeCopy({ spec: rspec, data: JSON.parse(JSON.stringify(lifted)), range: slideRange(rspec, 4), styleId: 'rail' }).verdict.pass, 'a rail closer lifted from the family\'s post is rejected');
}

// 11. the 2026-09-18 families (docs/QUALITY.md §3.12–3.15): sport / fashion / life / everyday, F26, F29, F30, the soft feed and the App Store card
{
  const { familyFor } = await import('../engine/scenes.mjs');
  ok(familyFor('football') === 'sport' && familyFor('basketball') === 'sport' && familyFor('fashion') === 'fashion' && familyFor('skincare') === 'life' && familyFor('GLP-1') === 'life' && familyFor('personal finance') === 'everyday' && familyFor('language') === 'everyday' && familyFor('trading') === 'trading' && familyFor('gym') === 'gym' && familyFor('nutrition') === 'food', 'familyFor maps the owner\'s niches (F26: personal finance and language no longer fall to trading)');
  for (const [niche, fam] of [['football', 'sport'], ['fashion', 'fashion'], ['skincare', 'life'], ['personal finance', 'everyday']]) {
    for (const seed of ['a', 'b', 'c']) {
      const e = enforce(new Array(8).fill('x'), { niche, appIndex: 3, seed });
      ok(new Set(e.shots).size === e.shots.length && e.scenes.length === 8 && e.family === fam, `${niche}/${seed}: eight ${fam} frames, no kind twice (${e.shots.join(' ')})`);
      ok(!/An iPhone lying face up/.test(e.scenes[3]), `${niche}/${seed}: the app slide is an ordinary frame (the card goes over it), not a phone on a bench`);
    }
  }
  const sp = enforce(new Array(7).fill('x'), { niche: 'football', appIndex: 3, seed: 't' });
  ok(sp.scenes.some((s) => /sports photographer/.test(s)) && sp.scenes.some((s) => /Taken on an iPhone at training/.test(s)), 'a football set mixes the photographer\'s match frames with the phone\'s');
  const bb = enforce(new Array(6).fill('x'), { niche: 'basketball', seed: 't' });
  ok(bb.scenes.some((s) => /basketball|hardwood/.test(s)) && !bb.scenes.some((s) => /football/.test(s)), 'the basketball set uses the court and the basketball, never the football');
  const fspec = { ...spec, id: 'attire', niche: 'fashion', content: { style: 'feed' }, rules: {}, requirements: { must_show_app: true, language: 'English' }, assets: {} };
  const content = { subject: 'A lean muscular man in his early twenties', hook: { lines: ['7 fashion mistakes'] }, ranked: [{ name: 'a' }, { name: 'Bonus', showsApp: true }, { name: 'c' }], closer: { lines: ['4. carry yourself well'], cta: 'follow for more' } };
  const d = direct({ spec: fspec, content, styleId: 'feed', seed: 't' });
  ok(d.family === 'fashion' && d.mode === 'subject' && d.days && /woman/.test(d.subject) && !/muscular man/.test(d.subject), `fashion direction: subject mode, days, the family's woman not the model's man (${d.subject.slice(0, 44)})`);
  const de = direct({ spec: { ...fspec, niche: 'language' }, content, styleId: 'feed', seed: 't' });
  ok(de.family === 'everyday' && de.mode === 'aspirational', 'everyday direction: aspirational, no recurring face');
  const ds = direct({ spec: { ...fspec, niche: 'football' }, content, styleId: 'feed', seed: 't' });
  ok(ds.family === 'sport' && /young man|teenage boy/.test(ds.subject), 'sport direction: a young player');
  // F29: the language line
  const es = buildCopyRequest({ spec: { ...fspec, niche: 'GLP-1', requirements: { language: 'Spanish' } }, instruction: 'x', slides: 6 });
  ok(/LANGUAGE: write every slide line[^]*in Spanish/.test(es.user) && /bathroom mirror/.test(es.user), 'a Spanish campaign gets the language line and the life direction');
  ok(!/LANGUAGE:/.test(buildCopyRequest({ spec: fspec, instruction: 'x', slides: 6 }).user), 'an English campaign gets no language line');
  ok(/killing your football career/.test(buildCopyRequest({ spec: { ...fspec, niche: 'football' }, instruction: 'x', slides: 6 }).user), 'a football campaign gets the sport direction');
  ok(/Wearing wrinkled/.test(buildCopyRequest({ spec: fspec, instruction: 'x', slides: 6 }).user), 'a fashion campaign gets the fashion direction');
  ok(/a desk by a window/i.test(buildCopyRequest({ spec: { ...fspec, niche: 'personal finance' }, instruction: 'x', slides: 6 }).user), 'personal finance gets the everyday direction, not the trading one');
  // the numbers rule is off for fashion, sport and life; on for everyday
  const nonum = { hook: { lines: ['7 fashion mistakes'], sub: [] }, ranked: [{ name: 'a', lines: ['wrinkles read careless'] }, { name: 'b', lines: ['loud logos look tacky'] }, { name: 'Bonus', lines: ['the app builds combos'], showsApp: true }, { name: 'd', lines: ['tailoring is everything'] }], closer: { lines: ['5. carry yourself well'], cta: 'follow for more' }, caption: 'x 👗 ✨', bio: '', hashtags: [] };
  ok(!judgeCopy({ spec: fspec, data: JSON.parse(JSON.stringify(nonum)), range: slideRange(fspec, 6), styleId: 'feed' }).verdict.failures.some((f) => /carry a number/.test(f)), 'fashion items need no numbers (0 of 20 reference items carry one)');
  // F31: a reference heading reused word for word (three words never form a 4-gram)
  const lifted = { ...nonum, ranked: nonum.ranked.map((x, i) => (i === 0 ? { ...x, name: '1. Wearing wrinkled clothes.' } : x)) };
  ok(judgeCopy({ spec: fspec, data: JSON.parse(JSON.stringify(lifted)), range: slideRange(fspec, 6), styleId: 'feed' }).verdict.failures.some((f) => /reference post's own heading/.test(f)), 'a reference post\'s heading on an item is rejected (F31)');
  ok(!judgeCopy({ spec: fspec, data: JSON.parse(JSON.stringify(nonum)), range: slideRange(fspec, 6), styleId: 'feed' }).verdict.failures.some((f) => /own heading/.test(f)), 'an original heading passes');
  ok(judgeCopy({ spec: { ...fspec, niche: 'personal finance' }, data: JSON.parse(JSON.stringify(nonum)), range: slideRange(fspec, 6), styleId: 'feed' }).verdict.failures.some((f) => /carry a number/.test(f)), 'everyday items still need numbers');
  // toRenderable: the card slide, the closer as item N
  const r = toRenderable(fspec, JSON.parse(JSON.stringify(nonum)), { appScreen: 'x.png' });
  ok(r.content.ranked[2].card === true && r.content.ranked[2].bonus === true && !r.content.ranked[2].screen && !r.content.closer.screen && !r.content.closer.card, 'the fashion app slide is the App Store card (no screen), unnumbered, and the closer carries no second app');
  ok(r.content.closerRank === 5 && r.content.ranked[0].rank === 1 && r.content.ranked[1].rank === 2 && r.content.ranked[3].rank === 3 && r.content.closer.lines[0] === 'carry yourself well', `the closer is item 5 and the items above count 1 → 3 (${r.content.ranked.map((x) => x.rank ?? '-').join(' ')})`);
  const noapp = toRenderable(fspec, JSON.parse(JSON.stringify({ ...nonum, ranked: nonum.ranked.filter((x) => !x.showsApp) })), {});
  ok(noapp.content.closer.card === true, 'a fashion set without an app slide puts the card on the closer');
  const tspec = { ...spec, niche: 'trading', content: { style: 'feed' } };
  ok(!toRenderable(tspec, JSON.parse(JSON.stringify(nonum)), { appIcon: 'i.png' }).content.ranked[2].card, 'a trading set keeps the icon device, never the card');
  const { byId } = await import('../engine/styles/registry.mjs');
  const feed = byId('feed');
  ok(feed.canvasFor({ niche: 'fashion' }).h === 1920 && feed.canvasFor({ niche: 'trading' }).h === 1440, 'the feed canvas is 9:16 for the soft families and 4:5 for trading');
}

// 12. the demo's short sets: an over-long set is trimmed, not rejected (2026-09-19)
{
  const dspec = { ...spec, niche: 'fitness', content: { style: 'feed' }, requirements: { ...spec.requirements, min_slides: 4, max_slides: 10, must_show_app: true }, rules: {} };
  const five = () => ({ hook: { lines: ['what changed my training this year'], sub: [] },
    ranked: [{ name: 'a', lines: ['3 x 10'] }, { name: 'b', lines: ['2 x a week'] }, { name: 'Bonus', lines: ['the app tracked it'], showsApp: true }],
    closer: { lines: ['z'], cta: 'go' }, caption: 'x 💪 🔥', bio: '', hashtags: [] });
  const j = judgeCopy({ spec: dspec, data: five(), range: slideRange(dspec, 4), styleId: 'feed' });
  ok(j.count === 4 && j.data.ranked.length === 2, `a 5-slide set for an ask of 4 is trimmed to 4 (${j.count} slides, ${j.data.ranked.length} ranked)`);
  ok(j.data.ranked.some((r) => r.showsApp), 'the app slide survives the trim wherever it sat');
  ok(j.verdict.repairs.some((r) => /dropped rather than paying/.test(r)), 'the trim is recorded as a repair');
  ok(!j.verdict.failures.some((f) => /slides returned/.test(f)), `the count no longer fails (${j.verdict.failures.join('; ') || 'no failures'})`);
  // a hook that promises a number must not be trimmed under it: the hook would lie
  const counted = { ...five(), hook: { lines: ['5 things that changed my training'], sub: [] } };
  const jc = judgeCopy({ spec: dspec, data: counted, range: slideRange(dspec, 4), styleId: 'feed' });
  ok(jc.data.ranked.length === 3 && jc.verdict.failures.some((f) => /slides returned/.test(f)), 'a hook that promises a count is rejected, never trimmed under its own promise');
  // a set inside the range is untouched
  const ok8 = judgeCopy({ spec, data: five(), range: slideRange(spec, { min: 5, max: 8 }), styleId: 'feed' });
  ok(ok8.data.ranked.length === 3 && !ok8.verdict.repairs.some((r) => /dropped rather/.test(r)), 'a set already inside the range is not trimmed');
}

console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
