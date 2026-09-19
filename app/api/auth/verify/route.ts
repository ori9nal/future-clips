import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loginError, rememberNext, requestOrigin, safeNext, sameOrigin } from "@/lib/login";
import { allow, clientIp, TOO_MANY } from "@/lib/ratelimit";

/**
 * POST { email, token, next? } → the code from the sign-in email (Supabase
 * issues 6 to 10 digits depending on the project setting; never assume six),
 * verified on the server. Works on any device (no PKCE verifier needed), so
 * a link requested on the laptop can be finished from the phone's inbox.
 * On success the session cookies are set and the browser goes to `next`.
 */
const EMAIL = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Sign in from the app itself.", code: "FC_CROSS_SITE" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; token?: unknown; next?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const token = typeof body.token === "string" ? body.token.replace(/\D/g, "") : "";
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (token.length < 6 || token.length > 10) return NextResponse.json({ error: "Enter the code from the email." }, { status: 400 });
  // a code has a million values: 10 tries per address per 10 minutes, 6 per email per 15 minutes
  if (!(await allow(`verify:ip:${clientIp(req)}`, 10, 600)) || !(await allow(`verify:email:${email}`, 6, 900))) {
    return NextResponse.json({ error: TOO_MANY, code: "FC_RATE" }, { status: 429 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    const e = /expired|invalid|not found/i.test(error.message)
      ? { error: "That code did not work. Check every digit — the code is longer than six — or request a new link.", status: 400 }
      : loginError(error.message);
    return NextResponse.json({ error: e.error }, { status: e.status });
  }
  const next = safeNext(body.next);
  const res = NextResponse.json({ ok: true, next });
  rememberNext(res, "", requestOrigin(req).startsWith("https:"));
  return res;
}
