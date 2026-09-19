// Creates the two local test users with a password, laptops only:
//   demo@thefutureclips.com    → the demo workspace (read-only showcase)
//   tester@thefutureclips.com  → "Product test workspace" (Pro, $10 spend cap)
// Both emails are on the invite list (migration 0014). The password is
// FC_DEV_PASSWORD in .env.local (generated here if missing, never printed).
// With SUPABASE_SERVICE_ROLE_KEY the users are created confirmed through the
// admin API; without it the anon sign-up is used, which only yields a usable
// account when Supabase's "Confirm email" is off (Auth → Providers → Email).
//
//   node tools/dev-users.mjs
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

if (process.env.VERCEL || process.env.NODE_ENV === 'production') { console.error('dev-users is for laptops only'); process.exit(1); }
const envFile = path.join(process.cwd(), '.env.local');
function loadEnv() {
  if (!fs.existsSync(envFile)) return {};
  return Object.fromEntries(fs.readFileSync(envFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}
let env = { ...loadEnv(), ...process.env };
if (!env.FC_DEV_PASSWORD) {
  const pw = randomBytes(18).toString('base64url');
  fs.appendFileSync(envFile, `\n# local dev logins (tools/dev-users.mjs, /api/auth/dev)\nFC_DEV_LOGIN=1\nFC_DEV_PASSWORD=${pw}\n`);
  console.error('FC_DEV_LOGIN=1 and a generated FC_DEV_PASSWORD were appended to .env.local');
  env = { ...loadEnv(), ...process.env };
}
const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service = env.SUPABASE_SERVICE_ROLE_KEY, password = env.FC_DEV_PASSWORD;
if (!url || !anon) { console.error('needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'); process.exit(1); }
const USERS = ['demo@thefutureclips.com', 'tester@thefutureclips.com'];

if (service) {
  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const email of USERS) {
    const existing = list?.users.find((u) => (u.email ?? '').toLowerCase() === email);
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      console.error(`${email}: ${error ? 'password NOT updated: ' + error.message : 'password set, confirmed'}`);
    } else {
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      console.error(`${email}: ${error ? 'NOT created: ' + error.message : 'created, confirmed'}`);
    }
  }
} else {
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const email of USERS) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { console.error(`${email}: ${error.message}`); continue; }
    if (data.session) console.error(`${email}: created and signed in (email confirmation is off)`);
    else if (data.user && (data.user.identities ?? []).length === 0) console.error(`${email}: already exists; sign in with the password in .env.local (if it was set another way, add SUPABASE_SERVICE_ROLE_KEY and re-run to reset it)`);
    else console.error(`${email}: created but NOT confirmed. Supabase Auth has "Confirm email" on; either switch it off (Authentication → Providers → Email) or add SUPABASE_SERVICE_ROLE_KEY to .env.local and re-run`);
  }
}
// prove the password works
const probe = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
for (const email of USERS) {
  const { error } = await probe.auth.signInWithPassword({ email, password });
  console.error(`${email}: password sign-in ${error ? 'FAILS: ' + error.message : 'works'}`);
}
