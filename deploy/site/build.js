// Pulls the exact bytes of future-clips-site/ (the repo folder) from Supabase Storage
// (bucket `site`, public read) into public/. Source of truth: design/site.html in the repo,
// copied verbatim to future-clips-site/index.html and uploaded under a versioned name.
const fs = require("fs"), path = require("path");
const BASE = "https://waipwmyncpsgoglmkhdz.supabase.co/storage/v1/object/public/site";
const LEGAL = ["terms", "privacy", "acceptable-use", "refunds", "accessibility"];
const FILES = [
  ["index-v12.html", "index.html"],
  ["logo.png", "logo.png"],
  ["og-v2.png", "og.png"],
  ...LEGAL.map((s) => [`legal-v2/${s}.html`, `${s}/index.html`]),
];
(async () => {
  for (const [src, dst] of FILES) {
    const r = await fetch(`${BASE}/${src}`);
    if (!r.ok) throw new Error(`${src} -> ${r.status}`);
    const out = path.join("public", dst);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(await r.arrayBuffer()));
    console.log(`${src} -> ${out}`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
