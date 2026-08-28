// Priority 1 in the sourcing order: the campaign's OWN video.
//
// Best fit, most on-brand, and $0 — a frame from the client's footage is always
// more on-brand than the best stock match, so this path runs before any network
// call. ffmpeg scene-detects, we score cheaply on pixels, and only the survivors
// pay for matting.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { probeImage, judge, score } from './probe.mjs';
import { sha } from './cache.mjs';

const run = promisify(execFile);

export async function ffmpegAvailable() {
  try { await run('ffmpeg', ['-version']); return true; } catch { return false; }
}

/**
 * Scene-detect and dump candidate frames.
 * @param {string} video  path to source video
 * @param {object} opts   { threshold=0.4, max=40, dir }
 * @returns {Promise<string[]>} extracted frame paths
 */
export async function extractFrames(video, opts = {}) {
  const { threshold = 0.4, max = 40 } = opts;
  if (!fs.existsSync(video)) throw new Error(`source video missing: ${video}`);
  const dir = opts.dir || path.join(os.tmpdir(), 'carousel-frames', sha(Buffer.from(path.resolve(video))).slice(0, 12));
  fs.mkdirSync(dir, { recursive: true });

  // -vsync vfr keeps only the selected frames rather than padding to the
  // source rate; without it ffmpeg writes thousands of duplicates.
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', video,
    '-vf', `select='gt(scene,${threshold})',scale=1080:-2`,
    '-vsync', 'vfr',
    '-frames:v', String(max),
    '-q:v', '2',
    path.join(dir, 'f%03d.jpg'),
  ], { maxBuffer: 1 << 26 });

  let frames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(dir, f));

  // A locked-off talking-head clip has no cuts at all, so scene detect returns
  // nothing. Fall back to a fixed cadence rather than reporting "no frames".
  if (frames.length === 0) {
    await run('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-i', video, '-vf', 'fps=1/2,scale=1080:-2', '-frames:v', String(max), '-q:v', '2',
      path.join(dir, 'i%03d.jpg'),
    ], { maxBuffer: 1 << 26 });
    frames = fs.readdirSync(dir).filter((f) => f.endsWith('.jpg')).sort().map((f) => path.join(dir, f));
  }
  return frames;
}

/** Probe + rank every candidate frame for a given mood. */
export async function rankFrames(frames, mood = 'low-key') {
  const rows = [];
  for (const f of frames) {
    try {
      const p = await probeImage(f);
      const j = judge(p, mood);
      rows.push({ file: f, probe: p, pass: j.pass, fail: j.fail, score: score(p, mood) });
    } catch (e) {
      rows.push({ file: f, error: String(e.message || e), pass: false, score: 0 });
    }
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
}

/** Extract → rank → return the passing frames, best first. */
export async function bestFramesFrom(video, { mood = 'low-key', take = 6, ...opts } = {}) {
  const frames = await extractFrames(video, opts);
  const ranked = await rankFrames(frames, mood);
  const passing = ranked.filter((r) => r.pass);
  // If the mood filter empties the set, fall back to the highest-scoring frames
  // rather than failing the slide — the caller can still reject downstream.
  return (passing.length ? passing : ranked).slice(0, take);
}
