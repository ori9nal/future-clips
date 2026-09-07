/**
 * Admin gate.
 *
 * This app has no auth system, so this is a shared secret in an env var, not
 * real authentication: it stops a curious clipper from opening the admin pages,
 * and stops nothing else. Anyone who can read the deployed environment can pass
 * it, and it does not identify WHO acted.
 *
 * Before this is exposed to anyone outside the team it needs real sessions —
 * see the note in the admin page. Keeping the check in one place means there is
 * exactly one thing to replace.
 */
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "fc_admin";

export function adminSecret(): string | null {
  const s = process.env.FC_ADMIN_SECRET;
  return s && s.length >= 8 ? s : null;
}

/** True when the caller presented the secret. */
export async function isAdmin(): Promise<boolean> {
  const secret = adminSecret();
  // No secret configured means the gate is off — surfaced in the UI rather than
  // silently letting everyone in and looking protected.
  if (!secret) return false;
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === secret;
}

/** For route handlers, which get the header rather than the cookie. */
export function isAdminRequest(req: Request): boolean {
  const secret = adminSecret();
  if (!secret) return false;
  const header = req.headers.get("x-fc-admin");
  if (header && header === secret) return true;
  const cookie = req.headers.get("cookie") ?? "";
  return cookie.split(";").some((c) => c.trim() === `${ADMIN_COOKIE}=${secret}`);
}
