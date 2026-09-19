import "server-only";

/**
 * The admin gate: a code from an authenticator, every time.
 *
 * Being a platform owner rests entirely on a mailbox — anyone who reaches the
 * owner's inbox reaches /admin. The second factor is a rotating six-digit code
 * (RFC 6238, lib/totp.ts) generated on a device the attacker does not hold,
 * and nothing about it travels by email. A correct code opens an unlock that
 * lasts hours, not months, and each code is spent the moment it is used, so
 * one seen over a shoulder cannot be replayed inside its ninety seconds.
 *
 * This replaced a passphrase and a ninety-day trusted device (migration 0022).
 * The device table stays for the record of where admin was opened; what the
 * gate reads is the unlock (migration 0025).
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A fresh cookie value. 32 random bytes, base64url, never stored as written. */
export const newToken = () => randomBytes(32).toString("base64url");

/** "Chrome on Linux" from a user-agent string — enough to recognise a row. */
export function describeAgent(ua: string | null | undefined): string {
  const s = String(ua ?? "");
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Chrome\//.test(s) ? "Chrome"
    : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "a browser";
  const os = /Android/.test(s) ? "Android" : /iPhone|iPad/.test(s) ? "iOS" : /Mac OS X/.test(s) ? "macOS"
    : /Windows/.test(s) ? "Windows" : /Linux/.test(s) ? "Linux" : "an unknown system";
  return `${browser} on ${os}`;
}

/* ── the code gate (migration 0025) ─────────────────────────────────────── */

export const UNLOCK_COOKIE = "fc_admin_unlock";
/** how long one code buys. Short by design: the owner asked for a code every time. */
export const UNLOCK_HOURS = 8;

export async function unlockToken(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(UNLOCK_COOKIE)?.value;
  return v && v.length >= 20 && v.length <= 100 ? v : null;
}

/** Is this browser inside a live unlock? */
export async function adminUnlocked(sb: SupabaseClient): Promise<boolean> {
  const token = await unlockToken();
  if (!token) return false;
  const { data, error } = await sb.rpc("fc_unlocked", { p_hash: hashToken(token) });
  return !error && data === true;
}

/** Has this owner set an authenticator up yet? */
export async function totpState(sb: SupabaseClient): Promise<{ enrolled: boolean; confirmed: boolean }> {
  const { data, error } = await sb.rpc("fc_totp_state");
  const row = (Array.isArray(data) ? data[0] : data) as { enrolled?: boolean; confirmed?: boolean } | undefined;
  if (error || !row) return { enrolled: false, confirmed: false };
  return { enrolled: !!row.enrolled, confirmed: !!row.confirmed };
}
