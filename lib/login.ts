import "server-only";
import type { NextResponse } from "next/server";

/**
 * Request helpers for the /api/auth and /api/billing routes. The browser no longer talks to
 * Supabase directly to ask for a magic link: the login page ships no Supabase
 * client, and the callback URL is built here from the request's own origin.
 */

/** The public origin of this request: what the browser typed, behind Vercel's proxy too. */
export function requestOrigin(req: Request): string {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || u.host;
  return `${proto}://${host}`;
}

/** A browser-sent Origin header must be this host (a cross-site POST cannot request links). */
export function sameOrigin(req: Request): boolean {
  const o = req.headers.get("origin");
  return !o || o === requestOrigin(req);
}

/** Where to land after sign-in: a path on this host, never another site. */
export function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/app";
}

/**
 * The callback URL carries no query so it matches an exact allow-list entry
 * in Supabase; where the member wanted to land rides in a short-lived cookie
 * the callback reads and clears.
 */
export function rememberNext(res: NextResponse, next: string, secure: boolean): void {
  res.cookies.set("fc_next", next, { maxAge: 3600, path: "/", sameSite: "lax", httpOnly: true, secure });
}

/** Supabase's messages, turned into sentences the form shows. */
export function loginError(message: string): { error: string; status: number } {
  if (/database error saving new user|FC_INVITE_ONLY/i.test(message)) {
    return { error: "That email is not on the invite list. Ask whoever runs your workspace to add it.", status: 403 };
  }
  if (/rate limit/i.test(message)) {
    return { error: "Too many sign-in emails in the last hour. Use the link already in your inbox, or try again in a little while.", status: 429 };
  }
  return { error: message, status: 400 };
}
