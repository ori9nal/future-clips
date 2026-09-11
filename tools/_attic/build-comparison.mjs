// Side-by-side plates for COMPARISON.md: our slide next to the reference slide
// its family was derived from, at identical scale, on a neutral ground.
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'output/comparison';
fs.mkdirSync(OUT, { recursive: true });
const REF = 'Carousel examples';

const PAIRS = [
  { id: '1-editorial',
    mine: 'output/final/f1-p01-B/01.png',
    ref: path.join(REF, '3', 'Lazy habits that make athletes unstoppable -Every athlete who’s still improving after five years.jpg'),
    mineLabel: 'DRIFT · F1 CUTOUT-EDITORIAL · cover',
    refLabel: 'reference · folder 3 · @papanca.io · cover' },
  { id: '2-sport',
    mine: 'output/final/f2-p09-B/01.png',
    ref: path.join(REF, '13', 'Nobody warned me running would do all of this.I started to get fit.I ended up sleeping better, e.jpg'),
    mineLabel: 'DRIFT · F2 CUTOUT-SPORT · cover',
    refLabel: 'reference · folder 13 · cover' },
  { id: '3-character',
    mine: 'output/final/f3-p05-A/01.png',
    ref: path.join(REF, '2', 'snaptik-app-7666127981156306190-slide-1.jpg'),
    mineLabel: 'DRIFT · F3 POSTER-CHARACTER · cover',
    refLabel: 'reference · folder 2 · Bedrock Form · cover' },
  { id: '4-mono',
    mine: 'output/final/f4-p07-B/03.png',
    ref: path.join(REF, '4', '5 financial rules you should know by 30 #personalfinance (3).jpg'),
    mineLabel: 'DRIFT · F4 TYPE-MONO · interior',
    refLabel: 'reference · folder 4 · @whymattrs · interior' },
  { id: '5-bold',
    mine: 'output/final/f5-p04-B/02.png',
    ref: path.join(REF, '12', 'Fitness brands spend $3K-8K per product photoshoot coordinating locations, athletes, and lightin (15).jpg'),
    mineLabel: 'DRIFT · F5 TYPE-BOLD · interior',
    refLabel: 'reference · folder 12 · closer' },
];

const H = 900, GAP = 26, BG = '#8E8E8E';

function label(text, w) {
  const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="34">
      <text x="0" y="22" font-family="Menlo,DejaVu Sans Mono,monospace" font-size="17" fill="#1A1A1A">${esc}</text>
    </svg>`
  );
}

for (const p of PAIRS) {
  for (const f of [p.mine, p.ref]) if (!fs.existsSync(f)) throw new Error(`missing: ${f}`);
  const a = await sharp(p.mine).resize({ height: H }).png().toBuffer();
  const b = await sharp(p.ref).resize({ height: H }).png().toBuffer();
  const am = await sharp(a).metadata(), bm = await sharp(b).metadata();
  const W = am.width + bm.width + GAP * 3;
  const total = H + 34 + GAP * 2;
  await sharp({ create: { width: W, height: total, channels: 3, background: BG } })
    .composite([
      { input: label(p.mineLabel, am.width), left: GAP, top: GAP - 8 },
      { input: label(p.refLabel, bm.width), left: GAP * 2 + am.width, top: GAP - 8 },
      { input: a, left: GAP, top: GAP + 26 },
      { input: b, left: GAP * 2 + am.width, top: GAP + 26 },
    ])
    .png().toFile(path.join(OUT, `${p.id}.png`));
  console.log('pair', p.id, `${am.width + bm.width + GAP * 3}x${total}`);
}
console.log(`\n${PAIRS.length} comparison plates -> ${OUT}/`);
