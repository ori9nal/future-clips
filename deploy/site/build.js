// Pulls the exact bytes of future-clips-site/ (the repo folder) from Supabase Storage
// (bucket `site`, public read) into public/. Source of truth: design/site.html in the repo,
// copied verbatim to future-clips-site/index.html and uploaded under a versioned name.
const fs = require("fs"), path = require("path");
const BASE = "https://waipwmyncpsgoglmkhdz.supabase.co/storage/v1/object/public/site";
const LEGAL = ["terms", "privacy", "acceptable-use", "refunds", "accessibility"];
const FONTS = ["archivo-500_800-latin", "manrope-400_700-latin", "plexmono-400-latin", "plexmono-500-latin"];
const FILES = [
  ["index-v12.html", "index.html"],
  ["logo.png", "logo.png"],
  ["og-v2.png", "og.png"],
  ...LEGAL.map((s) => [`legal-v2/${s}.html`, `${s}/index.html`]),
  // the site's fonts (future-clips-site/fonts/, from tools/fetch-site-fonts.mjs)
  ...FONTS.map((f) => [`fonts-v1/${f}.woff2`, `fonts/${f}.woff2`]),
];
const INLINE = {
  'robots.txt': 'User-agent: *\nAllow: /\nSitemap: https://www.thefutureclips.com/sitemap.xml\n',
  'sitemap.xml': '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    ['', ...LEGAL].map((s) => `<url><loc>https://www.thefutureclips.com/${s}</loc></url>`).join('') + '</urlset>\n',
};
(async () => {
  for (const [name, text] of Object.entries(INLINE)) { fs.mkdirSync('public', { recursive: true }); fs.writeFileSync(path.join('public', name), text); }
  FILES.push(['404-v1.html', '404.html']);
  for (const [src, dst] of FILES) {
    const r = await fetch(`${BASE}/${src}`);
    if (!r.ok) throw new Error(`${src} -> ${r.status}`);
    const out = path.join("public", dst);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    console.log(`${src} -> ${out}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
