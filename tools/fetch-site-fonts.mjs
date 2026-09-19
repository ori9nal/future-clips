// Self-hosts the marketing site's three families so the page makes no
// third-party font requests (first paint stopped waiting on fonts.googleapis;
// no visitor data reaches Google). Downloads the latin woff2 subsets that
// Google serves to a current browser into future-clips-site/fonts/ and prints
// the @font-face block to design/fonts.css: build_legal.mjs inlines it, and
// design/site.html carries the same block by hand (copy it in when it changes).
//
//   node tools/fetch-site-fonts.mjs
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'future-clips-site/fonts';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const CSS = 'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..800&family=Manrope:wght@400..700&family=IBM+Plex+Mono:wght@400;500&display=swap';
// stable local names, independent of Google's version numbers (a weight range = one variable file)
const NAME = (family, weight, style) => {
  const f = { Archivo: 'archivo', Manrope: 'manrope', 'IBM Plex Mono': 'plexmono' }[family];
  return `${f}-${weight.replace(/\s+/g, '_')}${style === 'italic' ? '-italic' : ''}-latin.woff2`;
};

fs.mkdirSync(OUT, { recursive: true });
const css = await (await fetch(CSS, { headers: { 'user-agent': UA } })).text();
const blocks = [...css.matchAll(/\/\* (\w[\w-]*) \*\/\s*@font-face \{([\s\S]*?)\}/g)];
const out = [];
for (const [, subset, body] of blocks) {
  if (subset !== 'latin') continue;
  const get = (k) => body.match(new RegExp(`${k}:\\s*([^;]+);`))?.[1].trim();
  const family = get('font-family').replace(/^'|'$/g, '');
  const weight = get('font-weight'), style = get('font-style'), range = get('unicode-range');
  const url = body.match(/url\(([^)]+)\)/)[1];
  const stretch = get('font-stretch');
  const name = NAME(family, weight, style);
  const buf = Buffer.from(await (await fetch(url, { headers: { 'user-agent': UA } })).arrayBuffer());
  fs.writeFileSync(path.join(OUT, name), buf);
  out.push(`@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};${stretch ? `font-stretch:${stretch};` : ''}font-display:swap;src:url(/fonts/${name}) format('woff2');unicode-range:${range}}`);
  console.error(`${name}  ${(buf.length / 1024).toFixed(0)} KB  ${family} ${weight} ${stretch ?? ''}`);
}
fs.writeFileSync('design/fonts.css', out.join('\n') + '\n');
console.log(out.join('\n'));
