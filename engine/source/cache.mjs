// Content-addressed cache. The COGS ceiling ($0.012/carousel) only holds if a
// cutout is computed ONCE and reused across every carousel that wants that
// subject — background removal is ~7.5s of CPU, which is the single most
// expensive operation in the pipeline. Keyed by hash of the source bytes plus
// the operation, so the same photo fetched from two different URLs collapses to
// one entry.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.env.CAROUSEL_CACHE || '.cache';

export const sha = (buf) =>
  crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32);

/** Stable key for (operation, source bytes, options). */
export function keyFor(op, source, opts = {}) {
  const src = Buffer.isBuffer(source) ? sha(source) : sha(Buffer.from(String(source)));
  const o = sha(Buffer.from(JSON.stringify(opts)));
  return `${op}-${src}-${o.slice(0, 8)}`;
}

const cellFor = (key, ext) => path.join(ROOT, key.slice(0, 2), `${key}${ext}`);

export function readCache(key, ext = '.png') {
  const f = cellFor(key, ext);
  return fs.existsSync(f) ? fs.readFileSync(f) : null;
}

export function writeCache(key, buf, ext = '.png') {
  const f = cellFor(key, ext);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, buf);
  return f;
}

/** Run `fn` only on a miss. Returns { buf, hit }. */
export async function memo(key, ext, fn) {
  const hit = readCache(key, ext);
  if (hit) return { buf: hit, hit: true };
  const buf = await fn();
  writeCache(key, buf, ext);
  return { buf, hit: false };
}

export function readJson(key) {
  const raw = readCache(key, '.json');
  return raw ? JSON.parse(raw.toString('utf8')) : null;
}

export function writeJson(key, obj) {
  return writeCache(key, Buffer.from(JSON.stringify(obj)), '.json');
}

/** Bytes on disk — surfaced in the admin cost view. */
export function cacheStats() {
  let files = 0, bytes = 0;
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { files++; bytes += fs.statSync(p).size; }
    }
  };
  walk(ROOT);
  return { root: ROOT, files, bytes };
}
