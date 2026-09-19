import "server-only";

/**
 * Time-based one-time passwords (RFC 6238) for the admin gate.
 *
 * Written out rather than pulled in: it is HMAC-SHA1 over a counter, and a
 * dependency that generates your second factor is a dependency that can take
 * it away. Compatible with every authenticator — Google Authenticator, 1Password,
 * Authy, Apple Passwords — because the algorithm is the standard one.
 *
 * Why a code and not the passphrase: a passphrase is typed the same way every
 * time, so anyone who watches it once has it forever. A code is good for
 * thirty seconds and is generated on a device the attacker does not hold.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648 base32, no padding
export const DIGITS = 6;
export const STEP_SECONDS = 30;
/** one step either side: a phone clock is rarely exact, and 90 seconds is still short */
export const DRIFT_STEPS = 1;

/** A fresh shared secret: 20 bytes, the length RFC 4226 recommends for HMAC-SHA1. */
export function newSecret(): string {
  return base32(randomBytes(20));
}

function base32(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function unbase32(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** The code for one 30-second step. */
function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeUInt32BE(Math.floor(step / 2 ** 32), 0);
  counter.writeUInt32BE(step >>> 0, 4);
  const mac = createHmac("sha1", unbase32(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Is this the code for now, or for the step either side of it?
 *
 * Every candidate is compared in constant time and the loop always runs to
 * the end, so how long the answer takes never says which step matched.
 */
export function verifyCode(secret: string, given: string, now = Date.now()): boolean {
  const code = String(given ?? "").replace(/\D/g, "");
  if (code.length !== DIGITS || !secret) return false;
  const step = Math.floor(now / 1000 / STEP_SECONDS);
  let ok = false;
  for (let d = -DRIFT_STEPS; d <= DRIFT_STEPS; d++) {
    const a = Buffer.from(codeAt(secret, step + d));
    const b = Buffer.from(code);
    if (a.length === b.length && timingSafeEqual(a, b)) ok = true;
  }
  return ok;
}

/** The otpauth:// URI an authenticator scans or opens. */
export function otpauthUri(secret: string, account: string, issuer = "The Future Clips"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const q = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

/** The secret in groups of four, for anyone typing it in by hand. */
export const readableSecret = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;

/** The QR an authenticator scans, as inline SVG (no external script, no image host). */
export async function qrSvg(content: string, size = 176): Promise<string> {
  const { default: QRCode } = await import("qrcode-svg");
  return new QRCode({ content, width: size, height: size, padding: 0, ecl: "M", join: true, color: "#111111", background: "#ffffff" }).svg();
}
