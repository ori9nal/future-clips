import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { engineAvailable } from "@/lib/engine";
import { listCampaigns, listSpecs } from "@/lib/db/campaigns";
import AdminView, { type AdminCampaign, type AdminSession, type AdminSpec, type DemoActivity, type Fund } from "./AdminView";
import { DEMO_LIMITS } from "@/lib/ratelimit";
import { UNLOCK_HOURS, describeAgent } from "@/lib/adminGate";

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

  // the admin sessions open right now, newest first
  const { data: rows } = await sb.from("admin_unlocks")
    .select("id, agent, ip, created_at, expires_at")
    .is("ended_at", null).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  const sessions: AdminSession[] = (rows ?? []).map((u) => ({ ...u, agent: describeAgent(u.agent) }));

  // what the demo has been doing. Every visitor shares one workspace, so this
  // is the whole picture: what strangers made, what it cost, what is left.
  let demo: DemoActivity | null = null;
  {
    const { data: org } = await sb.from("orgs").select("id, spend_cap_usd").eq("is_demo", true).maybeSingle();
    if (org) {
      const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
      const [{ data: recent }, { count }, { data: use }] = await Promise.all([
        sb.from("sets").select("id, campaign_id, ask, status, slides, cost_usd, created_at")
          .eq("org_id", org.id).order("created_at", { ascending: false }).limit(8),
        sb.from("sets").select("id", { count: "exact", head: true }).eq("org_id", org.id).gt("created_at", dayAgo),
        sb.from("usage").select("cogs_usd").eq("org_id", org.id).order("period_start", { ascending: false }).limit(1).maybeSingle(),
      ]);
      demo = {
        madeToday: count ?? 0,
        perDay: DEMO_LIMITS.perDay,
        perVisitor: DEMO_LIMITS.perVisitor,
        spentThisMonth: Number(use?.cogs_usd ?? 0),
        budget: Number(org.spend_cap_usd ?? 0),
        recent: (recent ?? []).map((r) => ({
          id: r.id, campaign: r.campaign_id, ask: r.ask, status: r.status,
          slides: r.slides, cost: r.cost_usd === null ? null : Number(r.cost_usd), at: r.created_at,
        })),
      };
    }
  }

  return (
    <AdminView
      viewer={viewer}
      specs={specs as unknown as AdminSpec[]}
      campaigns={campaigns as unknown as AdminCampaign[]}
      fund={fund}
      engineOn={engineAvailable()}
      sessions={sessions}
      demo={demo}
      unlockHours={UNLOCK_HOURS}
    />
  );
}
