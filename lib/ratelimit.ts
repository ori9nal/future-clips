import "server-only";
import { createHash } from "node:crypto";
import { adminClient, hasServiceRole } from "@/lib/supabase/admin";

/**
 * A fixed-window rate limiter backed by `fc_rate_limit` (migration 0011),
 * called as the service role. The key is hashed before it leaves the host,
 * so the table never holds an address. On a laptop without the service role
 * there is no limiter (Supabase's own mailer limits still apply); if the
 * database call fails the request is allowed and the failure is logged,
 * because a broken limiter must not lock everyone out of sign-in.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  if (!hasServiceRole()) return true;
  const hashed = createHash("sha256").update(key).digest("hex");
  const { data, error } = await adminClient().rpc("fc_rate_limit", { p_key: hashed, p_limit: limit, p_window_s: windowSeconds });
  if (error) { console.warn(`rate limiter unavailable: ${error.message}`); return true; }
  return data === true;
}

/** The caller's address behind Vercel's proxy, or "unknown". */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

export const TOO_MANY = "Too many sign-in requests from here. Wait a few minutes and try again.";

/**
 * How many the caller has left on a limiter, without spending one (R16).
 * Returns null when there is no limiter on this host, so a caller can tell
 * "unlimited here" apart from "none left".
 */
export async function remaining(key: string, limit: number, windowSeconds: number): Promise<number | null> {
  if (!hasServiceRole()) return null;
  const hashed = createHash("sha256").update(key).digest("hex");
  const { data, error } = await adminClient().rpc("fc_rate_limit_peek", { p_key: hashed, p_limit: limit, p_window_s: windowSeconds });
  if (error) { console.warn(`rate limiter unavailable: ${error.message}`); return null; }
  return typeof data === "number" ? data : null;
}

/**
 * What the demo allows in a day. One visitor's three carousels are the
 * headline; the second number stops one busy day from spending the demo
 * workspace's whole monthly budget (orgs.spend_cap_usd, migration 0015 —
 * raising it is one update).
 */
export const DEMO_LIMITS = { perVisitor: 3, perDay: 15, windowSeconds: 86400 } as const;
