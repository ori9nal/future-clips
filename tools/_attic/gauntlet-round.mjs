// Gauntlet round runner: two campaigns, two niches, judged by the user.
//
//   node tools/gauntlet-round.mjs [--round 1]
//
// Both sets go through the real engine path (renderConstellation -> the
// constellation solver -> the object registry), not a bespoke one-off, so a
// correction from the judge lands on the engine rather than on a picture.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { renderConstellation } from '../../engine/_attic/render-constellation.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const ROUND = arg('--round', '1');
const OUT = path.join('output', `gauntlet-r${ROUND}`);

/* ═══════════════ CAMPAIGN A — LEDGERLY ═══════════════
 * A payouts app for paid clippers. Modelled on a real clipping brief: the
 * product MUST appear in the carousel, so slides 2 and 5 carry an actual app
 * screen with the campaign's own numbers on it.
 * Dark ground, one green accent, sans voice, data-heavy.
 */
const LEDGERLY = {
  id: 'ledgerly',
  name: 'LEDGERLY',
  handle: '@ledgerly',
  canvas: { w: 1080, h: 1350 },
  palette: { ink: '#EDEFF2', paper: '#0E1116' },
  ground: '#0E1116',
  rules: { appOnSlides: [2, 5], accent: '#3DDC84' },
  slides: [
    { title: 'we paid clippers $2.4m last month', density: 'cover',
      objects: [
        { id: 'app-balance', label: null },
        { id: 'chart-line', label: null, opts: { label: '$2.4m', color: '#3DDC84' } },
      ] },
    { title: 'the payout is not the hard part', density: 'full',
      objects: [
        { id: 'app-payout', label: 'Paid in 48 hours' },
        { id: 'stat', label: 'Cleared, not pending', opts: { value: '48h', color: '#3DDC84' } },
        { id: 'grid-weeks', label: 'Post daily, get paid weekly', opts: { color: '#3DDC84' } },
        { id: 'chart-zones', label: 'Every view counted', opts: { a: '#1F6B45', b: '#3DDC84', from: 'Mon', to: 'Sun' } },
      ] },
    { title: 'most clippers quit at week three', density: 'full',
      objects: [
        { id: 'chart-line', label: 'Week three is the dip', opts: { points: [40, 62, 74, 30, 26, 34, 58], color: '#3DDC84' } },
        { id: 'grid-weeks', label: 'The ones who stay', opts: { color: '#3DDC84' } },
        { id: 'stat', label: 'Of accounts go quiet', opts: { value: '71%', color: '#E6197F' } },
        { id: 'stopwatch', label: 'It takes eight weeks' },
      ] },
    { title: 'volume beats taste, early', density: 'full',
      objects: [
        { id: 'stat', label: 'Posts before it clicks', opts: { value: '30', color: '#3DDC84' } },
        { id: 'chart-zones', label: 'One will spike', opts: { a: '#1F6B45', b: '#3DDC84', from: '01', to: '30' } },
        { id: 'rings', label: 'Then repeat it' },
        { id: 'grid-weeks', label: 'Daily, not perfect', opts: { color: '#3DDC84' } },
      ] },
    { title: 'watch the balance, not the likes', density: 'full',
      objects: [
        { id: 'app-balance', label: 'This is the only scoreboard' },
        { id: 'chart-line', label: 'Compounding, slowly', opts: { label: '+$284', color: '#3DDC84' } },
        { id: 'stat', label: 'Median first month', opts: { value: '$284', color: '#3DDC84' } },
      ] },
    { title: 'start on the free tier', density: 'closer',
      objects: [
        { id: 'app-payout', label: null },
        { id: 'stat', label: null, opts: { value: '$0', color: '#3DDC84' } },
      ] },
  ],
};

/* ═══════════════ CAMPAIGN B — CINDER ═══════════════
 * A specialty coffee roastery. Deliberately the opposite world: bone paper,
 * warm rust accent, serif voice, physical objects, no screens, no charts on the
 * cover. If both campaigns come out looking alike, the templates are doing too
 * much and the elements too little.
 */
const CINDER = {
  id: 'cinder',
  name: 'CINDER',
  handle: '@cinder.roasters',
  canvas: { w: 1080, h: 1350 },
  palette: { ink: '#1C1712', paper: '#F4EEE2' },
  ground: '#F4EEE2',
  rules: { accent: '#B4432A' },
  slides: [
    { title: 'your grinder is the problem', density: 'cover',
      objects: [
        { id: 'grinder', label: null },
        { id: 'beans', label: null },
      ] },
    { title: 'buy the beans last', density: 'full',
      objects: [
        { id: 'grinder', label: 'Grind fresh, always' },
        { id: 'brew-scale', label: 'Weigh it, do not guess' },
        { id: 'coffee-bag', label: 'Roasted within 14 days' },
        { id: 'cup', label: 'Then judge the cup' },
      ] },
    { title: 'the ratio nobody teaches you', density: 'full',
      objects: [
        { id: 'brew-scale', label: '18g in, 300g out', opts: { grams: '18.0', seconds: '2:45' } },
        { id: 'pour-over', label: 'Bloom for 30 seconds' },
        { id: 'stat', label: 'Water to coffee', opts: { value: '1:16', color: '#B4432A' } },
        { id: 'cup', label: 'Adjust by taste, not maths' },
      ] },
    { title: 'sour means fast, bitter means slow', density: 'full',
      objects: [
        { id: 'pour-over', label: 'Sour? Grind finer' },
        { id: 'stopwatch', label: 'Bitter? Grind coarser' },
        { id: 'beans', label: 'One change at a time' },
        { id: 'brew-scale', label: 'Same dose every time', opts: { grams: '18.0', seconds: '3:10' } },
      ] },
    { title: 'a bag should last two weeks', density: 'full',
      objects: [
        { id: 'coffee-bag', label: 'Not two months', opts: { origin: 'COLOMBIA', name: 'Huila', notes: 'CARAMEL · PLUM · COCOA' } },
        { id: 'stat', label: 'Grams a day', opts: { value: '18g', color: '#B4432A' } },
        { id: 'grid-weeks', label: 'Fourteen good mornings', opts: { color: '#5A6B3C' } },
      ] },
    { title: 'follow for the boring fundamentals', density: 'closer',
      objects: [
        { id: 'cup', label: null },
        { id: 'coffee-bag', label: null, opts: { origin: 'ETHIOPIA', name: 'Guji' } },
      ] },
  ],
};

const DENSITY = {
  cover:  { titleSize: [56, 128], centreW: 0.76, centreH: 0.34, maxLines: 4 },
  full:   { titleSize: [40, 84],  centreW: 0.54, centreH: 0.22, maxLines: 3 },
  closer: { titleSize: [50, 112], centreW: 0.70, centreH: 0.30, maxLines: 3 },
};

async function renderCampaign(c) {
  const dir = path.join(OUT, c.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const files = [];

  for (let i = 0; i < c.slides.length; i++) {
    const s = c.slides[i];
    const r = await renderConstellation({
      canvas: c.canvas,
      title: s.title,
      handle: c.handle,
      palette: c.palette,
      ground: c.ground,
      objects: s.objects,
      seed: 1000 + i * 37,
      ...DENSITY[s.density],
    });
    const f = path.join(dir, `${String(i + 1).padStart(2, '0')}.png`);
    fs.writeFileSync(f, r.buf);
    files.push(f);
    console.log(`  ${c.name} ${i + 1}/${c.slides.length}  placed ${r.placed.length}/${s.objects.length}` +
      (r.dropped.length ? `  DROPPED [${r.dropped.join(',')}]` : '') + `  title ${r.titleSize}px`);
  }

  // contact sheet
  const CW = 300, CH = 375, PAD = 10, COLS = 3;
  const rows = Math.ceil(files.length / COLS);
  const layers = [];
  for (let i = 0; i < files.length; i++) {
    layers.push({
      input: await sharp(files[i]).resize(CW, CH, { fit: 'fill' }).png().toBuffer(),
      left: PAD + (i % COLS) * (CW + PAD),
      top: PAD + Math.floor(i / COLS) * (CH + PAD),
    });
  }
  const sheet = path.join(OUT, `${c.id}-SHEET.png`);
  await sharp({ create: {
    width: COLS * CW + (COLS + 1) * PAD, height: rows * CH + (rows + 1) * PAD,
    channels: 3, background: '#8A8A8A',
  } }).composite(layers).png().toFile(sheet);
  console.log(`  -> ${sheet}`);
  return sheet;
}

console.log(`GAUNTLET ROUND ${ROUND}\n`);
for (const c of [LEDGERLY, CINDER]) {
  console.log(`${c.name} (${c.slides.length} slides)`);
  await renderCampaign(c);
  console.log('');
}
