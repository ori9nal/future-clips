// Generate a character sheet, then cut the poses out of it.
//
// The consistency trick: draw every pose in a SINGLE generation. One image is
// inherently self-consistent, so the figure cannot drift between poses the way
// it does across separate calls — which is the failure that killed the earlier
// photoreal attempts. Cut the sheet up afterwards and each pose is a matched
// asset.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { generate, costReport } from '../engine/providers/image.mjs';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, 'output/gen/cache');
const OUT = path.join(ROOT, 'output/gen/character');

const SHEET = [
  'Character model sheet for a fitness brand mascot, flat vector cel-shaded illustration.',
  'One single male figure repeated in four full-body poses, evenly spaced in one row,',
  'all identical in style, proportion and colour: charcoal grey muscular body with hard-edged',
  'cel shading, spiky black hair, blank glowing white eyes and no other facial features,',
  'plain black shorts, plain black trainers.',
  'Poses left to right: standing arms crossed, mid push-up, doing a squat, flexing both arms.',
  'Flat solid cream background, no shadows on the background, no text, no labels, no borders,',
  'thick clean outlines, limited flat colour palette, high contrast, sticker style.',
].join(' ');

const variants = Number(process.argv[2] ?? 3);
const quality = process.argv[3] ?? 'medium';

fs.mkdirSync(OUT, { recursive: true });
console.log(`generating ${variants} sheet(s) at ${quality}…`);

const sheets = [];
for (let i = 0; i < variants; i++) {
  const r = await generate({
    root: ROOT, cacheDir: CACHE, prompt: SHEET,
    size: '1536x1024', quality, label: 'sheet', variant: i,
  });
  const meta = await sharp(r.file).metadata();
  console.log(`  sheet ${i}: ${r.cached ? 'cached' : `$${r.usd.toFixed(4)}`}  ${meta.width}x${meta.height}`);
  sheets.push(r.file);
}

// contact sheet so the choice is made by looking, not by trusting the first result
const TW = 620;
const tiles = [];
for (let i = 0; i < sheets.length; i++) {
  const buf = await sharp(sheets[i]).resize(TW, Math.round(TW * 1024 / 1536), { fit: 'cover' }).jpeg().toBuffer();
  tiles.push({ input: buf, left: 0, top: i * (Math.round(TW * 1024 / 1536) + 20) + 20 });
  tiles.push({
    input: Buffer.from(`<svg width="${TW}" height="20"><rect width="${TW}" height="20" fill="#000"/><text x="4" y="15" fill="#0f0" font-size="13" font-family="monospace">variant ${i}</text></svg>`),
    left: 0, top: i * (Math.round(TW * 1024 / 1536) + 20),
  });
}
const th = Math.round(TW * 1024 / 1536);
await sharp({ create: { width: TW, height: sheets.length * (th + 20), channels: 3, background: '#222' } })
  .composite(tiles).jpeg({ quality: 88 }).toFile(path.join(OUT, 'sheets.jpg'));

console.log('\ncost:', JSON.stringify(costReport(), null, 1));
console.log('review:', path.join(OUT, 'sheets.jpg'));
