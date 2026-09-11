# OWNER-ACTIONS.md

Things only the account owner can do, in the order they bite. Nothing below
blocks the build; each one blocks a launch step named next to it.

| # | Action | Why | Blocks |
|---|---|---|---|
| 1 | **Vercel: upgrade team `earnfromwhop07-5800s-projects` Hobby → Pro** ($20/seat/mo) | Hobby terms prohibit commercial use; Hobby cron jobs run at most once a day (the batch poller needs every 5 min); Hobby function duration cannot carry an instant set. | The first charge (phase 5), the instant tier (phase 3.3), the 5-minute poller. |
| 2 | **Supabase: upgrade project `clipcarousel` (`waipwmyncpsgoglmkhdz`) Free → Pro** ($25/mo) | Free pauses after 7 idle days and its hostname stops resolving — the app, auth and the signup form all die with it. A keepalive cron (phase 2) makes the pause unlikely, not impossible. Pro also lifts the 1 GB storage cap, which the `cache` bucket (324 MB today, growing per set) and `sets` bucket will exceed. | Launch. |
| 3 | **Vercel: delete project `future-clips`** (`prj_j55AR37CEDttehNz3RnTolaSNDNa`) | Dead: both production deployments are ERROR, it has no clean alias, nothing points at it. There is no MCP tool that deletes a project. If a payment provider was ever given its URL, replace it with https://the-future-clips.vercel.app. | Nothing; tidiness and reviewer confusion. |
| 4 | **Payment provider: finish Dodo Payments merchant approval** (or decide Stripe) | Phase 5 builds against whichever is approved. The webhook handler is one file either way. | The first charge. |
| 5 | **Custom domain** | The site is on `the-future-clips.vercel.app`; the app will be on a second `*.vercel.app` host. Auth emails, the payment provider's checkout return URL and the reviewer's impression all want a real domain. | Launch polish; not the build. |
| 6 | **Supabase Auth: Google OAuth client** (optional) | Magic-link email works with no setup. Google sign-in needs a Google Cloud OAuth client id + secret pasted into Supabase Auth → Providers → Google. | Google sign-in only. |
| 7 | **Vercel CLI login on this machine** (`vercel login`) — optional | Lets the static site deploy with `cd future-clips-site && npx vercel --prod` instead of the Storage-fetch-at-build path, after which the `site` bucket can be emptied. | Nothing; the MCP path works (used 2026-09-11). |

Done by the third agent, for the record (no owner action needed):
- 2026-09-11 — site redeployed with the four-tier pricing (`dpl_CxiRWLGzYGBoPhnJBFVS6urfy8fD`, READY), `index-v4.html` in bucket `site`.
