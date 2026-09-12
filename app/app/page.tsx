import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listSpecs } from "@/lib/db/campaigns";
import { getAccount } from "@/lib/account";
import { listSets } from "@/lib/sets";
import { engineAvailable } from "@/lib/engine";
import { hasServiceRole } from "@/lib/supabase/admin";
import Dashboard from "./Dashboard";
import "../dashboard.css";

export const dynamic = "force-dynamic";

/**
 * The product. Everything the dashboard shows is loaded here as the member
 * (RLS) and handed over; the client refreshes sets and counters from the
 * API as they change.
 */
export default async function AppHome() {
  const viewer = await requireViewer();
  const sb = await createClient();
  const [specs, account, sets] = await Promise.all([
    listSpecs(sb, { liveOnly: true }),
    getAccount(sb, viewer),
    listSets(sb, viewer.org.id),
  ]);
  return (
    <Dashboard
      viewer={{ email: viewer.user.email, orgName: viewer.org.name, plan: viewer.org.plan, isPlatformOwner: viewer.isPlatformOwner, engine: engineAvailable() && hasServiceRole() }}
      specs={specs.map((s) => ({
        id: s.id, brand: s.brand, product: s.product, niche: s.niche,
        requirements: s.requirements, assets: { palette: s.assets?.palette }, content: { style: s.content?.style },
        guidance: (s as any).guidance,
      }))}
      account={account}
      sets={sets}
    />
  );
}
