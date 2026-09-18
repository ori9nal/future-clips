// A sign-in link for a tester, without the rate-limited mailer. Laptops only.
//
//   node tools/dev-login.mjs email=you@example.com [next=/app] [app=http://localhost:3000]
//
// Uses the service role (SUPABASE_SERVICE_ROLE_KEY from the environment or
// .env.local) to mint a magic-link token for an email and prints a URL for
// THIS machine's app: /auth/callback?token_hash=…&type=magiclink&next=…
// The callback verifies the token server-side (no PKCE verifier is needed,
// which is why an admin-minted link cannot use the ordinary ?code= path).
// A new email goes through the same invite gate as any sign-up: it must be on
// allowed_emails while sign-up is invite-only. The key is never printed.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  console.error('dev-login is for laptops only');
  process.exit(1);
}

function loadEnv(root) {
  const f = path.join(root, '.env.local');
  if (!fs.existsSync(f)) return {};
  return Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}
const env = { ...loadEnv(process.cwd()), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (environment or .env.local; see OWNER-ACTIONS 1)');
  process.exit(1);
}

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('=');
  return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
const email = String(args.email ?? '').trim().toLowerCase();
if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
  console.error('usage: node tools/dev-login.mjs email=you@example.com [next=/app] [app=http://localhost:3000]');
  process.exit(1);
}
const next = String(args.next ?? '/app');
const app = String(args.app ?? 'http://localhost:3000').replace(/\/$/, '');

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

// a magic link needs an existing user; creating one runs the invite-gate trigger like any sign-up
const { data: list, error: listErr } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (listErr) { console.error(listErr.message); process.exit(2); }
if (!list.users.some((u) => (u.email ?? '').toLowerCase() === email)) {
  const { error } = await sb.auth.admin.createUser({ email, email_confirm: true });
  if (error) {
    console.error(`could not create ${email}: ${error.message} (is it on the invite list? /admin/invites)`);
    process.exit(2);
  }
  console.log(`created ${email} (a personal workspace with no plan; set a plan in /admin or with SQL)`);
}

const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email });
if (error) { console.error(error.message); process.exit(2); }
const hash = data?.properties?.hashed_token;
if (!hash) { console.error('no token in the response'); process.exit(2); }
console.log(`${app}/auth/callback?token_hash=${encodeURIComponent(hash)}&type=magiclink&next=${encodeURIComponent(next)}`);
console.log('(open it in the browser that should be signed in; it works once and expires with the token)');
