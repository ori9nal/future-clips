import "server-only";

/**
 * The worker: advances open sets through engine/lanes.mjs, one tick at a
 * time, and settles the ledger when they finish.
 *
 * Runs as the service role — it is the only thing that writes set state,
 * uploads slides, or calls fc_commit_set / fc_release_set. It is invoked by
 * the cron poller (batch sets waiting on a provider batch), and right after
 * a priority set is created (via `after()`, so the request returns at once).
 *
 * Every step is idempotent from the state saved on the row: a tick that dies
 * mid-way is picked up by the next one. A row is locked for the duration of
 * a tick by `started_at`/`locked_until` in the state itself; a lock older
 * than the function ceiling is considered dead.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/supabase/admin";
import { engineAvailable, workDirs } from "@/lib/engine";
import { SET_COLS, type SetRow } from "@/lib/sets";

const ROOT = process.cwd();
const LOCK_MS = 6 * 60 * 1000; // a tick cannot outlive the 300 s function ceiling

async function engine() {
  const url = (f: string) => pathToFileURL(path.join(ROOT, "engine", f)).href;
  const lanes: any = await import(/* webpackIgnore: true */ url("lanes.mjs"));
  const image: any = await import(/* webpackIgnore: true */ url("providers/image.mjs"));
  return { lanes, image };
}

/** Storage-backed mirror of the frame cache (bucket `cache`, private). */
function cacheStore(sb: SupabaseClient) {
  return {
    async pull(id: string) {
      const { data } = await sb.storage.from("cache").download(`img-${id}.png`);
      return data ? Buffer.from(await data.arrayBuffer()) : null;
    },
    async push(id: string, bytes: Buffer) {
      await sb.storage.from("cache").upload(`img-${id}.png`, bytes, { contentType: "image/png", upsert: true });
    },
  };
}

type Tick = { id: string; before: string; after: string; ok: boolean; note?: string };

/** Open sets, oldest first, whose lock is free. */
async function openSets(sb: SupabaseClient, ids?: string[]): Promise<SetRow[]> {
  let q = sb.from("sets").select(`${SET_COLS}, state_json`).in("status", ["queued", "rendering"]).order("created_at", { ascending: true }).limit(20);
  if (ids?.length) q = q.in("id", ids);
  const { data, error } = await q;
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as any[]).filter((r) => {
    const lock = r.state_json?.lock ?? 0;
    return lock < now - LOCK_MS || lock === 0;
  });
}

/**
 * Advance one set as far as it can go in this tick: a priority set runs to
 * the end; a batch set runs until it is waiting on a provider batch.
 */
export async function tickSet(sb: SupabaseClient, row: SetRow & { state_json: any }): Promise<Tick> {
  const { lanes, image } = await engine();
  const { cacheDir, setsDir } = workDirs();
  image.useCacheStore(cacheStore(sb));

  const { data: camp } = await sb.from("campaigns").select("id, data, kind, status").eq("id", row.campaign_id).maybeSingle();
  if (!camp || camp.kind !== "spec") {
    await sb.rpc("fc_release_set", { p_set: row.id, p_error: "campaign is not a brief the engine can render", p_cost: 0 });
    return { id: row.id, before: row.stage ?? "", after: "failed", ok: false, note: "no spec" };
  }
  const spec = { ...(camp.data as any), id: camp.id };

  if (row.cancel_requested && (row.state_json == null || row.state_json.stage === "copy:submit")) {
    await sb.rpc("fc_release_set", { p_set: row.id, p_error: "cancelled before it started", p_cost: 0 });
    return { id: row.id, before: row.stage ?? "", after: "failed", ok: true, note: "cancelled" };
  }

  const s = row.state_json && row.state_json.stage
    ? row.state_json
    : lanes.newState({
        id: row.id, spec, instruction: row.ask,
        slides: row.slides_min === row.slides_max ? row.slides_min : { min: row.slides_min, max: row.slides_max },
        styleId: row.style, lane: row.lane, quality: row.quality, seed: `${row.campaign_id}|${row.ask}|${row.id}`,
        look: null, mode: null,
      });
  const before = s.stage;

  // take the lock
  s.lock = Date.now();
  await sb.from("sets").update({ state_json: s, status: "rendering", stage: s.stage, started_at: row.started_at ?? new Date().toISOString() }).eq("id", row.id);

  const outDir = path.join(setsDir, row.org_id, row.id);
  const ctx = { root: ROOT, spec, cacheDir, outDir, concurrency: 4 };
  const save = async () => {
    await sb.from("sets").update({ state_json: s, stage: s.stage, slides: s.copy?.count ?? null }).eq("id", row.id);
  };

  try {
    // batch: step until waiting on a provider; priority: step until terminal
    for (let guard = 0; guard < 12 && !lanes.isTerminal(s); guard++) {
      const stageBefore = s.stage;
      await lanes.step(s, ctx);
      await save();
      if (lanes.isWaiting(s) && s.stage === stageBefore) break; // still waiting on the same batch
      if (lanes.isWaiting(s) && row.lane === "batch") break;   // just submitted; come back next tick
    }
  } catch (e) {
    // the worker's fault (a database or storage error), not the set's:
    // keep the progress made, drop the lock, let the next tick retry. The set
    // has started, so it stays "rendering": "queued" means nothing has been
    // spent yet and a member may still cancel it.
    s.lock = 0;
    await sb.from("sets").update({ state_json: s, status: "rendering", stage: s.stage }).eq("id", row.id);
    throw e;
  }
  s.lock = 0;

  if (s.stage === "done") {
    const prefix = `${row.org_id}/${row.id}`;
    const files: string[] = [];
    for (const f of s.files as string[]) {
      const name = path.basename(f);
      const { error } = await sb.storage.from("sets").upload(`${prefix}/${name}`, fs.readFileSync(f), { contentType: "image/png", upsert: true });
      if (error) throw new Error(`upload ${name}: ${error.message}`);
      files.push(`${prefix}/${name}`);
    }
    const post = JSON.parse(fs.readFileSync(path.join(outDir, "post.json"), "utf8"));
    await sb.storage.from("sets").upload(`${prefix}/post.json`, Buffer.from(JSON.stringify(post)), { contentType: "application/json", upsert: true });
    const { error } = await sb.rpc("fc_commit_set", {
      p_set: row.id, p_made: files.length, p_cost: +Number(s.usd).toFixed(4),
      p_caption: s.copy.content.caption, p_files: files, p_content: s.copy.content, p_compliance: { ...(s.copy.verdict ?? {}), clean: s.clean ?? post.clean ?? null },
      p_cost_json: { copy: s.copy.usd, art: s.art.usd, total: s.usd, lane: s.lane, log: s.log }, p_storage_prefix: prefix,
    });
    if (error) throw error;
    await sb.from("sets").update({ state_json: { ...s, lock: 0, files: undefined } }).eq("id", row.id);
    return { id: row.id, before, after: "done", ok: true, note: `${files.length} slides $${Number(s.usd).toFixed(4)}` };
  }
  if (s.stage === "failed") {
    await sb.rpc("fc_release_set", { p_set: row.id, p_error: String(s.error).slice(0, 500), p_cost: +Number(s.usd).toFixed(4) });
    await sb.from("sets").update({ state_json: s }).eq("id", row.id);
    return { id: row.id, before, after: "failed", ok: false, note: s.error };
  }
  // waiting on a provider batch: still "rendering" (money is committed, cancel is closed); the lock is free
  await sb.from("sets").update({ state_json: s, status: "rendering", stage: s.stage }).eq("id", row.id);
  return { id: row.id, before, after: s.stage, ok: true };
}

/** One poller tick: every open, unlocked set (or just `ids`). */
export async function runWorker({ ids, budgetMs = 240_000 }: { ids?: string[]; budgetMs?: number } = {}): Promise<{ ticks: Tick[]; skipped: string | null }> {
  if (!engineAvailable()) return { ticks: [], skipped: "engine not on this host" };
  const sb = adminClient();
  const rows = await openSets(sb, ids);
  const ticks: Tick[] = [];
  const t0 = Date.now();
  for (const row of rows) {
    if (Date.now() - t0 > budgetMs) break;
    try {
      ticks.push(await tickSet(sb, row as any));
    } catch (e: any) {
      ticks.push({ id: row.id, before: row.stage ?? "", after: row.stage ?? "", ok: false, note: e?.message ?? String(e) });
    }
  }
  return { ticks, skipped: null };
}
