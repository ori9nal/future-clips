import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { claimReferral, REF_COOKIE } from "@/lib/referrals";

/**
 * Where the magic link (or Google) lands. Two ways in:
 *   ?code=…                    the PKCE code the browser client started (the
 *                              emailed link; the verifier lives in a cookie)
 *   ?token_hash=…&type=…       a token verified server-side, which needs no
 *                              verifier: Supabase's server-side email template
 *                              shape, and what tools/dev-login.mjs mints
 * Either way the session cookie is set and the user is forwarded to `next`,
 * which is only ever a path on this host (an absolute URL would be an open
 * redirect).
 */
const OTP_TYPES: EmailOtpType[] = ["magiclink", "signup", "invite", "recovery", "email_change", "email"];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next") ?? req.cookies.get("fc_next")?.value ?? "/app";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  const finish = async (supabase: Awaited<ReturnType<typeof createClient>>) => {
    const res = NextResponse.redirect(new URL(next, url.origin));
    res.cookies.set("fc_next", "", { maxAge: 0, path: "/" });
    // the agency referral cookie: claimed once, then dropped whatever the outcome
    const ref = req.cookies.get(REF_COOKIE)?.value;
    if (ref) {
      try { await claimReferral(supabase, ref); } catch { /* attribution never blocks sign-in */ }
      res.cookies.set(REF_COOKIE, "", { maxAge: 0, path: "/" });
    }
    return res;
  };
  const fail = (message: string) => NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, url.origin));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? fail(error.message) : finish(supabase);
  }
  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? fail(error.message) : finish(supabase);
  }
  // Supabase reports link problems (expired, already used) as query params.
  const desc = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  return fail(desc ?? "That link did not work. Request a new one.");
}
