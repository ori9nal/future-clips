import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelSet, getSet, signedSlides, stageLabel } from "@/lib/sets";
import { adminClient, hasServiceRole } from "@/lib/supabase/admin";
import { isDemo, demoWorkspaceSet, DEMO_REASON } from "@/lib/demo";

/**
 * One set, with signed slide URLs once it is done. RLS scopes the row to the
 * member's org, and the storage policy scopes the signed URLs the same way,
 * so there is nothing to check here beyond "signed in".
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  const { id } = await ctx.params;
  if (isDemo(viewer) && id.startsWith("demo-")) {
    const d = demoWorkspaceSet(viewer.org.id, id);
    if (!d) return Response.json({ error: "not found", code: "FC_NOT_FOUND" }, { status: 404 });
    const { urls, ...set } = d;
    return Response.json({ set, label: stageLabel(set), slides: urls });
  }
  const sb = await createClient();
  const set = await getSet(sb, id);
  if (!set) return Response.json({ error: "not found", code: "FC_NOT_FOUND" }, { status: 404 });
  return Response.json({ set, label: stageLabel(set), slides: await signedSlides(sb, set) });
}

/**
 * Cancel a set that has not started. The member's own client can only flag
 * the row (RLS); if this host holds the service role the slides are released
 * right here instead of on the poller's next tick — on Hobby that tick is
 * daily, and a cancelled set should not hold its slides for a day.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  const { id } = await ctx.params;
  if (isDemo(viewer) && id.startsWith("demo-")) return Response.json({ cancelled: false, error: DEMO_REASON }, { status: 409 });
  const sb = await createClient();
  const ok = await cancelSet(sb, id);
  if (!ok) return Response.json({ cancelled: false }, { status: 409 });
  let released = false;
  if (hasServiceRole()) {
    const admin = adminClient();
    const { data: row } = await admin.from("sets").select("status, state_json").eq("id", id).maybeSingle();
    const untouched = row?.status === "queued" && (row.state_json == null || row.state_json.stage === "copy:submit");
    if (untouched) {
      const { error } = await admin.rpc("fc_release_set", { p_set: id, p_error: "cancelled before it started", p_cost: 0 });
      released = !error;
    }
  }
  return Response.json({ cancelled: true, released });
}
