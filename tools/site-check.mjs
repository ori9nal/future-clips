// Static checks for the marketing site folder: every local link and asset
// resolves, every page carries the meta a shared link needs, images have alt,
// one h1 per page, lang and viewport set. Exit 1 on any failure.
//   node tools/site-check.mjs [future-clips-site]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] ?? 'future-clips-site');
const pages = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.html')) pages.push(p); } })(ROOT);

let fails = 0;
const fail = (page, msg) => { fails++; console.log(`FAIL ${path.relative(ROOT, page)}: ${msg}`); };
const ok = (page, msg) => console.log(`ok   ${path.relative(ROOT, page)}: ${msg}`);

for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const dir = path.dirname(page);
  // links and assets
  const refs = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1]).filter((u) => !/^(https?:|mailto:|data:|tel:)/.test(u));
  const missing = [];
  for (const u of new Set(refs)) {
    const clean = u.split('?')[0].replace(/#.*$/, '') || '/';   // /#pricing is the home page plus a fragment
    const target = clean.startsWith('/') ? path.join(ROOT, clean) : path.join(dir, clean);
    const candidates = [target, path.join(target, 'index.html')];
    if (!candidates.some((c) => fs.existsSync(c) && fs.statSync(c).isFile())) {
      // a route the host redirects (vercel.json) is fine
      const redirects = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).redirects?.map((r) => r.source) ?? [];
      if (!redirects.includes(clean)) missing.push(u);
    }
  }
  missing.length ? fail(page, `unresolved: ${missing.join(', ')}`) : ok(page, `${new Set(refs).size} local refs resolve`);
  // meta
  const has = (rx) => rx.test(html);
  const need = {
    'lang': /<html[^>]*\slang="/, 'viewport': /name="viewport"/, 'title': /<title>[^<]{3,}<\/title>/, 'description': /name="description" content="[^"]{20,}"/,
    'canonical': /rel="canonical"/, 'og:title': /property="og:title"/, 'og:description': /property="og:description"/, 'og:image': /property="og:image"/,
    'twitter:card': /name="twitter:card"/, 'favicon': /rel="icon"/, 'theme-color': /name="theme-color"/,
  };
  const errorPage = /name="robots" content="noindex"/.test(html);   // 404.html: not a page anyone shares
  const missingMeta = errorPage ? [] : Object.entries(need).filter(([, rx]) => !has(rx)).map(([k]) => k);
  missingMeta.length ? fail(page, `meta missing: ${missingMeta.join(', ')}`) : ok(page, 'meta complete');
  // images with alt
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const noAlt = imgs.filter((t) => !/\salt=/.test(t));
  noAlt.length ? fail(page, `${noAlt.length} <img> without alt`) : ok(page, `${imgs.length} images, all with alt`);
  // one h1
  const h1s = (html.match(/<h1\b/g) ?? []).length;
  h1s === 1 ? ok(page, 'one h1') : fail(page, `${h1s} h1 elements`);
  // free-tier words (D-002)
  const body = html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '');
  const free = body.match(/\b(free tier|2 free slides|start free|no card required)\b/gi);
  free ? fail(page, `free-tier wording: ${[...new Set(free)].join(', ')}`) : ok(page, 'no free-tier wording');
}
console.log(fails ? `\n${fails} failure(s)` : '\nall site checks passed');
process.exit(fails ? 1 : 0);
