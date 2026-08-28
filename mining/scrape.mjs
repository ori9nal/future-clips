// Reference miner, scrape half: Apify -> posts -> reference corpus.
//
// The brief's hard-won operational note, encoded rather than rediscovered:
// HASHTAG SEARCH RETURNS EMPTY without a logged-in session and burns credits on
// every retry. Profile scraping via directUrls works. This module therefore
// only ever scrapes profiles, and refuses a hashtag input outright.
//
//   node --env-file=.env.local mining/scrape.mjs --handles handles.json
//   node --env-file=.env.local mining/scrape.mjs --handle papanca.io --limit 24
import fs from 'node:fs';
import path from 'node:path';
import { keyFor, memo } from '../engine/source/cache.mjs';

const ACTOR = 'apify~instagram-scraper';
const API = 'https://api.apify.com/v2';
const token = () => process.env.APIFY_TOKEN;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };

export function apifyConfigured() { return Boolean(token()); }

async function api(pathname, init = {}) {
  const sep = pathname.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${pathname}${sep}token=${token()}`, init);
  if (!res.ok) throw new Error(`apify ${res.status} ${res.statusText} on ${pathname}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Start an actor run and poll to completion. Async rather than run-sync because
 * 24 posts across several profiles routinely exceeds the sync endpoint's window.
 */
export async function runActor(input, { pollMs = 5000, timeoutMs = 15 * 60 * 1000, onLog = console.log } = {}) {
  if (!token()) throw new Error('APIFY_TOKEN is not set');
  const started = await api(`/acts/${ACTOR}/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const runId = started.data.id;
  onLog(`apify run ${runId} started`);

  const t0 = Date.now();
  for (;;) {
    const r = await api(`/actor-runs/${runId}`);
    const s = r.data.status;
    if (s === 'SUCCEEDED') {
      onLog(`apify run ${runId} succeeded in ${Math.round((Date.now() - t0) / 1000)}s`);
      const items = await api(`/datasets/${r.data.defaultDatasetId}/items?clean=true&format=json`);
      return items;
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(s)) {
      throw new Error(`apify run ${runId} ended ${s}`);
    }
    if (Date.now() - t0 > timeoutMs) throw new Error(`apify run ${runId} exceeded ${timeoutMs}ms`);
    await sleep(pollMs);
  }
}

/** Normalise an Apify Instagram post into a reference-corpus row. */
export function normalisePost(p, niche) {
  const images = Array.isArray(p.images) && p.images.length
    ? p.images
    : (p.childPosts || []).map((c) => c.displayUrl).filter(Boolean);
  const slideImages = images.length ? images : (p.displayUrl ? [p.displayUrl] : []);
  return {
    url: p.url || (p.shortCode ? `https://www.instagram.com/p/${p.shortCode}/` : null),
    shortCode: p.shortCode || null,
    handle: p.ownerUsername || null,
    niche: niche || null,
    likes: p.likesCount ?? null,
    comments: p.commentsCount ?? null,
    caption: p.caption || '',
    timestamp: p.timestamp || null,
    slideCount: slideImages.length,
    slideImages,
    isCarousel: (p.type === 'Sidecar') || slideImages.length > 1,
  };
}

/**
 * Scrape one or more profiles.
 * @param handles ['papanca.io', ...] or [{handle, niche}]
 */
export async function scrapeProfiles(handles, { resultsLimit = 24, onLog = console.log } = {}) {
  const list = handles.map((h) => (typeof h === 'string' ? { handle: h } : h));
  for (const h of list) {
    if (String(h.handle).startsWith('#')) {
      throw new Error(`hashtag input "${h.handle}" rejected: hashtag search returns empty without a session and burns credits`);
    }
  }
  const directUrls = list.map((h) => `https://www.instagram.com/${String(h.handle).replace(/^@/, '')}/`);
  const items = await runActor({ directUrls, resultsType: 'posts', resultsLimit }, { onLog });

  const nicheOf = new Map(list.map((h) => [String(h.handle).replace(/^@/, '').toLowerCase(), h.niche]));
  return items
    .map((p) => normalisePost(p, nicheOf.get(String(p.ownerUsername || '').toLowerCase())))
    .filter((p) => p.url);
}

/** Download every slide image of a post, cached by URL. */
export async function downloadSlides(post, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const files = [];
  for (let i = 0; i < post.slideImages.length; i++) {
    const url = post.slideImages[i];
    const key = keyFor('ig-slide', url, {});
    const { buf } = await memo(key, '.jpg', async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`slide download ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    });
    const f = path.join(dir, `slide-${String(i + 1).padStart(2, '0')}.jpg`);
    fs.writeFileSync(f, buf);
    files.push(f);
  }
  return files;
}

// --------------------------------------------------------------------- CLI
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  if (!apifyConfigured()) {
    console.error('APIFY_TOKEN is not set. Run with: node --env-file=.env.local mining/scrape.mjs ...');
    process.exit(2);
  }
  const handlesFile = arg('--handles');
  const one = arg('--handle');
  const limit = Number(arg('--limit', 24));
  const outDir = arg('--out', 'mining/scraped');

  const handles = handlesFile
    ? JSON.parse(fs.readFileSync(handlesFile, 'utf8'))
    : one ? [one] : null;
  if (!handles) { console.error('pass --handles <file.json> or --handle <name>'); process.exit(2); }

  const posts = await scrapeProfiles(handles, { resultsLimit: limit });
  const carousels = posts.filter((p) => p.isCarousel);
  console.log(`${posts.length} posts, ${carousels.length} carousels`);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'posts.json'), JSON.stringify(posts, null, 2));

  // top quartile by likes gets its slides pulled for feature extraction
  const sorted = carousels.filter((p) => p.likes != null).sort((a, b) => b.likes - a.likes);
  const cut = Math.max(1, Math.ceil(sorted.length * 0.25));
  for (const p of sorted.slice(0, cut)) {
    const dir = path.join(outDir, `${p.handle}-${p.shortCode}`);
    await downloadSlides(p, dir);
    console.log(`  ${String(p.likes).padStart(8)} likes  ${p.slideCount} slides  ${dir}`);
  }
  console.log(`\nwrote ${outDir}/posts.json — now run: node mining/analyse.mjs --dir ${outDir}`);
}
