The Future Clips — website
==========================

This folder is the complete static marketing site as served at
https://www.thefutureclips.com

  index.html              the homepage: a VERBATIM copy of ../design/site.html (never hand-edit this copy)
  terms/ privacy/ acceptable-use/ refunds/ accessibility/
                          the five Trust and Legal pages, generated from ../legal/*.md by
                          `node design/build_legal.mjs`
  logo.png og.png         logo/favicon and the link-preview image
  fonts/                  Archivo, Manrope and IBM Plex Mono, self-hosted (no request leaves the site);
                          refreshed by `node tools/fetch-site-fonts.mjs`, which also writes ../design/fonts.css
  carousels/              hero-*.webp and look-*.webp are our own engine output (output/sets/…, resized by
                          ImageMagick); the other covers are other creators' posts, shown with permission
  robots.txt sitemap.xml 404.html
  vercel.json             /login and /signup redirect to the app host; security and cache headers; clean URLs

To change the homepage: edit ../design/site.html, then `cp design/site.html future-clips-site/index.html`.
To change a policy: edit ../legal/<slug>.md, then `node design/build_legal.mjs`.
  build.js                Vercel's build: copies this folder into public/ (no bucket fetch)

Deploy: the Vercel project the-future-clips builds this folder from the repo (root directory
future-clips-site/, `node build.js`, output public/). A push to main deploys; Engineering can also
trigger a deployment from the repo through the Vercel API (RUNBOOK "Publishing").
