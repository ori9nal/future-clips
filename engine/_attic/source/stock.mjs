// Priority 2: licensed stock. Pexels first, then Unsplash.
//
// Both are free and commercially licensed. The rule that makes this work is in
// the query, not the filter: "woman sleeping" returns bright stock garbage,
// "low key portrait window light night" returns usable frames. So every query
// carries a LIGHTING qualifier, and then the returned pixels are measured
// anyway — a qualifier is a request, not a guarantee.
import fs from 'node:fs';
import { keyFor, memo, readJson, writeJson } from './cache.mjs';
import { probeImage, judge, score } from './probe.mjs';

const PEXELS_KEY = () => process.env.PEXELS_API_KEY;
const UNSPLASH_KEY = () => process.env.UNSPLASH_ACCESS_KEY;

export function providerStatus() {
  return { pexels: Boolean(PEXELS_KEY()), unsplash: Boolean(UNSPLASH_KEY()) };
}

// ------------------------------------------------------------------- queries
/**
 * Lighting vocabulary. These are the qualifiers that move a search from stock
 * catalogue to something that survives the crush + split-tone grade.
 */
export const LIGHT = {
  'low-key':   ['low key', 'dramatic shadow', 'dark background', 'moody lighting'],
  'window':    ['window light', 'blue hour', 'soft directional light'],
  'night':     ['night', 'available light', 'dim room'],
  'studio-bw': ['studio portrait', 'black background', 'rim light'],
  'high-key':  ['white background', 'bright studio', 'clean backdrop'],
};

/**
 * Compose a stock query from a slide beat.
 * `subject` is the semantic noun phrase for the beat (an LLM supplies this per
 * campaign); `light` selects the qualifier set. Kept separate so the qualifier
 * can never be dropped by a caller writing a bare noun.
 */
export function buildQuery(subject, light = 'low-key', extra = []) {
  const q = [subject, ...(LIGHT[light] || LIGHT['low-key']).slice(0, 2), ...extra];
  return q.join(' ').replace(/\s+/g, ' ').trim();
}

// ------------------------------------------------------------------ providers
async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} — ${url.split('?')[0]} ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** @returns normalized candidates: {provider,id,w,h,url,page,author,authorUrl,alt} */
export async function searchPexels(query, { perPage = 24, orientation = 'portrait', page = 1 } = {}) {
  const key = PEXELS_KEY();
  if (!key) throw new Error('PEXELS_API_KEY is not set');
  const u = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=${orientation}`;
  const j = await getJson(u, { Authorization: key });
  return (j.photos || []).map((p) => ({
    provider: 'pexels',
    id: String(p.id),
    w: p.width, h: p.height,
    url: p.src?.large2x || p.src?.large || p.src?.original,
    page: p.url,
    author: p.photographer,
    authorUrl: p.photographer_url,
    alt: p.alt || '',
  }));
}

export async function searchUnsplash(query, { perPage = 24, orientation = 'portrait', page = 1 } = {}) {
  const key = UNSPLASH_KEY();
  if (!key) throw new Error('UNSPLASH_ACCESS_KEY is not set');
  const u = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=${orientation}`;
  const j = await getJson(u, { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' });
  return (j.results || []).map((p) => ({
    provider: 'unsplash',
    id: p.id,
    w: p.width, h: p.height,
    url: p.urls?.regular || p.urls?.full,
    page: p.links?.html,
    author: p.user?.name,
    authorUrl: p.user?.links?.html,
    // Unsplash's API guidelines require a download ping when an image is
    // actually used. Carried through so the fetch path can honour it.
    downloadLocation: p.links?.download_location,
    alt: p.alt_description || '',
  }));
}

/** Unsplash requires this ping when a photo is used. Fire-and-forget. */
async function pingUnsplashDownload(loc) {
  const key = UNSPLASH_KEY();
  if (!loc || !key) return;
  try { await fetch(loc, { headers: { Authorization: `Client-ID ${key}` } }); } catch {}
}

// ------------------------------------------------------------------- fetching
/** Download bytes, cached by URL so a re-run never re-downloads. */
export async function fetchCandidate(c) {
  const key = keyFor('stock', c.url, { p: c.provider, id: c.id });
  const { buf, hit } = await memo(key, '.jpg', async () => {
    const res = await fetch(c.url);
    if (!res.ok) throw new Error(`download ${res.status} for ${c.provider}:${c.id}`);
    return Buffer.from(await res.arrayBuffer());
  });
  if (!hit && c.provider === 'unsplash') await pingUnsplashDownload(c.downloadLocation);
  return { buf, hit, key };
}

// ------------------------------------------------------------------- the path
/**
 * Search → download → measure → filter → rank.
 * Providers run in the brief's order and results accumulate, so a thin Pexels
 * result set is topped up from Unsplash rather than failing.
 *
 * @returns {Promise<Array<{candidate,probe,score,buf}>>} best first
 */
export async function sourceStock(query, {
  mood = 'low-key', take = 6, perProvider = 24, orientation = 'portrait',
  providers = ['pexels', 'unsplash'], onLog = () => {},
} = {}) {
  const status = providerStatus();
  const cands = [];
  for (const p of providers) {
    if (!status[p]) { onLog(`skip ${p}: no key`); continue; }
    try {
      const r = p === 'pexels'
        ? await searchPexels(query, { perPage: perProvider, orientation })
        : await searchUnsplash(query, { perPage: perProvider, orientation });
      onLog(`${p}: ${r.length} results for "${query}"`);
      cands.push(...r);
    } catch (e) { onLog(`${p} failed: ${e.message}`); }
  }
  if (!cands.length) return [];

  const rows = [];
  for (const c of cands) {
    try {
      const { buf } = await fetchCandidate(c);
      const cacheKey = keyFor('probe', c.url, { mood });
      let probe = readJson(cacheKey);
      if (!probe) { probe = await probeImage(buf); writeJson(cacheKey, probe); }
      const j = judge(probe, mood);
      rows.push({ candidate: c, probe, pass: j.pass, fail: j.fail, score: score(probe, mood), buf });
    } catch (e) { onLog(`candidate ${c.provider}:${c.id} failed: ${e.message}`); }
  }
  const passing = rows.filter((r) => r.pass).sort((a, b) => b.score - a.score);
  onLog(`${passing.length}/${rows.length} candidates passed the "${mood}" filter`);
  return passing.slice(0, take);
}

/** Attribution record — written alongside any carousel that used stock. */
export function creditFor(c) {
  return {
    provider: c.provider, id: c.id, author: c.author, authorUrl: c.authorUrl, page: c.page,
    license: c.provider === 'pexels' ? 'Pexels License' : 'Unsplash License',
  };
}
