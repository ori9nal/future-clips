# The Future Clips

Carousel generation for clippers: a platform admin ingests a brand brief once; a clipper picks the campaign, types an idea, chooses slides and a lane, and gets a compliant, metadata-free TikTok/Instagram carousel with caption, bio and hashtags. Claude writes and directs, gpt-image-2 draws, the Node engine composes.

**Read first:** `docs/DECISIONS.md` (what is decided), `docs/ROADMAP.md` (what is in flight), then `docs/ARCHITECTURE.md`, `docs/ENGINE.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/PRODUCT.md`, `docs/QUALITY.md`. The full audit of 2026-09-17 is `docs/AUDIT-2026-09-17.md`. Operations: `RUNBOOK.md`. Owner-side steps: `OWNER-ACTIONS.md`.

## Run

```bash
npm install
cp .env.example .env.local        # fill the keys; never commit it
npm run dev                       # http://localhost:3000
```

Checks before every commit: `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build`.

## Surfaces

| What | Where | Source of truth |
|---|---|---|
| Marketing site | www.thefutureclips.com (Vercel `the-future-clips`) | `design/site.html`, copied verbatim to `future-clips-site/index.html`; legal pages from `legal/*.md` via `node design/build_legal.mjs` |
| App | future-clips-app.vercel.app (Vercel `future-clips-app`) | `app/`, `lib/`, `middleware.ts` |
| Engine | laptop CLI and the hosted worker | `engine/`, `tools/lane.mjs`, `lib/worker.ts` |
| Database, auth, storage | Supabase `clipcarousel` (`waipwmyncpsgoglmkhdz`) | `supabase/migrations/`, `docs/DATABASE.md` |

## Make a set from the command line

```bash
node tools/lane.mjs campaign=apex-strength ask="top 5 exercises for biceps rated" lane=priority slides=6-8 style=feed
node tools/rerender.mjs campaign=apex-strength style=feed    # $0, from cached frames
```

Superseded documents kept for history: `HANDOFF-ENGINE.md`, `HANDOFF-SITE.md`, `OPEN-DECISIONS.md`, `COST.md`, `docs/attic/`.
