// Divergence. hash(account_id, campaign_id, post_index) drives every structural
// choice, so two posts from the same account are structurally different by
// construction rather than by chance — and any given post is reproducible forever.
import crypto from 'node:crypto';

export function h32(...parts) {
  const s = parts.map(String).join('');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Small, fast, fully deterministic PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.range = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.chance = (p) => next() < p;
  /** Pick k distinct items, order preserved. */
  next.sample = (arr, k) => {
    const pool = arr.slice();
    const out = [];
    while (out.length < k && pool.length) out.push(pool.splice(Math.floor(next() * pool.length), 1)[0]);
    return out;
  };
  /** Fisher-Yates, seeded. */
  next.shuffle = (arr) => {
    const a2 = arr.slice();
    for (let i = a2.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a2[i], a2[j]] = [a2[j], a2[i]];
    }
    return a2;
  };
  return next;
}

/**
 * Structural fingerprint of a finished carousel. Collisions inside a batch mean
 * two posts share a skeleton and will read as templated.
 */
export function fingerprint({ family, slideCount, hookType, accent }) {
  const key = [family, slideCount, hookType, accent].join('|');
  return {
    key,
    hash: crypto.createHash('sha1').update(key).digest('hex').slice(0, 12),
  };
}

/** Report duplicate fingerprints across a batch of carousels. */
export function fingerprintCollisions(carousels) {
  const byKey = new Map();
  for (const c of carousels) {
    const k = c.fingerprint.key;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(c.id);
  }
  return [...byKey.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));
}
