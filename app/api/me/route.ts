import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAccount } from "@/lib/account";
import { demo, demoAccount, isDemo, demoWorkspaceAccount } from "@/lib/demo";

/** Plan and this period's counters for the signed-in member (refreshed after every set). */
export async function GET() {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  if (isDemo(viewer)) return Response.json({ account: demoWorkspaceAccount(), org: { id: viewer.org.id, name: viewer.org.name, plan: "solo" } });
  const sb = await createClient();
  const real = await getAccount(sb, viewer);
  const d = demo(); // development-only overrides (lib/demo.ts)
  const account = d?.plan ? demoAccount(real, d.plan) : real;
  return Response.json({ account, org: { id: viewer.org.id, name: viewer.org.name, plan: d?.plan ?? viewer.org.plan } });
}
