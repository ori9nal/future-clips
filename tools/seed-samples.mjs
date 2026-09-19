// Seed campaign samples from sets this engine already rendered.
//
//   node tools/seed-samples.mjs [--dry]
//
// A sample is three public slides per live campaign. New campaigns get one by
// rendering (admin → Make), which costs a set; every campaign that already has
// a set on disk can have one for nothing, which is what this does.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';

const DRY = process.argv.includes('--dry');
const ROOT = process.cwd();
const SETS = path.join(ROOT, 'output', 'sets');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const sb = createClient(url, key, { auth: { persistSession: false } });

// a sample must show a look a customer can still get: a set rendered in a
// retired style would promise something the product no longer offers
const reg = await import(pathToFileURL(path.join(ROOT, 'engine', 'styles', 'registry.mjs')).href);
const retired = reg.RETIRED ?? new Set();

const { data: rows, error } = await sb.from('campaigns').select('id, status, sample').eq('kind', 'spec');
if (error) { console.error(error.message); process.exit(1); }

// every rendered set on disk, newest first, keyed by the campaign it belongs to
const dirs = fs.existsSync(SETS) ? fs.readdirSync(SETS) : [];
const pick = (id) => {
  const mine = dirs
    .filter((d) => d === id || d.startsWith(`${id}-`))
    .filter((d) => {
      const rest = d.slice(id.length + 1).replace(/-(priority|batch)$/, '');
      return !retired.has(rest);
    })
    .map((d) => path.join(SETS, d))
    .filter((d) => fs.existsSync(path.join(d, 'slide-3.png')))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return mine[0] ?? null;
};

let done = 0, skipped = 0, missing = 0;
for (const r of rows) {
  if (r.status !== 'live') { skipped++; continue; }
  if (r.sample?.urls?.length) { skipped++; continue; }
  const dir = pick(r.id);
  if (!dir) { console.log(`—  ${r.id}: no rendered set on disk`); missing++; continue; }
  const urls = [];
  for (const n of [1, 2, 3]) {
    const file = path.join(dir, `slide-${n}.png`);
    const key2 = `${r.id}/slide-${n}.webp`;
    if (!DRY) {
      const webp = await sharp(fs.readFileSync(file)).resize(720).webp({ quality: 80 }).toBuffer();
      const up = await sb.storage.from('samples').upload(key2, webp, { contentType: 'image/webp', upsert: true });
      if (up.error) { console.error(`!  ${r.id}: ${up.error.message}`); break; }
    }
    urls.push(sb.storage.from('samples').getPublicUrl(key2).data.publicUrl);
  }
  if (urls.length !== 3) continue;
  let caption = null;
  const post = path.join(dir, 'post.json');
  if (fs.existsSync(post)) { try { caption = JSON.parse(fs.readFileSync(post, 'utf8')).caption ?? null; } catch { /* no caption */ } }
  if (!DRY) {
    const { error: e2 } = await sb.from('campaigns')
      .update({ sample: { urls, caption, set_id: null, at: new Date().toISOString(), from: path.basename(dir) } })
      .eq('id', r.id);
    if (e2) { console.error(`!  ${r.id}: ${e2.message}`); continue; }
  }
  console.log(`ok ${r.id.padEnd(34)} ${path.basename(dir)}`);
  done++;
}
console.log(`\n${done} seeded, ${skipped} already had one or not live, ${missing} with nothing on disk${DRY ? ' (dry run)' : ''}`);
