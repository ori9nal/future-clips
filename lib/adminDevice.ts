import "server-only";

/**
 * The admin surface is limited to devices that were trusted once.
 *
 * Being a platform owner is one factor, and it rests entirely on a mailbox:
 * anyone who reaches the owner's inbox reaches /admin. The second factor is a
 * 32-byte random token in an http-only cookie, enrolled by typing the admin
 * passphrase (`FC_ADMIN_SECRET`) once on that device. Only the token's SHA-256
 * is stored (migration 0022), so a leaked database row cannot be replayed as a
 * cookie, and a lost laptop is revoked from the admin page.
 *
 * The gate is only ON where `FC_ADMIN_SECRET` is set. A host without it keeps
 * today's behaviour — platform owners in, everyone else out — rather than
 * locking the owner out of their own admin while they go and set a variable.
 * `/admin` says which of the two it is.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEVICE_COOKIE = "fc_admin_device";
/** three months, then the passphrase is asked for again on that device */
export const DEVICE_MAX_AGE = 90 * 24 * 60 * 60;
export const MAX_DEVICES = 5;

/** Is the second factor switched on for this host? */
export const deviceGateOn = () => !!process.env.FC_ADMIN_SECRET;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** A fresh cookie value. 32 random bytes, base64url, never stored as written. */
export const newToken = () => randomBytes(32).toString("base64url");

/** The passphrase, compared in constant time and never logged. */
export function passphraseMatches(given: string): boolean {
  const secret = process.env.FC_ADMIN_SECRET ?? "";
  if (!secret || !given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/** The token this browser presented, if any. */
export async function deviceToken(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(DEVICE_COOKIE)?.value;
  return v && v.length >= 20 && v.length <= 100 ? v : null;
}

/**
 * Is the caller on a trusted device? Answers true when the gate is off, so
 * every caller can ask the same question.
 */
export async function deviceTrusted(sb: SupabaseClient): Promise<boolean> {
  if (!deviceGateOn()) return true;
  const token = await deviceToken();
  if (!token) return false;
  const { data, error } = await sb.rpc("fc_device_ok", { p_hash: hashToken(token) });
  return !error && data === true;
}

export type AdminDevice = {
  id: string;
  label: string | null;
  agent: string | null;
  created_ip: string | null;
  created_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
};

/** "Chrome on Linux" from a user-agent string — enough to recognise a row. */
export function describeAgent(ua: string | null | undefined): string {
  const s = String(ua ?? "");
  const browser = /Edg\//.test(s) ? "Edge" : /OPR\//.test(s) ? "Opera" : /Chrome\//.test(s) ? "Chrome"
    : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "a browser";
  const os = /Android/.test(s) ? "Android" : /iPhone|iPad/.test(s) ? "iOS" : /Mac OS X/.test(s) ? "macOS"
    : /Windows/.test(s) ? "Windows" : /Linux/.test(s) ? "Linux" : "an unknown system";
  return `${browser} on ${os}`;
}
