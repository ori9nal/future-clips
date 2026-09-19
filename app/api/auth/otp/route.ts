import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loginError, rememberNext, requestOrigin, safeNext, sameOrigin } from "@/lib/login";
import { allow, clientIp, TOO_MANY } from "@/lib/ratelimit";

/**
 * POST { email, next? } → asks Supabase to email a magic link. Runs on the
 * server so the login page ships no Supabase client; the PKCE verifier the
 * link needs is written to a cookie by the server client, and the emailed
 * link lands on /auth/callback?code=… as before. Whether the email may sign
 * up at all is still the database's call (allowed_emails + the invite gate).
 */
const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Sign in from the app itself.", code: "FC_CROSS_SITE" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  // 10 requests per address per 10 minutes, 5 per email per hour (hashed keys)
  if (!(await allow(`otp:ip:${clientIp(req)}`, 10, 600)) || !(await allow(`otp:email:${email}`, 5, 3600))) {
    return NextResponse.json({ error: TOO_MANY, code: "FC_RATE" }, { status: 429 });
  }

  const origin = requestOrigin(req);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) {
    const e = loginError(error.message);
    return NextResponse.json({ error: e.error }, { status: e.status });
  }
  const res = NextResponse.json({ ok: true });
  rememberNext(res, safeNext(body.next), origin.startsWith("https:"));
  return res;
}
