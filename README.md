# Future Clips

Homepage for a carousel-generation tool aimed at paid clippers.
Next.js 15 (App Router) · TypeScript · Tailwind v4 · Supabase.

## Run it

```
npm install
npm run dev
```

Needs `.env.local` (already present locally, git-ignored):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

`.env.production` holds the same two values for deploys. Both are publishable —
the Supabase publishable key is designed to reach browsers. Row Level Security
is what protects the data, not the key.

## Design constraints (enforced, not just documented)

- `app/globals.css` sets `--color-*: initial`, which deletes Tailwind's default
  palette. Only the seven brand tokens compile; `bg-blue-500` is a no-op.
- `--radius-*: initial` caps the radius scale at 4px, so `rounded-2xl` cannot
  be written by accident.
- `components/type.tsx` exports `<Copy>`, which splits body text on numeric
  tokens and sets each one in JetBrains Mono. Every number on the page is
  monospace because the component does it, not because someone remembered.

## Motion

Exactly three animations, each gated on `prefers-reduced-motion`:

1. `HeroCarousel` — eight slides deal in 200ms apart to a 1.6s mono timer,
   an acid receipt snaps in, holds 2s, loops. Timer-driven.
2. `CountUp` — the numbers bar counts once on first scroll into view.
3. `Rule` — hairlines draw in (scaleX 0→1, 400ms) as sections enter.

`lib/inView.ts` backs IntersectionObserver with a passive scroll listener and a
deferred measurement. A stat frozen at zero is a worse failure than one that
never animated, so the fallback guarantees the end state is always reachable.

## Database

Table `signups` in Supabase project `waipwmyncpsgoglmkhdz` (region us-east-1).

RLS is on with a single policy: anon may INSERT. There is no SELECT, UPDATE or
DELETE policy, so the publishable key cannot read or modify the list. Verified
by direct REST calls — anon SELECT returns `[]` while rows exist, and anon
DELETE/UPDATE leave rows untouched.

CHECK constraints enforce email shape, role enum, agency_code length and
roster_size range at the database layer as well as in the Server Action.

Attribution: `?ref=CODE` is sanitised, persisted to `localStorage`, and written
to `signups.agency_code` on submit. It survives the visitor browsing the page
before signing up, which is the point — that column is how agency revenue share
gets paid.

## Deploying

The Vercel project already exists: **future-clips**
(`prj_j55AR37CEDttehNz3RnTolaSNDNa`, team `earnfromwhop07-5800s-projects`).

Push from this directory:

```bash
npx vercel --prod
```

It will ask you to log in the first time, then link to the existing `future-clips`
project. The CLI uploads `public/carousels/` along with the source, which the MCP
deploy tool cannot do — it inlines files as base64 and 293 KB of images becomes
~393 KB of base64, past the size of a single tool call.

`.env.production` holds the two `NEXT_PUBLIC_SUPABASE_*` values and is not
git-ignored, so it uploads with the deploy. Cleaner long-term: set both in the
Vercel dashboard under Settings -> Environment Variables and delete the file, so
rotating the key doesn't need a redeploy.

### Two things that will bite otherwise

- **Next.js version is pinned for a reason.** Vercel refuses to build versions with
  known CVEs. A build on `15.5.4` failed with `VULNERABLE_NEXTJS_VERSION`
  (CVE-2025-66478) before it compiled anything. This project is on `15.5.24`. If you
  bump Next, check the build succeeds before assuming it shipped.
- **The team is on the Hobby plan**, which forbids commercial use. Upgrade to Pro
  before this page sells anything.

## Image assets

`public/carousels/` holds 15 example carousels at 500px wide, WebP q70 (293 KB total),
generated from `Carousel examples/`. They are other creators' posts, used with
permission, and the page says so in the status section and the FAQ. They are not
Future Clips output — do not relabel them as such.
