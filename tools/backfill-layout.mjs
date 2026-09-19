// Make sets rendered before migration 0027 editable.
//
//   node tools/backfill-layout.mjs [id=<set id>] [limit=10] [--write]
//
// A set made before the renderer started keeping its pieces has slides and
// nothing else, so the editor has no blocks to show. Everything needed to
// rebuild one is still here, though: the copy and the frame ids are on the
// row, and the frames themselves are in the `cache` bucket, shared by every
// set that ever drew them. So this draws the set again from those — no model
// call, no money — and keeps what the renderer now keeps: the SVG that drew
// the words, the picture under it, and the blocks.
//
// The freshly drawn slides are compared with the ones in Storage. Identical
// is the expected case and means the layout describes exactly what the
// customer is looking at; a difference (a style changed since) means the new
// slides are uploaded too, so the picture and its blocks still agree.
//
// Without --write it says what it would do and touches nothing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { toRenderable } from '../engine/generate.mjs';
import { render } from '../engine/styles/registry.mjs';

const ROOT = process.cwd();
if (process.env.VERCEL) { console.error('a laptop tool'); process.exit(1); }

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const i = a.indexOf('='); return i < 0 ? [a.replace(/^--/, ''), true] : [a.slice(0, i).replace(/^--/, ''), a.slice(i + 1)];
}));
const WRITE = !!args.write;

const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')
  .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const TYPES = { '.svg': 'image/svg+xml', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12);

const COLS = 'id, org_id, campaign_id, style, status, files_json, state_json, layout_json, edits_json';
let q = sb.from('sets').select(COLS)
  .eq('status', 'done').is('layout_json', null).order('created_at', { ascending: false }).limit(Number(args.limit ?? 10));
if (args.id) q = sb.from('sets').select(COLS).eq('id', args.id);
const { data: rows, error } = await q;
if (error) throw error;
if (!rows?.length) { console.log('nothing to do'); process.exit(0); }

for (const row of rows) {
  // a set someone has already edited would have those edits drawn over by the
  // slides this re-renders: the baseline is what it keeps, not what they made
  if (row.edits_json && !args.force) { console.log(`${row.id}  skipped — it has edits; pass --force to draw over them`); continue; }
  const s = row.state_json;
  const content = s?.copy?.content;
  const frames = s?.art?.files ?? [];
  if (!content || !frames.length) { console.log(`${row.id}  skipped — no copy or frames on the row`); continue; }

  const { data: camp } = await sb.from('campaigns').select('data, kind').eq('id', row.campaign_id).maybeSingle();
  if (!camp || camp.kind !== 'spec') { console.log(`${row.id}  skipped — campaign ${row.campaign_id} is not a brief`); continue; }

  // the frames back out of the shared cache, under the names the copy expects
  const work = path.join(ROOT, 'output/_backfill', row.id);
  fs.mkdirSync(work, { recursive: true });
  const local = [];
  let missing = 0;
  for (const f of frames) {
    const name = path.basename(f);
    const to = path.join(work, name);
    if (!fs.existsSync(to)) {
      const { data } = await sb.storage.from('cache').download(name);
      if (!data) { missing++; continue; }
      fs.writeFileSync(to, Buffer.from(await data.arrayBuffer()));
    }
    local.push(to);
  }
  if (missing) { console.log(`${row.id}  skipped — ${missing} frame(s) no longer in the cache`); continue; }

  const spec = { ...camp.data, id: row.campaign_id, content: { ...(camp.data.content ?? {}), style: row.style } };
  const renderable = toRenderable(spec, content, { appScreen: spec.assets?.app_screen, appIcon: spec.assets?.app_icon, photos: local });
  renderable.assets = { ...renderable.assets, look: s?.art?.look, photos: { dir: '.', credit: 'gpt-image-2' } };
  const r = await render({ spec: renderable, root: ROOT, styleId: row.style, outDir: work });

  // does the slide we just drew match the one the customer has?
  let same = 0, differs = 0;
  for (let i = 0; i < r.files.length; i++) {
    const key = row.files_json?.[i];
    if (!key) { differs++; continue; }
    const { data } = await sb.storage.from('sets').download(key);
    if (!data) { differs++; continue; }
    const theirs = Buffer.from(await data.arrayBuffer());
    if (sha(theirs) === sha(fs.readFileSync(r.files[i]))) same++; else differs++;
  }
  const verdict = differs === 0 ? 'identical' : `${differs} of ${r.files.length} differ`;
  console.log(`${row.id}  ${row.campaign_id}/${row.style}  ${r.files.length} slides  ${verdict}${WRITE ? '' : '  (dry run)'}`);
  if (!WRITE) continue;

  const prefix = `${row.org_id}/${row.id}`;
  for (const name of fs.readdirSync(work)) {
    const isSlide = /^slide-\d+\.png$/.test(name);
    const isPart = /^slide-\d+(\.art-\d+)?\.(svg|jpe?g|png|webp)$/.test(name) && !isSlide;
    // a slide is only replaced when it actually changed, so an unchanged set
    // keeps the exact bytes its owner has already downloaded
    if (!isPart && !(isSlide && differs > 0)) continue;
    const up = await sb.storage.from('sets').upload(`${prefix}/${name}`, fs.readFileSync(path.join(work, name)), {
      contentType: TYPES[path.extname(name)], upsert: true,
    });
    if (up.error) { console.log(`  ! ${name}: ${up.error.message}`); }
  }
  // the baseline, and any edits measured from an older one are no longer valid
  const { error: e2 } = await sb.from('sets').update({ layout_json: r.layout, edits_json: null, edited_at: null }).eq('id', row.id);
  if (e2) console.log(`  ! layout not recorded: ${e2.message}`);
  else console.log(`  kept ${r.layout.reduce((n, l) => n + l.blocks.length, 0)} blocks across ${r.layout.length} slides`);
}
