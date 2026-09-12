import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelSet, getSet, stageLabel } from "@/lib/sets";

/**
 * One set, with signed slide URLs once it is done. RLS scopes the row to the
 * member's org, and the storage policy scopes the signed URLs the same way,
 * so there is nothing to check here beyond "signed in".
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = await createClient();
  const set = await getSet(sb, id);
  if (!set) return Response.json({ error: "not found" }, { status: 404 });
  let slides: string[] = [];
  if (set.status === "done" && set.files_json?.length) {
    const { data } = await sb.storage.from("sets").createSignedUrls(set.files_json, 60 * 60);
    slides = (data ?? []).map((d) => d.signedUrl).filter((u): u is string => !!u);
  }
  return Response.json({ set: { ...set, content_json: undefined }, label: stageLabel(set), slides });
}

/** Cancel a set that has not started; the worker releases the slides on its next tick. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  const { id } = await ctx.params;
  const sb = await createClient();
  const ok = await cancelSet(sb, id);
  return Response.json({ cancelled: ok }, { status: ok ? 200 : 409 });
}
