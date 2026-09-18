# Security

The Future Clips takes reports of security problems seriously. If you find one, email **team@thefutureclips.com** with "security" in the subject. Say what you found, how to reproduce it, and what you think the impact is. We answer within three working days, keep you informed while we fix it, and credit you if you want. Please give us a reasonable time to fix before publishing, do not touch data that is not yours, and do not run denial-of-service tests.

What is in scope: `www.thefutureclips.com`, the app host, the API under `/api/`, and the Supabase project behind them. Out of scope: third-party services we use (Supabase, Vercel, Dodo Payments, Anthropic, OpenAI); report those to them.

How the app is built to be safe (details in `docs/ARCHITECTURE.md`, "Security posture"): row-level security on every table with money and quota moving only through definer functions; sign-in by emailed link or code, verified server-side, rate limited, no passwords; httpOnly session cookies; signed payment webhooks recorded once; a Content-Security-Policy and the usual headers on both hosts; secrets only in server environment; CI on every push.
