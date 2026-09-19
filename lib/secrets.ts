import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** Constant-time comparison of an Authorization header against a bearer secret. */
export function bearerMatches(authorization: string, secret: string): boolean {
  const given = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!given || !secret) return false;
  // hash both sides so the comparison never depends on the length of either
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}
