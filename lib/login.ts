import "server-only";
import type { NextResponse } from "next/server";

/**
 * Request helpers for the /api/auth and /api/billing routes. The browser no longer talks to
 * Supabase directly to ask for a magic link: the login page ships no Supabase
 * client, and the callback URL is built here from the request's own origin.
 */

/**
 * The public origin of this request. In production the configured app URL
 * wins (a spoofed Host or X-Forwarded-Host must never end up in an emailed
 * link or a checkout return URL); the headers are only trusted on a laptop.
 */
export function requestOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured && process.env.NODE_ENV === "production") return configured;
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host") || u.host;
  return `${proto}://${host}`;
}

/** A browser-sent Origin header must be this host (a cross-site POST cannot request links). */
export function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  const o = req.headers.get("origin");
  if (!o) return true;
  const allowed = new Set([requestOrigin(req), `${new URL(req.url).protocol}//${req.headers.get("host") ?? ""}`]);
  return allowed.has(o);
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
  if (!next) { res.cookies.set("fc_next", "", { maxAge: 0, path: "/" }); return; }
  res.cookies.set("fc_next", next, { maxAge: 3600, path: "/", sameSite: "lax", httpOnly: true, secure });
}

/** Supabase's messages, turned into sentences the form shows. */
export function loginError(message: string): { error: string; status: number } {
  if (/FC_INVITE_ONLY/i.test(message)) {
    return { error: "That email is not on the invite list. Ask whoever runs your workspace to add it.", status: 403 };
  }
  // GoTrue reports any failure in the sign-up triggers as this one sentence,
  // with the real cause hidden. It used to be shown as an invite refusal, and
  // a broken trigger (0028) then read as "not on the list" for a day. It is a
  // fault of ours, and is said so.
  if (/database error saving new user/i.test(message)) {
    return { error: "We could not create your account just now. Try again in a minute, and if it keeps happening email team@thefutureclips.com.", status: 500 };
  }
  if (/rate limit/i.test(message)) {
    return { error: "Too many sign-in emails in the last hour. Use the link already in your inbox, or try again in a little while.", status: 429 };
  }
  return { error: message, status: 400 };
}

/**
 * The plan a visitor clicked on the site, as the app's own plan id.
 *
 * The pricing cards link to `/signup?plan=clipper|pro|studio`, which the site
 * forwards to `/login?plan=…`. Nothing read it, so a visitor who picked a plan
 * signed in and landed on an empty dashboard with their choice forgotten.
 */
const PLAN_IDS: Record<string, string> = {
  clipper: "solo", solo: "solo",
  pro: "grind", grind: "grind",
  studio: "agency", agency: "agency",
};

export function planTarget(raw: unknown): string | null {
  const key = String(raw ?? "").trim().toLowerCase();
  return PLAN_IDS[key] ?? null;
}

/** Where a visitor who picked a plan should land once they are signed in. */
export function planNext(raw: unknown): string | null {
  const id = planTarget(raw);
  return id ? `/app?page=settings&tab=plan&want=${id}` : null;
}
