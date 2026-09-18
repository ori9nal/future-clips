The Future Clips — website
==========================

This folder is the complete static marketing site as served at
https://www.thefutureclips.com

  index.html              the homepage: a VERBATIM copy of ../design/site.html (never hand-edit this copy)
  terms/ privacy/ acceptable-use/ refunds/ accessibility/
                          the five Trust and Legal pages, generated from ../legal/*.md by
                          `node design/build_legal.mjs`
  logo.png og.png         logo/favicon and the link-preview image
  carousels/              example covers (other creators' posts, shown with permission)
  vercel.json             /login and /signup redirect to the app host

To change the homepage: edit ../design/site.html, then `cp design/site.html future-clips-site/index.html`.
To change a policy: edit ../legal/<slug>.md, then `node design/build_legal.mjs`.
Deploy: see ../RUNBOOK.md (git-connected Vercel project once OWNER-ACTIONS B is done).
