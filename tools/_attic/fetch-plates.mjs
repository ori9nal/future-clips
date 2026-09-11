// CC0 / CC-BY photographic plates from Wikimedia Commons for the `photo` background
// type. These live under assets/inhouse-only/ and the engine refuses to touch that
// path when PRODUCTION=true. Attribution is written alongside each file.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'DRIFT-carousel-inhouse-test/0.1 (local research; node)';
const OUT = 'assets/inhouse-only/plates';
fs.mkdirSync(OUT, { recursive: true });

const WANTED = [
  ['night-moon-clouds', 'File:Moon appearing behind dark clouds at dusk.jpg'],
  ['night-crescent',    'File:Crescent Moon in the Night Sky.jpg'],
  ['night-moon-dark',   'File:Moon in dark sky.jpg'],
  ['night-fullmoon',    'File:Full Moon Night Sky.jpg'],
  ['night-sky-moonlit', 'File:NIGHT SKY BRIGHTENED BY FULL MOON.jpg'],
];

const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(
  WANTED.map(([, t]) => t).join('|')
)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2000`;

const j = await (await fetch(api, { headers: { 'User-Agent': UA } })).json();
const byTitle = new Map(Object.values(j.query.pages).map((p) => [p.title, p]));
const credits = [];

for (const [slug, title] of WANTED) {
  const p = byTitle.get(title);
  const ii = p?.imageinfo?.[0];
  if (!ii) { console.log('MISS', title); continue; }
  const dest = path.join(OUT, `${slug}.jpg`);
  if (!fs.existsSync(dest)) {
    const buf = Buffer.from(await (await fetch(ii.thumburl || ii.url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    fs.writeFileSync(dest, buf);
    console.log('saved', slug, `${ii.thumbwidth}x${ii.thumbheight}`, (buf.length / 1024 | 0) + 'kb');
  } else console.log('skip ', slug);
  const strip = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();
  credits.push({
    file: `${slug}.jpg`,
    source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
    license: strip(ii.extmetadata?.LicenseShortName?.value),
    author: strip(ii.extmetadata?.Artist?.value),
  });
}

fs.writeFileSync(path.join(OUT, 'CREDITS.json'), JSON.stringify(credits, null, 2));
console.log(`\n${credits.length} plates -> ${OUT} (CREDITS.json written)`);
