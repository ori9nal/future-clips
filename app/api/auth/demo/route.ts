import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient, hasServiceRole } from "@/lib/supabase/admin";
import { DEMO_EMAIL, isDemoHost } from "@/lib/demo";
import { allow, clientIp, TOO_MANY } from "@/lib/ratelimit";

/**
 * GET on the hidden demo host (FC_DEMO_HOSTNAME): signs the visitor in as
 * the demo account and sends them to /app. On a host the service role mints
 * a one-time token and verifies it here (no password anywhere); on a laptop
 * without the key the dev password from .env.local is used. Anywhere else
 * this route does not exist.
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!isDemoHost(host)) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await allow(`demo-login:ip:${clientIp(req)}`, 20, 600))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return NextResponse.redirect(new URL("/app", req.url));

  if (hasServiceRole()) {
    const { data, error } = await adminClient().auth.admin.generateLink({ type: "magiclink", email: DEMO_EMAIL });
    const hash = data?.properties?.hashed_token;
    if (error || !hash) return NextResponse.json({ error: "the demo account is not ready (is demo@thefutureclips.com invited and created?)" }, { status: 503 });
    const { error: v } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: hash });
    if (v) return NextResponse.json({ error: v.message }, { status: 503 });
  } else if (process.env.NODE_ENV !== "production" && process.env.FC_DEV_PASSWORD) {
    const { error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: process.env.FC_DEV_PASSWORD });
    if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  } else {
    return NextResponse.json({ error: "the demo host needs SUPABASE_SERVICE_ROLE_KEY" }, { status: 503 });
  }
  return NextResponse.redirect(new URL("/app", req.url));
}
