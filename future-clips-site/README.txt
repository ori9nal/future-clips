The Future Clips — website
==========================

This folder is the complete static marketing site, byte-for-byte what is
served at https://the-future-clips.vercel.app

  index.html      the page (all CSS and JS inline)
  logo.png        logo + favicon
  carousels/      the 14 example slideshow covers (WebP)

Open index.html directly in a browser to preview, or upload the whole folder
to any static host. No build step, no server, no dependencies at runtime.

Do not edit index.html by hand — it is GENERATED. The source is
../design/Main.dc.html (a Claude Design component) and the converter is
../design/build_site.py, which writes straight into this folder:

    python design/build_site.py        # from the repo root

Fonts load from Google Fonts. The "Start free" form posts to the Supabase
waitlist table using the public (anon) key with an insert-only policy, so the
site works from any domain. Deploy details, env, and hazards: ../HANDOFF-SITE.md
