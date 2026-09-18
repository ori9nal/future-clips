import { after } from "next/server";
import { viewerForRequest } from "@/lib/auth";
import { allow } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";
import { listSets, reserveSet, ReserveError, type Lane } from "@/lib/sets";
import { hasServiceRole } from "@/lib/supabase/admin";
import { engineAvailable } from "@/lib/engine";
import { isDemo, demoWorkspaceSets, DEMO_REASON } from "@/lib/demo";

export const maxDuration = 300;

const LANES: Lane[] = ["batch", "priority"];
const STYLES = new Set(["native", "feed", "bedrock", "mascot", "clinical", "poster", "editorial", "pastel", "document", "rail"]);

/** The org's sets, newest first. */
export async function GET() {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  if (isDemo(viewer)) return Response.json({ sets: demoWorkspaceSets(viewer.org.id) });
  const sb = await createClient();
  return Response.json({ sets: await listSets(sb, viewer.org.id) });
}

/**
 * Create a set. The database reserves the slides (or refuses) in one call;
 * a priority set then starts rendering in the background of this request
 * and the client polls GET /api/sets/:id. A batch set waits for the poller.
 *
 * Body: { campaign, ask, style?, slides: number | {min,max}, lane, hd? }
 */
export async function POST(req: Request) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  if (isDemo(viewer)) return Response.json({ error: DEMO_REASON, code: "FC_DEMO" }, { status: 402 });
  if (!(await allow(`sets:user:${viewer.user.id}`, 30, 600))) {
    return Response.json({ error: "Too many requests in a short time. Wait a few minutes and try again." }, { status: 429 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const campaign = String(body?.campaign ?? "").trim();
  const ask = String(body?.ask ?? "").trim();
  const style = String(body?.style ?? "native");
  const lane = String(body?.lane ?? "batch") as Lane;
  const hd = !!body?.hd;
  const sl = body?.slides;
  const min = typeof sl === "number" ? sl : Number(sl?.min ?? 7);
  const max = typeof sl === "number" ? sl : Number(sl?.max ?? min);

  if (!campaign) return Response.json({ error: "pick a campaign" }, { status: 400 });
  if (ask.length < 3) return Response.json({ error: "say what the set is about" }, { status: 400 });
  if (ask.length > 400) return Response.json({ error: "keep the ask under 400 characters" }, { status: 400 });
  if (!STYLES.has(style)) return Response.json({ error: `unknown style "${style}"` }, { status: 400 });
  if (!LANES.includes(lane)) return Response.json({ error: "lane must be batch or priority" }, { status: 400 });
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 5 || max > 10 || min > max) {
    return Response.json({ error: "slides must be a count or range between 5 and 10" }, { status: 400 });
  }

  const sb = await createClient();
  let id: string;
  try {
    id = await reserveSet(sb, { orgId: viewer.org.id, campaignId: campaign, ask, style, min, max, lane, hd });
  } catch (e: any) {
    if (e instanceof ReserveError) {
      const status = e.code === "FC_QUOTA" || e.code === "FC_SPEND_CAP" || e.code === "FC_NO_PLAN" || e.code === "FC_NO_HD" ? 402 : e.code === "FC_NOT_MEMBER" ? 403 : 400;
      return Response.json({ error: e.message, code: e.code, detail: e.detail }, { status });
    }
    return Response.json({ error: e?.message ?? "could not create the set" }, { status: 500 });
  }

  // A priority set is rendered now, in the background of this request; the
  // response returns at once with the id to poll. Without the engine or the
  // service role on this host the row still exists and the poller (or the
  // next host that has them) picks it up.
  const canRunHere = engineAvailable() && hasServiceRole();
  if (lane === "priority" && canRunHere) {
    after(async () => {
      const { runWorker } = await import("@/lib/worker");
      await runWorker({ ids: [id] });
    });
  }
  return Response.json({ id, lane, started: lane === "priority" && canRunHere }, { status: 201 });
}
