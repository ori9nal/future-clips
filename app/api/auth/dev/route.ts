import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rememberNext, safeNext, sameOrigin } from "@/lib/login";
import { allow, clientIp, TOO_MANY } from "@/lib/ratelimit";

/**
 * Laptops only: sign in as one of the two local test accounts with the
 * password from .env.local (tools/dev-users.mjs). 404 in production and
 * whenever FC_DEV_LOGIN is not "1", so the route does not exist on a host.
 */
const WHO: Record<string, string> = { demo: "demo@thefutureclips.com", tester: "tester@thefutureclips.com" };

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.FC_DEV_LOGIN !== "1") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Sign in from the app itself." }, { status: 403 });
  if (!(await allow(`dev:ip:${clientIp(req)}`, 30, 600))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { who?: unknown; next?: unknown };
  const email = WHO[String(body.who ?? "")];
  const password = process.env.FC_DEV_PASSWORD;
  if (!email || !password) return NextResponse.json({ error: "no such dev account, or FC_DEV_PASSWORD is not set" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: `${email}: ${error.message} (run node tools/dev-users.mjs)` }, { status: 401 });
  const res = NextResponse.json({ ok: true, next: safeNext(body.next) });
  rememberNext(res, "", false);
  return res;
}
