# Auth email templates

Branded HTML for the emails Supabase Auth sends. They use the server-verified
link shape (`/auth/callback?token_hash=…&type=…`), which works when the link
is opened on another device or browser than the one that asked for it, and
they show the 6-digit code (`{{ .Token }}`) for the code field on the sign-in
page. Inline CSS, table layout, one hosted PNG for the mark
(`https://www.thefutureclips.com/logo.png`); nothing external otherwise.

| File | Supabase template | Subject to set |
|---|---|---|
| `magic-link.html` | Authentication → Email Templates → **Magic Link** | `Your sign-in link for The Future Clips` |
| `confirm-signup.html` | **Confirm signup** | `Confirm your email for The Future Clips` |
| `invite.html` | **Invite user** | `You are invited to The Future Clips` |
| `change-email.html` | **Change Email Address** | `Confirm your new email for The Future Clips` |

Owner steps (Supabase dashboard, project `clipcarousel`):
1. Authentication → URL Configuration: **Site URL** = the app origin (today `https://future-clips-app.vercel.app`, later `https://app.thefutureclips.com`); **Redirect URLs** include `<origin>/auth/callback` for every host you use, `http://localhost:3000/auth/callback` included.
2. Authentication → Email Templates: paste each file's HTML into the matching template and set the subject from the table. Leave the Reset Password template alone (there are no passwords).
3. Authentication → SMTP Settings: turn on custom SMTP so the mail comes from your domain instead of `noreply@mail.app.supabase.io` and the 2-per-hour limit goes away. Resend is the quick path: create a Resend account, add and verify `thefutureclips.com` (three DNS records), create an API key, then in Supabase set host `smtp.resend.com`, port `465`, user `resend`, password = the API key, sender `The Future Clips <hello@thefutureclips.com>`. Raise the rate limit under Authentication → Rate Limits once SMTP is custom.
4. Send yourself a link from `/login` and check the inbox rendering (Gmail, Apple Mail, Outlook) before opening sign-ups.

Do not add `{{ .ConfirmationURL }}` back: it carries the PKCE `?code=` flow, which only works in the browser that requested the link.
