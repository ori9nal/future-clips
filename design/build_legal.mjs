// The five Trust & Legal pages for the static site: legal/*.md → future-clips-site/<slug>/index.html
//
//   node design/build_legal.mjs
//
// Same fonts and palette as the generated index.html (Manrope body, Archivo
// headings, Plex Mono labels), a reading column, and the Trust and Legal
// footer. No JS, no Supabase, nothing to break. Vercel serves
// public/terms/index.html at /terms.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, render } from '../legal/render.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const DIST = path.join(ROOT, 'future-clips-site');

// the site's fonts, self-hosted under /fonts (tools/fetch-site-fonts.mjs writes both the files and design/fonts.css)
const FONTS = '<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/archivo-500_800-latin.woff2">'
  + '<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/manrope-400_700-latin.woff2">'
  + `<style>${fs.readFileSync(path.join(ROOT, 'design/fonts.css'), 'utf8')}</style>`;

const CSS = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#FBFAF7;color:#0E0E10;font-family:"Manrope",Helvetica,Arial,sans-serif;font-size:17px;line-height:1.6}
a{color:inherit}
.wrap{width:100%;max-width:760px;margin-inline:auto;padding:0 clamp(18px,4vw,36px)}
header.top{border-bottom:1px solid #EAE7DE;background:#FBFAF7}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
.brand{display:flex;align-items:center;gap:11px;text-decoration:none;color:#0E0E10}
.brand svg{height:26px;width:auto;display:block;flex:0 0 auto}
.bt{display:flex;flex-direction:column;line-height:1}
.bt small{font-family:"Manrope",sans-serif;font-size:8.5px;letter-spacing:.34em;text-transform:uppercase;color:#6E6B63;font-weight:600;margin-bottom:2px}
.bt b{font-family:"Archivo",sans-serif;font-stretch:112%;font-weight:700;font-size:19px;color:#0E0E10;letter-spacing:-.032em}
.mono{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6E6B63}
nav.legal{display:flex;flex-wrap:wrap;gap:6px 14px;margin:clamp(28px,5vw,44px) 0 8px}
nav.legal a{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6E6B63;text-decoration:none;padding:6px 0;border-bottom:2px solid transparent}
nav.legal a[aria-current]{color:#0E0E10;border-bottom-color:#D8FF47}
main{padding-bottom:clamp(48px,8vw,80px)}
main h1{font-family:"Archivo",sans-serif;font-stretch:112%;font-weight:700;font-size:clamp(1.9rem,6vw,3rem);line-height:1.05;letter-spacing:-.03em;margin:8px 0 6px}
main h2{font-family:"Archivo",sans-serif;font-stretch:112%;font-weight:700;font-size:clamp(1.2rem,3.6vw,1.5rem);line-height:1.2;letter-spacing:-.02em;margin:40px 0 10px;scroll-margin-top:24px}
main h3{font-size:1.05rem;margin:28px 0 8px}
main p{margin:0 0 14px}
.fc-effective{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6E6B63;margin:0 0 28px}
main ul,main ol{padding-left:22px;margin:0 0 16px}
main li{margin:6px 0}
main table{border-collapse:collapse;width:100%;margin:8px 0 20px;font-size:15px;display:block;overflow-x:auto}
main th,main td{text-align:left;padding:10px 12px;border-bottom:1px solid #EAE7DE;vertical-align:top}
main th{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#6E6B63;font-weight:500}
footer{border-top:1px solid #EAE7DE}
footer .row{display:flex;flex-wrap:wrap;gap:10px 22px;justify-content:space-between;padding:22px 0}
footer .links{display:flex;flex-wrap:wrap;gap:8px 18px}
footer a{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#6E6B63;text-decoration:none}
footer a:hover{color:#0E0E10}
`;

function page(p, body) {
  const nav = PAGES.map((q) => `<a href="/${q.slug}"${q.slug === p.slug ? ' aria-current="page"' : ''}>${q.short}</a>`).join('');
  const links = PAGES.map((q) => `<a href="/${q.slug}">${q.short}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.title} — The Future Clips</title>
<meta name="description" content="${p.title} for The Future Clips, effective 12 September 2026.">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#FAF9F6">
<link rel="canonical" href="https://www.thefutureclips.com/${p.slug}">
<meta property="og:type" content="article">
<meta property="og:url" content="https://www.thefutureclips.com/${p.slug}">
<meta property="og:site_name" content="the futureclips">
<meta property="og:title" content="${p.title} — The Future Clips">
<meta property="og:description" content="${p.title} for The Future Clips, effective 12 September 2026.">
<meta property="og:image" content="https://www.thefutureclips.com/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p.title} — The Future Clips">
<meta name="twitter:image" content="https://www.thefutureclips.com/og.png">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 92 64'%3E%3Crect x='0' y='21' width='55' height='39' rx='7' fill='%23D9D7D1'/%3E%3Crect x='14' y='12' width='55' height='39' rx='7' fill='%238E8D89'/%3E%3Crect x='31' y='2' width='55' height='39' rx='7' fill='%230E0E10'/%3E%3C/svg%3E">
${FONTS}
<style>${CSS}</style>
</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="/"><svg viewBox="0 0 92 64" aria-hidden="true"><rect x="0" y="21" width="55" height="39" rx="7" fill="#D9D7D1"/><rect x="14" y="12" width="55" height="39" rx="7" fill="#8E8D89"/><rect x="31" y="2" width="55" height="39" rx="7" fill="#0E0E10"/></svg><span class="bt"><small>The</small><b>futureclips</b></span></a><a class="mono" href="/#pricing" style="text-decoration:none">Pricing</a></div></header>
<main><div class="wrap">
<nav class="legal" aria-label="Trust and Legal">${nav}</nav>
${body}
</div></main>
<footer><div class="wrap"><div class="row"><span class="mono">© 2026 The Future Clips</span><div class="links"><span class="mono" style="margin-right:4px">Trust and Legal</span>${links}<a href="mailto:team@thefutureclips.com">team@thefutureclips.com</a></div></div></div></footer>
</body>
</html>
`;
}

for (const p of PAGES) {
  const md = fs.readFileSync(path.join(ROOT, 'legal', `${p.slug}.md`), 'utf8');
  const dir = path.join(DIST, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  const html = page(p, render(md));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`future-clips-site/${p.slug}/index.html  ${(html.length / 1024).toFixed(0)} KB`);
}
