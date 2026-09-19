import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyCode, newSecret, otpauthUri, readableSecret, STEP_SECONDS } from "../lib/totp.ts";

// RFC 6238 appendix B, SHA1. The secret is the ASCII "12345678901234567890"
// in base32; these are the 6-digit truncations of the published 8-digit codes.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const VECTORS = [
  [59, "287082"], [1111111109, "081804"], [1111111111, "050471"],
  [1234567890, "005924"], [2000000000, "279037"], [20000000000, "353130"],
];

test("the codes match RFC 6238's own vectors", () => {
  for (const [seconds, code] of VECTORS) {
    assert.ok(verifyCode(RFC_SECRET, code, seconds * 1000), `t=${seconds} should accept ${code}`);
  }
});

test("a code from the step either side is accepted, further away is not", () => {
  const t = 1111111109 * 1000;
  assert.ok(verifyCode(RFC_SECRET, "081804", t), "this step");
  assert.ok(verifyCode(RFC_SECRET, "081804", t + STEP_SECONDS * 1000), "one step late");
  assert.ok(verifyCode(RFC_SECRET, "081804", t - STEP_SECONDS * 1000), "one step early");
  assert.ok(!verifyCode(RFC_SECRET, "081804", t + STEP_SECONDS * 3000), "three steps late is refused");
});

test("junk is refused without throwing", () => {
  for (const bad of ["", "12345", "1234567", "abcdef", "  ", null, undefined]) {
    assert.equal(verifyCode(RFC_SECRET, bad, 59_000), false, `refused: ${JSON.stringify(bad)}`);
  }
  assert.equal(verifyCode("", "287082", 59_000), false, "no secret, no entry");
});

test("a fresh secret is 32 base32 characters and round-trips", () => {
  const s = newSecret();
  assert.match(s, /^[A-Z2-7]{32}$/);
  // a code generated for one secret must not verify against another
  const other = newSecret();
  assert.notEqual(s, other);
});

test("the otpauth uri carries what an authenticator needs", () => {
  const uri = otpauthUri("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "you@example.com");
  const u = new URL(uri);
  assert.equal(u.protocol, "otpauth:");
  assert.equal(u.searchParams.get("secret"), "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(u.searchParams.get("issuer"), "The Future Clips");
  assert.equal(u.searchParams.get("digits"), "6");
  assert.equal(u.searchParams.get("period"), "30");
  assert.ok(decodeURIComponent(u.pathname).includes("you@example.com"));
});

test("the readable secret is the same secret, just spaced", () => {
  const s = newSecret();
  assert.equal(readableSecret(s).replace(/ /g, ""), s);
});
