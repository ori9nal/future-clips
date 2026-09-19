import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { engineAvailable } from "@/lib/engine";
import { listCampaigns, listSpecs } from "@/lib/db/campaigns";
import AdminView, { type AdminCampaign, type AdminSpec, type Fund } from "./AdminView";

export const dynamic = "force-dynamic";

/** The provider fund (migration 0012): what came in, what is earmarked for Anthropic and OpenAI, what the engine consumed. */
async function fundSummary(sb: Awaited<ReturnType<typeof createClient>>): Promise<Fund | null> {
  try {
    const { data, error } = await sb.rpc("fc_fund_summary");
    if (error || !data) return null;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row) return null;
    const n = (k: string) => Number(row[k] ?? 0);
    return { gross_usd: n("gross_usd"), reserve_usd: n("reserve_usd"), spent_usd: n("spent_usd"), balance_usd: n("balance_usd"), sales: n("sales"), share: n("share"), since: (row.since as string | null) ?? null };
  } catch {
    return null;
  }
}

/** Platform owners only — requirePlatformOwner() sends anyone else to /app. */
export default async function AdminHome() {
  const viewer = await requirePlatformOwner();
  const sb = await createClient();
  const [campaigns, specs, fund] = await Promise.all([listCampaigns(sb), listSpecs(sb), fundSummary(sb)]);
  return (
    <AdminView
      viewer={viewer}
      specs={specs as unknown as AdminSpec[]}
      campaigns={campaigns as unknown as AdminCampaign[]}
      fund={fund}
      engineOn={engineAvailable()}
    />
  );
}
