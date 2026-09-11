// One set → one contact sheet, with the world / grade / fonts / cost line under it.
// usage: node tools/sheet-set.mjs <output/sets dir name> <label>   → output/gauntlet/round-<label>.jpg
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
const [set, round] = process.argv.slice(2);
const d = path.join('output/sets', set);
const files = fs.readdirSync(d).filter(f => /^slide-\d+\.png$/.test(f)).sort((a,b)=>+a.match(/\d+/)[0]-+b.match(/\d+/)[0]);
const m0 = await sharp(path.join(d, files[0])).metadata();
const TH = 440, TW = Math.round(TH * (m0.width / m0.height)), comps = [];
for (let i = 0; i < files.length; i++) comps.push({ input: await sharp(path.join(d, files[i])).resize(TW, TH, { fit: 'cover' }).jpeg().toBuffer(), left: i * TW, top: 0 });
fs.mkdirSync('output/gauntlet', { recursive: true });
const out = `output/gauntlet/round-${round}.jpg`;
await sharp({ create: { width: files.length * TW, height: TH, channels: 3, background: '#181818' } }).composite(comps).jpeg({ quality: 90 }).toFile(out);
const post = JSON.parse(fs.readFileSync(path.join(d, 'post.json'), 'utf8'));
console.log(files.length, 'slides →', out);
console.log('caption:', post.caption);
if (post.world) console.log('world:', post.world.label, '· grade:', post.look, '· fonts:', post.pairing?.id, `(${post.pairing?.head}/${post.pairing?.body})`);
console.log(`COST round ${round}: copy $${post.cost.copy} + art $${post.cost.art} = $${post.cost.total}`);
