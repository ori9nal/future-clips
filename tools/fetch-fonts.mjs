// Downloads static TTFs from the Google Fonts CSS API into assets/fonts/.
// Runs as `prebuild` on Vercel, where the 6 MB of fonts are not in the source
// payload; locally it is a no-op because the tracked files already exist.
// Legacy UA => Google serves .ttf (satori cannot read woff2).
// Variable families are requested at a specific axis tuple; Google instances them server-side.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'assets/fonts';
fs.mkdirSync(OUT, { recursive: true });

// UA that makes fonts.googleapis.com emit real TTF (server-side instanced for variable families)
const UA = 'Mozilla/5.0 (Linux; U; Android 2.2; en-us; DROID2 GLOBAL Build/S273) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1';

const REQUESTS = [
  // [outputName, css2 query]
  ['Anton-Regular',              'family=Anton'],
  ['ArchivoBlack-Regular',       'family=Archivo+Black'],

  ['PlayfairDisplay-Regular',    'family=Playfair+Display:ital,wght@0,400'],
  ['PlayfairDisplay-Medium',     'family=Playfair+Display:ital,wght@0,500'],
  ['PlayfairDisplay-Bold',       'family=Playfair+Display:ital,wght@0,700'],
  ['PlayfairDisplay-Black',      'family=Playfair+Display:ital,wght@0,900'],
  ['PlayfairDisplay-Italic',     'family=Playfair+Display:ital,wght@1,400'],
  ['PlayfairDisplay-BoldItalic', 'family=Playfair+Display:ital,wght@1,700'],
  ['PlayfairDisplay-BlackItalic','family=Playfair+Display:ital,wght@1,900'],

  ['Archivo-Regular',            'family=Archivo:ital,wdth,wght@0,100,400'],
  ['Archivo-Medium',             'family=Archivo:ital,wdth,wght@0,100,500'],
  ['Archivo-SemiBold',           'family=Archivo:ital,wdth,wght@0,100,600'],
  ['Archivo-Bold',               'family=Archivo:ital,wdth,wght@0,100,700'],
  ['Archivo-ExtraBold',          'family=Archivo:ital,wdth,wght@0,100,800'],
  ['Archivo-Italic',             'family=Archivo:ital,wdth,wght@1,100,400'],
  ['Archivo-BoldItalic',         'family=Archivo:ital,wdth,wght@1,100,700'],
  // expanded (wdth 125) — the "display sport" face
  ['ArchivoExpanded-ExtraBold',        'family=Archivo:ital,wdth,wght@0,125,800'],
  ['ArchivoExpanded-ExtraBoldItalic',  'family=Archivo:ital,wdth,wght@1,125,800'],
  ['ArchivoExpanded-BoldItalic',       'family=Archivo:ital,wdth,wght@1,125,700'],
  // condensed (wdth 62) — poster caps
  ['ArchivoCondensed-Black',     'family=Archivo:ital,wdth,wght@0,62.5,900'],
  ['ArchivoCondensed-ExtraBold', 'family=Archivo:ital,wdth,wght@0,62.5,800'],

  ['JetBrainsMono-Regular',      'family=JetBrains+Mono:ital,wght@0,400'],
  ['JetBrainsMono-Medium',       'family=JetBrains+Mono:ital,wght@0,500'],
  ['JetBrainsMono-Bold',         'family=JetBrains+Mono:ital,wght@0,700'],

  // the pairing faces (engine/pairings.mjs) and the caption faces, folded in
  // from the one-off fetch tools so a fresh host can rebuild all 56
  ['AbrilFatface-Regular','family=Abril+Fatface'],
  ['BebasNeue-Regular','family=Bebas+Neue:wght@400'],
  ['BricolageGrotesque-Bold','family=Bricolage+Grotesque:opsz,wdth,wght@96,100,700'],
  ['BricolageGrotesque-ExtraBold','family=Bricolage+Grotesque:opsz,wdth,wght@96,100,800'],
  ['BricolageGrotesque-Medium','family=Bricolage+Grotesque:opsz,wdth,wght@14,100,500'],
  ['Caveat-Bold','family=Caveat:wght@700'],
  ['CormorantGaramond-Bold','family=Cormorant+Garamond:ital,wght@0,700'],
  ['CormorantGaramond-Italic','family=Cormorant+Garamond:ital,wght@1,400'],
  ['DMSerifDisplay-Italic','family=DM+Serif+Display:ital@1'],
  ['DMSerifDisplay-Regular','family=DM+Serif+Display:ital@0'],
  ['FamiljenGrotesk-Bold','family=Familjen+Grotesk:wght@700'],
  ['Fraunces-Black','family=Fraunces:ital,opsz,wght@0,9..144,900'],
  ['Fraunces-BlackItalic','family=Fraunces:ital,opsz,wght@1,9..144,900'],
  ['InstrumentSerif-Italic','family=Instrument+Serif:ital@1'],
  ['InstrumentSerif-Regular','family=Instrument+Serif:ital@0'],
  ['LibreBaskerville-Italic','family=Libre+Baskerville:ital,wght@1,400'],
  ['LibreBaskerville-Regular','family=Libre+Baskerville:ital,wght@0,400'],
  ['Manrope-ExtraBold','family=Manrope:wght@800'],
  ['Manrope-Medium','family=Manrope:wght@500'],
  ['Newsreader-Italic','family=Newsreader:ital,opsz,wght@1,6..72,400'],
  ['Newsreader-MediumItalic','family=Newsreader:ital,opsz,wght@1,6..72,500'],
  ['Newsreader-Regular','family=Newsreader:ital,opsz,wght@0,6..72,400'],
  ['Newsreader-SemiBold','family=Newsreader:ital,opsz,wght@0,6..72,600'],
  ['Oswald-Bold','family=Oswald:wght@700'],
  ['Outfit-Black','family=Outfit:wght@900'],
  ['Outfit-Medium','family=Outfit:wght@500'],
  ['Poppins-Bold','family=Poppins:ital,wght@0,700'],
  ['Poppins-SemiBold','family=Poppins:ital,wght@0,600'],
  ['SpaceGrotesk-Bold','family=Space+Grotesk:wght@700'],
  ['SpaceGrotesk-Medium','family=Space+Grotesk:wght@500'],
  ['Syne-ExtraBold','family=Syne:wght@800'],
  ['Unbounded-Black','family=Unbounded:wght@900'],
];

async function css(query) {
  const url = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.text();
}

let ok = 0, fail = 0;
for (const [name, query] of REQUESTS) {
  const dest = path.join(OUT, `${name}.ttf`);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) { console.log('skip  ', name); ok++; continue; }
  try {
    const sheet = await css(query);
    const m = sheet.match(/src:\s*url\((https:\/\/[^)]+)\)/);
    if (!m) throw new Error('no font url in css:\n' + sheet.slice(0, 300));
    const buf = Buffer.from(await (await fetch(m[1], { headers: { 'User-Agent': UA } })).arrayBuffer());
    // sniff: satori needs sfnt (ttf/otf) or woff — never woff2
    const tag = buf.subarray(0, 4).toString('latin1');
    const sfnt = buf.readUInt32BE(0) === 0x00010000 || tag === 'OTTO' || tag === 'true' || tag === 'ttcf';
    if (!sfnt && tag !== 'wOFF') throw new Error(`unusable font format "${tag}" (woff2?)`);
    fs.writeFileSync(dest, buf);
    console.log('fetch ', name.padEnd(30), (buf.length / 1024 | 0) + 'kb', tag === 'wOFF' ? 'WOFF' : 'sfnt');
    ok++;
  } catch (e) {
    console.log('FAIL  ', name.padEnd(30), e.message.split('\n')[0]);
    fail++;
  }
}
console.log(`\n${ok} ok, ${fail} failed -> ${OUT}`);
