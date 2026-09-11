# HANDOFF-SITE.md

## What this is

The public marketing site for Future Clips: a single static page
(`future-clips-site/`) generated from a Claude Design component in `design/`,
live at https://the-future-clips.vercel.app, with a waitlist form that posts
straight to Supabase. This document also covers the Next.js app in `app/` —
which is **not** the marketing site but a local studio/admin over the engine
(see HANDOFF-ENGINE.md for what it calls).

## Entry points

```bash
# 0. once: Node 22 / npm 10. No env file is needed for anything below except /admin.
npm install

# 1. regenerate the site from its source (design/Main.dc.html -> future-clips-site/)
#    idempotent: running it on a clean tree produces zero diff
python design/build_site.py

# 2. preview the site — it is plain files; any static server works
python -m http.server 3323 --bind 127.0.0.1 --directory future-clips-site

# 3. the local studio (Next.js). / redirects to /studio.
npm run dev            # http://localhost:3000
npm run build          # production build; passes cold with no .env.local

# 4. deploy the site — PREFERRED, needs the owner's Vercel login (one-time `vercel login`)
cd future-clips-site && npx vercel --prod      # link to existing project: the-future-clips
```

**How it is deployed today (without the CLI).** The Vercel MCP deploy tool
inlines files as base64 and cannot carry the 274 KB of images, so the
deployment is a two-file Vercel project whose build step downloads the exact
bytes of `future-clips-site/` from Supabase Storage (bucket `site`, public
read) into `public/`. The two files are **not in this repo** — they live only
in Vercel. Reproduced verbatim so a redeploy is possible from here:

```json
// package.json
{ "name": "the-future-clips", "private": true, "scripts": { "build": "node build.js" } }
```
```js
// build.js
const fs = require("fs"), path = require("path");
const BASE = "https://waipwmyncpsgoglmkhdz.supabase.co/storage/v1/object/public/site";
const FILES = [["index-v3.html","index.html"],["logo.png","logo.png"],
  ...["bad-vs-viral","finance-rules","fonts","golden-six","hit-muscle","info-power","lazy-habits",
      "not-ugly","photoshoot","premium","running","same-carousel","teach","ufc"]
  .map(n => [`carousels/${n}.webp`, `carousels/${n}.webp`])];
(async () => { for (const [src, dst] of FILES) {
  const r = await fetch(`${BASE}/${src}`); if (!r.ok) throw new Error(`${src} -> ${r.status}`);
  const out = path.join("public", dst); fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await r.arrayBuffer())); } })().catch(e => { console.error(e); process.exit(1); });
```
Project settings: framework `null`, install `echo no deps`, build `node build.js`,
output `public`. Vercel project `the-future-clips` (`prj_fhayNaCOJChIQQe32KJt5PLemVww`),
team `earnfromwhop07-5800s-projects` (`team_Z46uIoK1WiplZDzwJIukeOdB`).

To ship a change through this path: run `build_site.py`, upload the new
`index.html` to the bucket **under a new name** (the bucket's anon policy is
insert-only, so `x-upsert` is refused — `index-v4.html`, etc.), bump the name
in `build.js`, redeploy. Upload call, no charset in the content type or Storage
returns 415:

```bash
curl -X POST "https://waipwmyncpsgoglmkhdz.supabase.co/storage/v1/object/site/index-v4.html" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY" -H "Authorization: Bearer $SUPABASE_PUBLISHABLE_KEY" \
  -H "Content-Type: text/html" --data-binary @future-clips-site/index.html
```

The CLI path (step 4) makes all of this go away: it uploads the folder
directly and Supabase Storage stops being part of the deploy.

## Env vars

| Name | Required | What breaks without it | Where to get it |
|---|---|---|---|
| *(none)* — static site | — | The site has no env at build or run time. The Supabase URL and **publishable** key are string constants in `design/build_site.py` (`SUPA_URL`, `SUPA_KEY`) and end up inline in `index.html`. That is by design: the key is meant for browsers; RLS is the control. | Supabase dashboard → Project Settings → API (the *publishable* key, never the secret one) |
| `FC_ADMIN_SECRET` | optional (studio only) | `/admin/campaigns` and `POST /api/ingest` show "gate is off" / return 401 and cannot be unlocked. Must be ≥ 8 chars. `/admin` and `/admin/campaigns/[id]` are **not gated by it at all** (see Merge hazards). | Choose any string; put it in `.env.local` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | not read by any code anymore | Nothing. They were consumed by the deleted Next.js signup path. Kept in `.env.example` and `.env.production` because the values are publishable and the next owner may move signup into Next; delete both lines if not. | Same dashboard page |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_IMAGE_MODEL` | engine, read at runtime by `engine/` when the studio calls `/api/sets` | Studio pages render; rendering a set fails. Not site vars — see HANDOFF-ENGINE.md. | HANDOFF-ENGINE.md |

`.env.local` is git-ignored (`.env*.local`). `.env.production` is tracked and
contains only the two publishable Supabase values (verified by `git grep` for
secret-shaped strings: none in tracked files).

## Runs cold?

**Yes.** Evidence, 2026-09-11, fresh directory on D: exported from the git index
(no `node_modules`, no `.env.local`, only the tracked `.env.production`):

| Step | Result |
|---|---|
| `node -v` / `npm -v` | v22.14.0 / 10.9.2 |
| `npm install --no-audit --no-fund` | 124 packages, 34 s, one deprecation warning (`prebuild-install`, harmless) |
| `npm run build` | passes, 2 m 26 s, 16 routes (`/` static, rest dynamic) — **no env var needed** |
| `npm run dev -p 3005` | Ready in 11.4 s |
| `GET /` | 307 → `/studio` |
| `GET /studio`, `/admin`, `/admin/new`, `/admin/campaigns`, `/api/styles`, `/api/specs` | 200 |
| `GET /admin/campaigns/atlas-fitness` (admin-schema campaign) | 200 |
| `GET /admin/campaigns/apex-strength-oct` (engine-schema spec) | 404 — by design after the loader fix below; was **500** before it |
| `GET /api/generate` | 405 (POST-only route; runtime-broken, see What is broken) |
| `GET /nope` | 404 |
| `python design/build_site.py` on a clean tree | zero diff (`future-clips-site/index.html` byte-identical) |

Static site + database, same day:

| Check | Result |
|---|---|
| `GET https://the-future-clips.vercel.app/` | 200, 65 068 B, `cmp` identical to `future-clips-site/index.html` |
| all 16 files (`index.html`, `logo.png`, 14 carousels) fetched from production | 16/16 byte-identical to the folder |
| anon `POST /rest/v1/signups` `{email, role:"clipper", agency_code:null}` — the form's exact call | 201; row present via service SQL |
| anon `GET /rest/v1/signups?select=id,email` | `[]` (200) with 3 rows in the table |
| anon `DELETE /rest/v1/signups?email=eq.<probe>` | 200, row still present (RLS: no DELETE policy) |
| anon `POST` with `email:"nope"` | 400 `signups_email_format` CHECK violation |
| probe row removed afterwards via service SQL | table back to its 2 real rows, 0 probe rows |

Schema: `id uuid`, `email text`, `role text default 'clipper'`, `agency_code text`,
`roster_size int`, `created_at timestamptz`. RLS enabled; one policy
`signups_anon_insert` (INSERT for anon, `with check true`); CHECKs on email
format/length, role ∈ {clipper, agency}, agency_code length, roster_size range.

## What works

- **Production site**: https://the-future-clips.vercel.app — 200, renders, hero
  cards drop and fan out, view counter lands on 1,304,895, features grid,
  examples, pricing toggle, FAQ, footer; mobile layout via CSS media queries
  (no JS breakpoint). Screenshot taken 2026-09-11 after deploy
  `dpl_9rzPo3yZM8akpds5hYv2wcmwH4nD` (READY, 6 s build).
- **Every served byte equals the repo folder** — `for f in …; cmp future-clips-site/$f <(curl -s …/$f)` → 16/16.
- **Images are served from Vercel, not Supabase** — as of today's deploy. Before it, the
  page loaded its 15 assets from Supabase Storage at runtime, which is why the site
  was rendering with no images and no logo this morning (see What is broken → Supabase
  auto-pause). Now the only runtime call to Supabase is the form's POST.
- **Signup form → Supabase** with RLS holding (table above). `?ref=CODE` on the URL is
  sanitised, persisted to `localStorage`, and written to `agency_code` on submit
  (logic in the inline script; see `design/build_site.py` around `fcRef`).
- **Reproducible build**: `python design/build_site.py` regenerates the folder
  byte-for-byte from `design/Main.dc.html` + `public/carousels/` + `design/logo.png`.
- **Next.js studio builds and serves cold** with no env (table above).

## What is broken

- **Supabase free-tier auto-pause.** Project `waipwmyncpsgoglmkhdz` was `INACTIVE`
  when this handoff started (paused after 7 idle days); while paused its hostname does
  not resolve, so the form fails and — until today's deploy — the site lost all its
  images. I restored it (`restore_project`); it **will pause again** after a week without
  traffic. Fix for good: Supabase Pro ($25/mo), or a cron ping, or move the waitlist
  somewhere that does not sleep. Repro: `curl -sI https://waipwmyncpsgoglmkhdz.supabase.co/rest/v1/` → `000` when paused.
- **Vercel project `future-clips`** (`prj_j55AR37CEDttehNz3RnTolaSNDNa`) is dead: both
  production deployments are ERROR. Build logs, pulled today: `dpl_6KzL…` (Aug 23) built
  the *old Next.js marketing page* clean and was then refused with "Vulnerable version of
  Next.js detected" (15.5.4, CVE-2025-66478); `dpl_4HMj…` (Aug 25) was an attempt to push
  the static site into it, rejected with `No Next.js version detected` because the project
  is framework-pinned to Next.js — a setting the MCP tool cannot override. It also never
  had a clean `*.vercel.app` alias (only `future-clips-earnfromwhop07-5800s-projects.vercel.app`).
  It is not the site and nothing points at it. **Owner action: delete it in the Vercel
  dashboard** (no MCP tool deletes projects). If a payment provider was given that project's
  URL, give them https://the-future-clips.vercel.app instead.
- **`POST /api/generate`** (studio) dynamically imports `engine/index.mjs`, which the
  engine workstream moved to `engine/_attic/index.mjs` in `5aaa124`; the route 500s at
  runtime. The studio UI does not call it (it uses `/api/sets`). Left alone rather than
  repointed into `_attic/` blind — delete the route or repoint it once the engine owner says
  which. Repro: `curl -X POST localhost:3000/api/generate -H 'content-type: application/json' -d '{}'`.
- **`/admin` and `/admin/campaigns/[id]` have no auth gate.** Only `/admin/campaigns`
  (the engine-spec list) and `/api/ingest` check `FC_ADMIN_SECRET`; the brand-kit editor
  creates, edits and deletes files under `campaigns/` for anyone who can reach the port.
  Fine on localhost; do not expose the app.
- **Studio "Show all 0" in the STYLE row** on first paint while `/api/styles` returns a
  full list — observed in the cold run, not diagnosed. Engine/studio UI, not the site.

## What is stale

Deleted in this commit (all were duplicates or dead):

| Path | Why |
|---|---|
| `dist/` (17 files) | second copy of the generated site; `build_site.py` now writes to `future-clips-site/` directly |
| `future-clips-site/_source/` | copies of `design/build_site.py`, `fill2.py`, `Main.dc.html` — the real ones are in `design/` |
| `future-clips-site.zip` | generated artifact; now git-ignored. `python -c "import shutil;shutil.make_archive('future-clips-site','zip','.','future-clips-site')"` recreates it |
| `future-clips.html` (root, 423 KB) | the previous ("Vyro-style") design as a standalone page with base64 images; superseded by the user's own design |
| `app/page.tsx` (old content), `components/Reel.tsx`, `components/SignupForm.tsx`, `app/actions.ts`, `lib/carousels.ts`, `lib/supabase.ts`, `@supabase/supabase-js` | the same superseded design as a Next.js page inside the studio app — different copy and different prices ($20 Clipper) from the live site ($16/$32/$79). `/` now redirects to `/studio` |

Still present, safe to ignore or delete:

- `app/layout.tsx` metadata is the old marketing copy ("turn one clip into thirty
  posts", `metadataBase: https://futureclips.vercel.app` — a URL that has never existed)
  and loads Poppins for a page that is gone. It titles every studio tab. Engine-facing
  file; left for its owner.
- `app/globals.css` from line 56 on is marketing-page classes (`.tier`, `.brands`, `.camp` …)
  with no remaining markup — except the element-level `details`/`summary` rules at
  198–202 and the `::selection`/`:focus-visible` rules at 53–54 (purple `--ac`), which
  still apply everywhere. Lines 1–51 are element resets the studio relies on — see
  Merge hazards before touching.
- `.env.production` — tracked, contains only the two publishable Supabase values, read by
  nothing. Harmless; delete if signup stays static.
- `public/carousels/running-3.webp` — only the deleted Reel used it; the site uses the
  other 14. Kept so the folder still matches what the engine's docs describe.
- `design/future-clips-homepage.html`, `design/future-clips-templates.html` (2.9 MB / 2.8 MB)
  — seeded Claude Design canvases (editor + content). View-only; not inputs to the build.
- `design/incoming/`, `design/incoming2/` — the user's two design zips, extracted as
  received. `design/fill2.py` turned `incoming2/` into `design/Main.dc.html`; `fill.py`
  was the same for `incoming/` (first zip, superseded).
- `design/atlas/` — the engine workstream's, not the site's.
- Supabase Storage bucket `site`: `index-v2.html` (Aug 29 build with absolute Storage
  image URLs) is superseded by `index-v3.html`. The bucket has no delete policy for anon;
  remove old objects from the dashboard if it matters.
- `README.md` was rewritten today; it previously described a Tailwind build
  (`components/type.tsx`, `lib/inView.ts`, `--color-*: initial`) that no longer exists in
  the tree — that text is the source of the "globals.css deletes Tailwind's palette" claim
  in the handoff brief, which is false for this repo (no Tailwind anywhere; `--r: 16px`).

## Cost

| Thing | Tier | Metered? |
|---|---|---|
| Vercel team `earnfromwhop07-5800s-projects` | **Hobby** | Free, but the Hobby terms **prohibit commercial use**. Upgrade to Pro ($20/seat/mo) before charging anyone or pointing a paying customer at the URL. Static site traffic is negligible either way. |
| Supabase project `clipcarousel` (`waipwmyncpsgoglmkhdz`) | **Free** (evidenced by the auto-pause) | Free tier pauses after 7 idle days. Pro ($25/mo) removes that. Storage bucket `site` holds ~0.5 MB. |
| Google Fonts | free | — |
| Nothing else on the site is metered. The engine's OpenAI/Anthropic spend is in HANDOFF-ENGINE.md. |

## Assets & size

| Path | Contents | Size | Regenerable? |
|---|---|---|---|
| `future-clips-site/` | `index.html` 65 068 B, `logo.png` 20 677 B, `carousels/` 14 × WebP = 280 460 B, `README.txt` | 396 KB | **yes** — `python design/build_site.py` |
| `public/carousels/` | 15 × WebP, 500 px wide, q70 (the 14 above + `running-3`) | 328 KB | from `Carousel examples/` via Pillow (script not kept; originals are tracked) |
| `design/logo.png` | logo, copied into the site as favicon + nav | 20 KB | no — user-supplied |
| `design/Main.dc.html` | the site's source | 54 KB | from `design/incoming2/` via `design/fill2.py` |
| `design/` total | 115 files incl. the two seeded canvases and `atlas/` | 23 MB | mostly view artefacts |
| `Carousel examples/` | the creators' original posts, used with permission | tracked, engine + site share them | no |

The carousel images are other creators' posts, shown with permission. They are
not Future Clips output; do not relabel them as such.

## Merge hazards

- **`app/globals.css` is loaded by the root layout on every route and its element
  rules override the studio's own design.** Measured on the cold server with the
  browser preferring dark: `.studio` sets its text to `rgb(242,240,235)` on a `#0B0B0C`
  ground, but the computed `body` background was `rgb(247,248,249)` (globals `--page`)
  and the studio `h1` colour was `rgb(15,17,21)` (globals `h1–h5 { color: var(--ink) }`).
  The studio renders as dark cards on the marketing site's light ground with its heading
  in marketing ink — two wrongs cancelling into something readable. `ul { list-style:none }`,
  `p/h { margin:0 }`, `a { text-decoration:none }`, `button { font:inherit }` and the
  Poppins body font hit every route the same way. **Any UI merged into `app/` will inherit
  these.** Either scope globals.css to the marketing page (there is none left) or move the
  resets the studio wants into `app/app.css` deliberately.
- **The brief's stated hazard is not real.** There is no Tailwind in this repo, no
  `--color-*: initial`, and the radius token is `--r: 16px`. That text came from an old
  README describing a build that was abandoned. Do not go looking for it.
- **Two campaign schemas share `campaigns/`.** The brand-kit admin (`lib/campaigns.ts`,
  `brand` is an object with `colors`) and the engine's spec (`lib/specs.ts`, `brand` is a
  string, has `content`). 16 of 21 files are engine specs. `/admin` read every file and
  500ed on the first spec; and its save path rebuilds the whole object from the form, so
  opening a spec there and pressing Save would have erased `brief`/`content`. Fixed in this
  commit by mirroring the engine's `isSpec` guard as `isCampaign` in `lib/campaigns.ts`:
  each loader returns only its own shape. Merging anything that reads `campaigns/*.json`
  must keep that partition.
- **Shared working tree, concurrent commits.** Both workstreams commit in one clone with
  no remote. While this handoff ran, the engine session committed and then amended `5aaa124` (moved root
  `.md`s to `docs/attic/`, engine modules to `engine/_attic/`, added `sharp`, normalised
  line endings — its `package.json`/`package-lock.json` diffs are 55/4 655 lines of CRLF→LF).
  This commit sits on it; `package.json` keeps `sharp` and drops `@supabase/supabase-js`.
  The amend reset the shared index twice under my staged changes — expect the same.
  **Never `git add -A` in this tree**; stage paths.
- **The Vercel build files are not in the repo.** `build.js`/`package.json` above exist only
  in the Vercel project. Anyone redeploying through the MCP path must paste them again
  (verbatim copy is in Entry points). The CLI path does not have this problem.
- **`design/build_site.py` writes into `future-clips-site/` (changed today from `dist/`).**
  It also reads `../public/carousels/` and `design/logo.png`. Moving any of the three
  breaks the build silently — it copies only the images the page references.
- **Supabase bucket `site` and table `signups` are insert-only for anon.** That is the
  security model. Do not add UPDATE/DELETE/SELECT policies to make an upsert or a readback
  convenient; upload under a new object name instead.
- **`next` is pinned exactly** (`15.5.24`, no caret) because Vercel hard-fails vulnerable
  versions at deploy, after a successful build. A bump must be checked against a Vercel
  build, not just a local one.

## Open decisions

- **The marketing site is static, not Next.js.** The user's own Claude Design export
  became the site; the Next.js marketing page was the earlier direction and was deleted
  rather than ported. If the owner wants the site inside Next (for auth, app routes, one
  deploy), the source of truth to port from is `design/Main.dc.html` via `build_site.py`,
  not the deleted page.
- **Deploy mechanism.** Storage-fetch-at-build is a workaround for not having the owner's
  Vercel login. The right end state is `npx vercel --prod` from `future-clips-site/` (or a
  Git integration once there is a remote), after which the bucket can be emptied.
- **Vercel project `future-clips`** is left in place (ERROR) because I cannot delete
  projects from here. Delete it; nothing references it.
- **Supabase project restored, not upgraded.** It will pause again. Decide Pro vs. ping vs.
  a different waitlist sink before launch.
- **`.env.production` / `NEXT_PUBLIC_SUPABASE_*`** kept although unread. Delete if signup
  stays out of Next.
- **`/api/generate`** left broken rather than repointed into `_attic/`; engine owner's call.
- **View counter** rolls to a fixed `1,304,895` (`VIEWS_TARGET` in `build_site.py`) — a
  number the user asked for explicitly. It is not a measured figure; revisit before any
  compliance review of the page's claims.
- **Pricing** on the live page is $16 / $32 / $79 (yearly-toggle copy: "2 months free"),
  set in the design file, not anywhere in code. Change it in `design/Main.dc.html`.

## Do not

- **Do not hand-edit `future-clips-site/index.html`.** It is generated; the next
  `build_site.py` run overwrites it. Edit `design/Main.dc.html` (or the script) and rebuild.
- **Do not deploy the Next.js app to Vercel** to "fix" the `future-clips` project. It writes
  to `campaigns/` and `output/` on local disk, dynamically imports `engine/` by file URL, has
  ungated admin routes, and needs the engine's paid API keys. It is a local tool.
- **Do not `git add -A` or `git commit -a` in this clone.** The other workstream's
  uncommitted edits are in the same tree; stage by path.
- **Do not add anon SELECT/UPDATE/DELETE policies** on `signups` or the `site` bucket to
  make a readback or an upsert work. Insert-only is the point; version object names instead.
- **Do not restore `dist/` or the `_source/` copy** "for safety". They were byte-identical
  duplicates and the duplication is what made the layout confusing.
- **Do not relabel the example carousels as Future Clips output.** They are other
  creators' posts used with permission; the copy on the page is written around that.
