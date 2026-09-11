The Future Clips — website
==========================

This folder is the complete static site, exactly as deployed at
https://the-future-clips.vercel.app

  index.html      the page (all CSS and JS inline)
  logo.png        logo + favicon
  carousels/      the 14 example slideshow covers (WebP)
  _source/        the design file and the build script that produced index.html

Open index.html directly in a browser to preview, or upload the whole
folder to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages,
plain S3/nginx). No build step, no server, no dependencies.

Fonts load from Google Fonts. The "Start free" form posts to the Supabase
waitlist table using the public (anon) key with an insert-only policy, so
the site works from any domain.

Rebuilding from _source/ needs the repo layout (it reads ../public/carousels
for the images and writes to ../dist) — it is included here for reference,
not as a standalone build.
