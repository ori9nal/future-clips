# OWNER-ACTIONS.md

Things only the account owner can do, in the order they unblock work. Engineering keeps this list current; every item names the exact place, the exact names, and what it unblocks. Values that are secrets are never written here, never `NEXT_PUBLIC_`.

## Now: these gate local testing and every deploy

| # | Action | Where | Unblocks |
|---|---|---|---|
| 1 | Put `SUPABASE_SERVICE_ROLE_KEY=<service_role key>` into `.env.local` on this machine and into `../fc-product/.env.local` | Supabase → Project Settings → API Keys → `service_role` | local end-to-end generation through the app (both lanes), immediate cancel release, the full account lists in `/admin` (M1) |
| 2 | Give this machine a GitHub credential for `DhanushMusunuru`: `gh auth login` (HTTPS, browser) | terminal | pushing `main` and `product`; everything below that deploys from git |
| 3 | Connect GitHub to Vercel as `DhanushMusunuru`: https://vercel.com/new → Import Git Repository → account dropdown → Add GitHub Account → grant `future-clips`; import it and link to the existing project `future-clips-app` (default Next.js settings). For the site, add a second git project from the same repo with Root Directory `future-clips-site`, Framework Preset `Other`, no build command, output `.`; or point the existing `the-future-clips` project at it | Vercel dashboard | deploys from `git push` with the engine, fonts and assets traced in (M3); the site without the bucket fetch |
| 4 | Environment variables on project `future-clips-app` (Production and Preview, plain server variables): `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (workspace-scoped), `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL=gpt-image-2`, `OPENAI_INPUT_IMAGES_PER_MIN=5`, `CRON_SECRET` (any 32+ random characters). Redeploy after saving | Vercel → project → Settings → Environment Variables | hosted rendering, the poller, the keepalive stamp. Verify: `https://future-clips-app.vercel.app/api/health` answers `"ok":true` |
| 5 | Supabase Auth URL configuration: Site URL `https://future-clips-app.vercel.app`; Redirect URLs `https://future-clips-app.vercel.app/auth/callback`, `http://localhost:3000/auth/callback`, `http://localhost:3001/auth/callback` (add `https://app.thefutureclips.com/auth/callback` once item 11 is done) | Supabase → Authentication → URL Configuration | signing in on the host and from the Product worktree |
| 6 | Custom SMTP for auth emails (Resend or Postmark) | Supabase → Authentication → SMTP Settings | more than a few sign-in links per hour for the whole project (hit on 2026-09-13) |
| 7 | Enable leaked password protection | Supabase → Authentication → Attack Protection | closes the last security advisor; one click |

## Before launch

| # | Action | Where | Unblocks |
|---|---|---|---|
| 8 | Vercel team `earnfromwhop07-5800s-projects` Hobby → Pro ($20/seat/mo) | Vercel → Team Settings → Billing | commercial use (Hobby forbids it); the five-minute batch poller (Hobby crons are daily); function duration headroom |
| 9 | Supabase project `clipcarousel` Free → Pro ($25/mo) | Supabase → Organization → Billing | no seven-day auto-pause; storage above 1 GB (the frame cache is already 448 MB on a laptop) |
| 10 | Delete the dead Vercel project `future-clips` (`prj_j55AR37CEDttehNz3RnTolaSNDNa`) | Vercel → project → Settings → Delete | nothing; tidiness |
| 11 | Domain `app.thefutureclips.com` on project `future-clips-app`, then update item 5 | Vercel → project → Settings → Domains | sign-in emails and checkout return URLs without a `*.vercel.app` host |
| 12 | Dodo Payments: finish merchant approval; create products Clipper $16, Pro $32, Studio $79 (monthly; yearly only if D-013 says so) and packs 100/$8, 250/$18, 600/$40; webhook `https://future-clips-app.vercel.app/api/webhooks/dodo` with all subscription and payment events; then env `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_ENV=live`, `DODO_PRODUCTS=solo=pdt_…,grind=pdt_…,agency=pdt_…,p100=pdt_…,p250=pdt_…,p600=pdt_…` | Dodo dashboard, Vercel env | the first charge (M5) |

## Interim: publish the no-free-tier homepage before item 3 exists

| # | Action | Where | Unblocks |
|---|---|---|---|
| 13 | Score the screenshots Engineering sent (site, login, dashboard). At 90 or above, say "ship": Engineering deploys `future-clips-site/` to the Vercel project `the-future-clips` through the connected Vercel API (no bucket uploads needed any more; `deploy/site/build.js` stays as the fallback) and verifies www.thefutureclips.com. The app (`future-clips-app`) still needs B, the GitHub link with the engine traced in, before it can be deployed from `main` | this chat, then Vercel → Git for the app | the live homepage without the Free card, the fixed link preview, the 404 page, self-hosted fonts, security and cache headers |

## Decisions the code is waiting on

See `docs/DECISIONS.md` D-011 to D-018: plan assignment before Dodo, priority and HD accounting, monthly versus yearly pricing, Grow with Alex scope, "Journey", legal wording, referral gating, the quality budget.

## Done (for the record)

- 2026-09-11/12: site redeployed with four-tier pricing, then slides-based pricing, then the five legal pages (`index-v9`); private repos `DhanushMusunuru/future-clips` and `DhanushMusunuru/the-future-clips-site` created; schema 0004 applied; app deployed to `future-clips-app` from a hand-carried tarball (no engine).
- 2026-09-13: `index-v10`/`v11` uploaded (`v10` is what is live); `og.png` uploaded to the bucket but not yet deployed.
- 2026-09-18: migration 0009 applied (anonymous site-bucket uploads and waitlist inserts removed, anon table grants revoked, set-row guard made generic); the working tree committed on `main`; the Product worktree exists.
