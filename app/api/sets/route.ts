import { after } from "next/server";
import { viewerForRequest } from "@/lib/auth";
import { allow } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";
import { listSets, reserveSet, ReserveError, type Lane } from "@/lib/sets";
import { hasServiceRole } from "@/lib/supabase/admin";
import { engineAvailable } from "@/lib/engine";
import { isDemo, demoWorkspaceSets, DEMO_REASON, DEMO_SLIDES, demoSlidesFor, demoGenerationOn } from "@/lib/demo";
import { clientIp, DEMO_LIMITS } from "@/lib/ratelimit";
import { readInstructions, readOrgAssets } from "@/lib/uploads";

export const maxDuration = 300;

// what a customer may ask for. "editorial", "mascot" and "clinical" were
// retired (owner, 2026-09-19); their renderers stay in the engine so older
// sets still open.
const STYLES = new Set(["native", "feed", "bedrock", "poster", "pastel", "document", "rail"]);

/** The org's sets, newest first. */
export async function GET() {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  const sb = await createClient();
  if (isDemo(viewer)) {
    // the shipped examples, then whatever this visitor made in the demo
    const mine = demoGenerationOn() ? await listSets(sb, viewer.org.id, { userId: viewer.user.id }) : [];
    return Response.json({ sets: [...mine, ...demoWorkspaceSets(viewer.org.id)] });
  }
  return Response.json({ sets: await listSets(sb, viewer.org.id) });
}

/**
 * Create a set. The database reserves the slides (or refuses) in one call;
 * the worker then takes the first step in the background of this request
 * and the client polls GET /api/sets/:id.
 *
 * There is no priority tier (0030). Every customer's set goes through the
 * providers' batch APIs (0031) — the same words and frames at half the price,
 * back within the day and usually much sooner; the pg_cron poller collects
 * them every five minutes. Only the demo renders on the realtime path, so a
 * visitor sees a result in two minutes. A `lane` in the body is ignored rather
 * than refused, so older clients keep working.
 *
 * Body: { campaign, ask, style?, slides: number | {min,max}, hd? }
 */
export async function POST(req: Request) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  const demo = isDemo(viewer);
  if (demo && !demoGenerationOn()) return Response.json({ error: DEMO_REASON, code: "FC_DEMO" }, { status: 402 });
  if (demo) {
    // a visitor makes up to 3 short sets a day; the whole demo up to 40 (and the org's spend cap after that)
    const { perVisitor, perDay, windowSeconds } = DEMO_LIMITS;
    if (!(await allow(`demo:sets:ip:${clientIp(req)}`, perVisitor, windowSeconds)) || !(await allow("demo:sets:all", perDay, windowSeconds))) {
      return Response.json({ error: "The demo makes up to three carousels a day per visitor. Pick a plan to make as many as you like.", code: "FC_DEMO_LIMIT" }, { status: 429 });
    }
  }
  if (!(await allow(`sets:user:${viewer.user.id}`, 30, 600))) {
    return Response.json({ error: "Too many requests in a short time. Wait a few minutes and try again.", code: "FC_RATE" }, { status: 429 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body", code: "FC_BAD_BODY" }, { status: 400 });
  }
  const campaign = String(body?.campaign ?? "").trim();
  const ask = String(body?.ask ?? "").trim();
  const style = String(body?.style ?? "native");
  const sl = body?.slides;
  let min = typeof sl === "number" ? sl : Number(sl?.min ?? 7);
  let max = typeof sl === "number" ? sl : Number(sl?.max ?? min);
  // customers: the batch lane, half the price (0031); the demo: realtime,
  // because it is the shop window and capped at a handful of carousels
  const lane: Lane = demo ? "priority" : "batch";
  // the demo: the brief's own shortest set, never HD, whatever the form sent.
  // The count comes from the campaign rather than a constant because a set
  // under the brief's minimum cannot pass compliance (P-22); the brief is read
  // below, once the campaign id is known.
  let hd = !!body?.hd;
  if (demo) hd = false;

  if (!campaign) return Response.json({ error: "pick a campaign", code: "FC_NO_CAMPAIGN_PICKED" }, { status: 400 });
  if (ask.length < 3) return Response.json({ error: "say what the set is about", code: "FC_NO_ASK" }, { status: 400 });
  if (ask.length > 400) return Response.json({ error: "keep the ask under 400 characters", code: "FC_ASK_LONG" }, { status: 400 });
  if (!STYLES.has(style)) return Response.json({ error: `unknown style "${style}"`, code: "FC_BAD_STYLE" }, { status: 400 });
  if (!Number.isInteger(min) || !Number.isInteger(max) || (!demo && min < 5) || max > 10 || min > max) {
    return Response.json({ error: "slides must be a count or range between 5 and 10", code: "FC_BAD_RANGE" }, { status: 400 });
  }

  const sb = await createClient();
  // what the workspace uploaded, plus anything this set asked for on top
  const instructions = readInstructions(body?.instructions, readOrgAssets((viewer.org as { assets?: unknown }).assets));
  if (demo) {
    // the brief decides: a demo set is exactly its minimum, so it is the
    // shortest set that can legally ship for that campaign
    const { data: camp } = await sb.from("campaigns").select("data").eq("id", campaign).maybeSingle();
    min = max = demoSlidesFor((camp?.data as { requirements?: { min_slides?: number } } | null)?.requirements?.min_slides);
  }
  let id: string;
  try {
    id = await reserveSet(sb, { orgId: viewer.org.id, campaignId: campaign, ask, style, min, max, lane, hd, instructions });
  } catch (e: any) {
    if (e instanceof ReserveError) {
      const status = e.code === "FC_QUOTA" || e.code === "FC_SPEND_CAP" || e.code === "FC_NO_PLAN" || e.code === "FC_NO_HD" || e.code === "FC_DEMO_BUDGET" ? 402 : e.code === "FC_NOT_MEMBER" ? 403 : 400;
      return Response.json({ error: e.message, code: e.code, detail: e.detail }, { status });
    }
    return Response.json({ error: e?.message ?? "could not create the set", code: "FC_UNKNOWN" }, { status: 500 });
  }

  // The first step runs now, in the background of this request: a batch set
  // is submitted to the providers at once rather than waiting for the poller,
  // a demo set renders to the end. The response returns at once with the id
  // to poll. Without the engine or the service role on this host the row
  // still exists and the poller picks it up.
  const canRunHere = engineAvailable() && hasServiceRole();
  if (canRunHere) {
    after(async () => {
      const { runWorker } = await import("@/lib/worker");
      await runWorker({ ids: [id] });
    });
  }
  return Response.json({ id, slides: max, started: canRunHere, queued: lane === "batch" }, { status: 201 });
}
