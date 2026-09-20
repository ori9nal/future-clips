import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listSpecs } from "@/lib/db/campaigns";
import { getAccount } from "@/lib/account";
import { listSets } from "@/lib/sets";
import { engineAvailable } from "@/lib/engine";
import { hasServiceRole } from "@/lib/supabase/admin";
import { getAgencySummary, listReferred, listCommissions } from "@/lib/referrals";
import { dodoEnabled } from "@/lib/billing/dodo";
import { demo, demoAccount, demoPartners, demoSets, isDemo, demoWorkspaceAccount, demoWorkspaceSets, demoWorkspaceSpecs, demoGenerationOn, demoBudget, DEMO_SLIDES } from "@/lib/demo";
import { headers } from "next/headers";
import { remaining, DEMO_LIMITS } from "@/lib/ratelimit";
import Dashboard from "./Dashboard";
import PartnerDashboard from "./PartnerDashboard";

export const dynamic = "force-dynamic";

/**
 * The product. Everything the dashboard shows is loaded here as the member
 * (RLS) and handed over; the client refreshes sets and counters from the
 * API as they change.
 */
export default async function AppHome() {
  const viewer = await requireViewer();
  // the demo workspace (0013): shipped fixtures, nothing read from the database, nothing generated
  if (isDemo(viewer)) {
    // the examples ship with the app; anything this visitor made in the demo is a real row
    const sbDemo = await createClient();
    const mine = demoGenerationOn() ? await listSets(sbDemo, viewer.org.id, { userId: viewer.user.id }) : [];
    // how many this visitor has left today, read without spending one (R16),
    // and how many the whole demo has left at all (0026). The header shows the
    // smaller of the two, because that is the one that will stop them.
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
    const today = demoGenerationOn() ? await remaining(`demo:sets:ip:${ip}`, DEMO_LIMITS.perVisitor, DEMO_LIMITS.windowSeconds) : null;
    const budget = demoGenerationOn() ? await demoBudget(sbDemo, viewer.org.id) : null;
    const demoLeft = today == null ? null : Math.min(today, budget?.left ?? Infinity);
    return (
      <Dashboard
        viewer={{ email: viewer.user.email, orgName: viewer.org.name, plan: "solo", billing: "none", checkout: false, isPlatformOwner: viewer.isPlatformOwner, engine: true, demoSlides: demoGenerationOn() ? DEMO_SLIDES : undefined, demoLeft: demoLeft ?? undefined, demoPerVisitor: DEMO_LIMITS.perVisitor, demoOver: budget ? budget.left <= 0 : false }}
        specs={demoWorkspaceSpecs()}
        account={demoWorkspaceAccount()}
        sets={[...mine, ...demoWorkspaceSets(viewer.org.id)]}
        partners={null}
      />
    );
  }
  const sb = await createClient();
  const [specs, account0, sets0, summary, referred, commissions] = await Promise.all([
    listSpecs(sb, { liveOnly: true, forOrgs: viewer.memberships.map((m) => m.org.id) }),
    getAccount(sb, viewer),
    listSets(sb, viewer.org.id),
    getAgencySummary(sb, viewer.org.id),
    listReferred(sb, viewer.org.id),
    listCommissions(sb, viewer.org.id),
  ]);
  // development-only demo overrides (lib/demo.ts); a no-op in production
  const d = demo();
  const plan = d?.plan ?? viewer.org.plan;
  const account = d?.plan ? demoAccount(account0, d.plan) : account0;
  const sets = d?.sets ? [...demoSets(process.cwd(), viewer.org.id), ...sets0] : sets0;
  const partners = d?.partners ? demoPartners(viewer.org.referral_code ?? "FCDEMO42") : summary ? { summary, referred, commissions } : null;

  // an affiliate-only partner workspace (0008) gets the partner dashboard, never the product
  if ((viewer.org.is_partner || d?.partner) && partners) {
    const { data: payoutRow } = await sb.from("partner_payouts").select("method, details").eq("org_id", viewer.org.id).maybeSingle();
    return (
      <PartnerDashboard
        viewer={{ email: viewer.user.email, orgName: viewer.org.name, isPlatformOwner: viewer.isPlatformOwner }}
        partners={partners}
        payout={payoutRow ? { method: payoutRow.method, details: payoutRow.details ?? {} } : null}
      />
    );
  }
  return (
    <Dashboard
      viewer={{ email: viewer.user.email, orgName: viewer.org.name, plan, billing: viewer.org.billing_status, checkout: dodoEnabled(), isPlatformOwner: viewer.isPlatformOwner, engine: (engineAvailable() && hasServiceRole()) || !!d?.sets }}
      specs={specs.map((s) => ({
        id: s.id, brand: s.brand, product: s.product, niche: s.niche,
        requirements: s.requirements, assets: { palette: s.assets?.palette }, content: { style: s.content?.style },
        guidance: (s as any).guidance,
        // the three public slides a campaign shows before anyone has a plan
        sample: (s as any).sample ?? null,
        payout: s.payout ? { rate_usd: s.payout.rate_usd, budget_remaining_usd: s.payout.budget_remaining_usd, platforms: s.payout.platforms } : undefined,
        client: (s as any).client, deliverables: (s as any).deliverables, references: (s as any).references,
        rules: s.rules ? { banned_claims: s.rules.banned_claims, banned_topics: s.rules.banned_topics, tone: s.rules.tone, disclosure: s.rules.disclosure } : undefined,
        advertiser: s.advertiser, agency: s.agency,
      }))}
      account={account}
      sets={sets}
      partners={partners}
    />
  );
}
