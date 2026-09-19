import { notFound } from "next/navigation";
import type { Account } from "@/lib/account";
import { demoAccount, demoPartners, demoSets, demoWorkspaceAccount, demoWorkspaceSets, demoWorkspaceSpecs, DEMO_SLIDES } from "@/lib/demo";
import Dashboard from "../app/Dashboard";
import PartnerDashboard from "../app/PartnerDashboard";

export const dynamic = "force-dynamic";

/**
 * Design preview — the real dashboard components on fixture data, with no
 * session and no database. For reviewing the visual system in both themes
 * when sign-in is unavailable (Supabase's built-in mailer is rate-limited).
 *
 * Development only: 404 in production, and only when FC_DEMO_PREVIEW=1.
 *   /design-preview?view=clipper&plan=solo|grind|agency|free
 *   /design-preview?view=partner
 *   /design-preview?view=demo          the demo workspace (0013) on the shipped fixtures
 */
const SPECS = [
  { id: "fuel-prep", brand: "FUEL", product: "high-protein meal prep", niche: "nutrition", requirements: { min_slides: 5, max_slides: 8 }, assets: { palette: ["#0B0B0C", "#FF7A1A", "#F2F0EB"] }, content: { style: "native" }, guidance: { angles: ["5 meals I prep every Sunday, ranked by speed", "the nights I don't cook", "what a week of lunches costs me"] } },
  { id: "apex-strength", brand: "APEX", product: "strength tracking app", niche: "fitness", requirements: { min_slides: 5, max_slides: 10 }, assets: { palette: ["#0B0B0C", "#FF5A1F", "#F2F0EB"] }, content: { style: "feed" } },
  { id: "tradelens-app-reachify", brand: "TradeLens", product: "chart reader", niche: "trading", requirements: { min_slides: 5, max_slides: 10 }, assets: { palette: ["#0B0B0C", "#1F5EFF", "#F2F0EB"] }, content: { style: "feed" } },
  { id: "lumen-barrier", brand: "LUMEN", product: "barrier serum", niche: "skincare", requirements: { min_slides: 5, max_slides: 10 }, assets: { palette: ["#0B0B0C", "#FF4FA3", "#F2F0EB"] }, content: { style: "pastel" } },
  { id: "ledger-money", brand: "LEDGER", product: "spend tracker", niche: "personal finance", requirements: { min_slides: 5, max_slides: 8 }, assets: { palette: ["#0B0B0C", "#34C36B", "#F2F0EB"] }, content: { style: "native" } },
  { id: "northbound-trail", brand: "NORTHBOUND", product: "field guides", niche: "travel", requirements: { min_slides: 6, max_slides: 10 }, assets: { palette: ["#0B0B0C", "#E0B84A", "#F2F0EB"] }, content: { style: "rail" } },
];

export default async function DesignPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === "production" || process.env.FC_DEMO_PREVIEW !== "1") notFound();
  const q = await searchParams;
  const orgId = "00000000-0000-0000-0000-000000000000";
  const partners = demoPartners("FCDEMO42");
  if (q.view === "demo") {
    // what an invited prospect sees in the demo workspace (0013)
    return (
      <Dashboard
        viewer={{ email: "you@example.com", orgName: "Demo workspace", plan: "solo", billing: "none", checkout: false, isPlatformOwner: false, engine: true, demoSlides: DEMO_SLIDES }}
        specs={demoWorkspaceSpecs()}
        account={demoWorkspaceAccount()}
        sets={demoWorkspaceSets("0d3e0000-0000-4000-8000-000000000001")}
        partners={null}
      />
    );
  }
  if (q.view === "partner") {
    return <PartnerDashboard viewer={{ email: "agency@example.com", orgName: "Northline Agency", isPlatformOwner: false }} partners={partners} payout={null} />;
  }
  const base: Account = {
    plan: { id: "grind", price_usd_month: 32, slides_per_month: 500, priority_slides_per_month: 50, hd_per_slide_usd: 0, seats: 1, can_pin_style: true, can_lock_brand: false, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
    usage: { period_start: "2026-09-01", slides_used: 24, priority_slides_used: 8, hd_slides_used: 0, extra_slides_purchased: 0, extra_priority_slides_purchased: 0, extra_hd_slides_purchased: 0 },
    periodEnd: null, left: { batch: 476, priority: 42 }, cap: { batch: 500, priority: 50 }, balance: 0, packs: [],
  };
  const plan = q.plan && ["free", "solo", "grind", "agency"].includes(q.plan) ? q.plan : "grind";
  const account = demoAccount(base, plan);
  const sets = demoSets(process.cwd(), orgId);
  return (
    <Dashboard
      viewer={{ email: "you@example.com", orgName: "mira.clips", plan, billing: "none", checkout: false, isPlatformOwner: true, engine: true }}
      specs={SPECS}
      account={account}
      sets={sets}
      partners={partners}
    />
  );
}
