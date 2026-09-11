# Future Clips

Two workstreams share this repo. Each has its own handoff document; read the
one for what you are touching.

| Surface | What it is | Handoff |
|---|---|---|
| `future-clips-site/` | The public marketing site — a **static** page, generated from `design/` and deployed to Vercel. | [HANDOFF-SITE.md](HANDOFF-SITE.md) |
| `engine/`, `tools/`, `campaigns/` | The carousel engine — CLI that turns a campaign brief into a rendered slide set. | [HANDOFF-ENGINE.md](HANDOFF-ENGINE.md) |
| `app/`, `components/`, `lib/` | A **local** Next.js studio + admin over the engine. Not deployed; not the marketing site. | [HANDOFF-SITE.md](HANDOFF-SITE.md) (surface), [HANDOFF-ENGINE.md](HANDOFF-ENGINE.md) (what it calls) |

## The site (what is live)

```bash
python design/build_site.py     # design/Main.dc.html -> future-clips-site/  (idempotent, byte-stable)
```

Live at **https://the-future-clips.vercel.app** — Vercel project `the-future-clips`.
The folder is the deployable; nothing in it is hand-edited. No env vars; the
Supabase URL and *publishable* key are constants in `design/build_site.py`.

## The studio (local only)

```bash
npm install
npm run dev          # http://localhost:3000  -> redirects to /studio
```

`/` redirects to `/studio`. `/admin` is a local tool with a shared-secret gate
(`FC_ADMIN_SECRET` in `.env.local`) on some pages and none on others — do not
put this app on the public internet as-is. It writes to `campaigns/` and
`output/` on the local disk and dynamically imports `engine/` at runtime, which
is also why it is not on Vercel.

## Database

Table `signups` in Supabase project `waipwmyncpsgoglmkhdz` (`clipcarousel`,
us-east-1). RLS on, one policy: anon may INSERT. Anon SELECT returns `[]`,
anon DELETE/UPDATE are no-ops, CHECK constraints reject malformed rows —
all re-verified 2026-09-11 (see HANDOFF-SITE.md, "Runs cold?").

The free-tier project **auto-pauses after a week without traffic**; when it is
paused its hostname does not resolve and the signup form fails. Restore it from
the Supabase dashboard (or the MCP `restore_project`).

## Deploying the site

Preferred, needs the owner's Vercel login:

```bash
cd future-clips-site && npx vercel --prod
```

Link to project `the-future-clips` when asked. What is there today was
deployed without the CLI (see HANDOFF-SITE.md → Entry points for the exact
mechanism and why).

## Two things that bite

- **Vercel refuses vulnerable Next.js versions** (`VULNERABLE_NEXTJS_VERSION`,
  CVE-2025-66478 on 15.5.4). `package.json` pins `next` to exactly `15.5.24`.
- **The Vercel team is on Hobby**, which forbids commercial use. Pro before
  anything is sold.
