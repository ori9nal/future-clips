import { runWorker } from "@/lib/worker";
import { bearerMatches } from "@/lib/secrets";
import { adminClient, hasServiceRole } from "@/lib/supabase/admin";
import { dodoEnabled, syncProductDescriptions } from "@/lib/billing/dodo";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * The poller. Every call advances every open set one tick: batch sets whose
 * provider batch has ended are collected and moved on; a realtime set that
 * lost its host is finished.
 *
 * Two callers, two bearers. Vercel's own cron (daily on Hobby) sends
 * `Authorization: Bearer $CRON_SECRET`. The pg_cron job in the database
 * (0031, every five minutes — customers' sets go through the batch APIs now
 * and somebody has to collect the answers) sends the bearer held in Supabase
 * Vault as `cron_bearer`, which the app reads with the service role. So the
 * poller's key lives in one place and rotating it is one Vault update; no
 * Vercel secret is involved.
 */
async function authorised(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth) return false;
  const secret = process.env.CRON_SECRET;
  if (secret && bearerMatches(auth, secret)) return true;
  if (hasServiceRole()) {
    const { data } = await adminClient().rpc("fc_cron_bearer");
    if (typeof data === "string" && data.length > 0 && bearerMatches(auth, data)) return true;
  }
  return false; // never an unauthenticated poller
}

/**
 * Once a day, the poller also keeps the words at the till honest: the Dodo
 * product descriptions are rewritten from the plans table. Cheap, idempotent,
 * and it means a change to a plan reaches the checkout without anyone
 * remembering to.
 */
async function housekeeping(): Promise<string | null> {
  if (!hasServiceRole() || !dodoEnabled()) return null;
  const sb = adminClient();
  const { data: row } = await sb.from("app_settings").select("value").eq("key", "dodo_descriptions").maybeSingle();
  const last = Date.parse((row?.value as { at?: string } | null)?.at ?? "") || 0;
  if (Date.now() - last < 20 * 3600_000) return null;
  const { data: plans } = await sb.from("plans").select("id, slides_per_month").in("id", ["solo", "grind", "agency"]);
  const r = await syncProductDescriptions(plans ?? []);
  const at = new Date().toISOString();
  await sb.from("app_settings").upsert({ key: "dodo_descriptions", value: { at, updated: r.updated }, updated_at: at }, { onConflict: "key" });
  return `dodo descriptions rewritten: ${r.updated.join(", ") || "none"}`;
}

export async function GET(req: Request) {
  if (!(await authorised(req))) return Response.json({ error: "unauthorised" }, { status: 401 });
  const t0 = Date.now();
  const r = await runWorker({ budgetMs: 240_000 });
  const kept = await housekeeping().catch((e: unknown) => `housekeeping failed: ${e instanceof Error ? e.message : String(e)}`);
  return Response.json({ ...r, housekeeping: kept, ms: Date.now() - t0 });
}

export const POST = GET;
