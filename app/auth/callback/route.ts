import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where the magic link (or Google) lands. Exchanges the one-time code for a
 * session cookie and forwards to `next`. `next` is only ever a path on this
 * host — an absolute URL here would be an open redirect.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/app";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  // Supabase reports link problems (expired, already used) as query params.
  const desc = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(desc ?? "That link did not work. Request a new one.")}`, url.origin));
}
