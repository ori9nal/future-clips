import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { engineAvailable } from "@/lib/engine";
import { listCampaigns, listSpecs } from "@/lib/db/campaigns";
import AdminView, { type AdminCampaign, type AdminDeviceRow, type AdminSpec, type Fund } from "./AdminView";
import { deviceGateOn, deviceToken, describeAgent, hashToken } from "@/lib/adminDevice";

export const dynamic = "force-dynamic";

/** The provider fund (migration 0012): what came in, what is earmarked for Anthropic and OpenAI, what the engine consumed. */
async function fundSummary(sb: Awaited<ReturnType<typeof createClient>>): Promise<Fund | null> {
  try {
    const { data, error } = await sb.rpc("fc_fund_summary");
    if (error || !data) return null;
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
    if (!row) return null;
    const n = (k: string) => Number(row[k] ?? 0);
    return {
      gross_usd: n("gross_usd"), reserve_usd: n("reserve_usd"), spent_usd: n("spent_usd"), balance_usd: n("balance_usd"),
      sales: n("sales"), share: n("share"), since: (row.since as string | null) ?? null,
      anthropic_usd: n("anthropic_usd"), openai_usd: n("openai_usd"), unsplit_usd: n("unsplit_usd"),
      anthropic_day: n("anthropic_day"), openai_day: n("openai_day"),
      anthropic_float: n("anthropic_float"), openai_float: n("openai_float"), float_days: n("float_days") || 30,
    };
  } catch {
    return null;
  }
}

/** Platform owners only — requirePlatformOwner() sends anyone else to /app. */
export default async function AdminHome() {
  const viewer = await requirePlatformOwner();
  const sb = await createClient();
  const [campaigns, specs, fund] = await Promise.all([listCampaigns(sb), listSpecs(sb), fundSummary(sb)]);

  // the devices this owner has trusted, newest first, with the one being used marked
  let devices: AdminDeviceRow[] = [];
  if (deviceGateOn()) {
    const here = await deviceToken();
    const hash = here ? hashToken(here) : null;
    const { data } = await sb.from("admin_devices")
      .select("id, label, agent, created_ip, created_at, last_seen_at, token_sha256")
      .is("revoked_at", null).order("created_at", { ascending: false });
    devices = (data ?? []).map((d) => ({
      id: d.id, label: d.label, agent: describeAgent(d.agent), created_ip: d.created_ip,
      created_at: d.created_at, last_seen_at: d.last_seen_at,
      current: !!hash && d.token_sha256 === hash,
    }));
  }

  return (
    <AdminView
      viewer={viewer}
      specs={specs as unknown as AdminSpec[]}
      campaigns={campaigns as unknown as AdminCampaign[]}
      fund={fund}
      engineOn={engineAvailable()}
      devices={devices}
      gateOn={deviceGateOn()}
    />
  );
}
