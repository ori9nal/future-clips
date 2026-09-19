import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listSpecs, saveSpec } from "@/lib/db/campaigns";
import type { Spec } from "@/lib/specs";
import { isDemo, demoWorkspaceSpecs } from "@/lib/demo";

/** Specs visible to the caller (RLS); saving is platform owners only. */
export async function GET() {
  const viewer = await viewerForRequest();
  if (viewer && isDemo(viewer)) return Response.json({ campaigns: demoWorkspaceSpecs() });
  const sb = await createClient();
  return Response.json({ campaigns: await listSpecs(sb) });
}

export async function POST(req: Request) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required", code: "AUTH" }, { status: 401 });
  if (!viewer.isPlatformOwner) return Response.json({ error: "platform owners only", code: "FC_NOT_OWNER" }, { status: 403 });
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  try {
    const sb = await createClient();
    const saved = await saveSpec(sb, body as Spec);
    return Response.json({ campaign: saved });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "could not save" }, { status: 400 });
  }
}
