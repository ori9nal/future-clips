import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listSpecs } from "@/lib/db/campaigns";
import { getAccount } from "@/lib/account";
import { listSets } from "@/lib/sets";
import { engineAvailable } from "@/lib/engine";
import { hasServiceRole } from "@/lib/supabase/admin";
import { getAgencySummary, listReferred, listCommissions } from "@/lib/referrals";
import { dodoEnabled } from "@/lib/billing/dodo";
import { demo, demoAccount, demoPartners, demoSets } from "@/lib/demo";
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
  const sb = await createClient();
  const [specs, account0, sets0, summary, referred, commissions] = await Promise.all([
    listSpecs(sb, { liveOnly: true }),
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
      }))}
      account={account}
      sets={sets}
      partners={partners}
    />
  );
}
