import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/account";

/** Plan and this period's counters for the signed-in member (refreshed after every set). */
export async function GET() {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  const sb = await createClient();
  const account = await getAccount(sb, viewer);
  return Response.json({ account, org: { id: viewer.org.id, name: viewer.org.name, plan: viewer.org.plan } });
}
