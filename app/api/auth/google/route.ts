import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loginError, rememberNext, requestOrigin, safeNext, sameOrigin } from "@/lib/login";
import { allow, clientIp, TOO_MANY } from "@/lib/ratelimit";

/**
 * POST { next? } → { url }: where to send the browser to sign in with Google.
 * Only answers when NEXT_PUBLIC_GOOGLE_AUTH=1 (the OAuth client exists). The
 * server client writes the PKCE verifier cookie; Google returns to
 * /auth/callback?code=… like the magic link does.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Sign in from the app itself." }, { status: 403 });
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH !== "1") return NextResponse.json({ error: "Google sign-in is not enabled." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { next?: unknown };
  if (!(await allow(`google:ip:${clientIp(req)}`, 20, 600))) return NextResponse.json({ error: TOO_MANY }, { status: 429 });

  const origin = requestOrigin(req);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback`, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
  });
  if (error || !data?.url) {
    const e = loginError(error?.message ?? "Google sign-in is not available right now.");
    return NextResponse.json({ error: e.error }, { status: e.status });
  }
  const res = NextResponse.json({ url: data.url });
  rememberNext(res, safeNext(body.next), origin.startsWith("https:"));
  return res;
}
