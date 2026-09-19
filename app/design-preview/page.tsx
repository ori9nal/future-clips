import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Account } from "@/lib/account";
import { demoAccount, demoPartners, demoSets, demoWorkspaceAccount, demoWorkspaceSets, demoWorkspaceSpecs, DEMO_SLIDES, isDemoHost } from "@/lib/demo";
import AdminView from "../admin/AdminView";
import BriefForm from "../admin/briefs/BriefForm";
import { DEMO_BRIEF } from "@/lib/demo";
import "../studio/studio.css";
import "../admin/new/admin.css";
import type { Viewer } from "@/lib/auth";
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
 *   /design-preview?view=admin         the admin surface (AdminView) on fixtures, forms disabled
 *   /design-preview?view=brief         one brief, whole — every field the admin editor takes
 *   /design-preview?view=demo          the demo workspace (0013) on the shipped fixtures
 */
const SPECS = [
  { id: "fuel-prep", brand: "FUEL", product: "high-protein meal prep", niche: "nutrition", requirements: { min_slides: 5, max_slides: 8 }, assets: { palette: ["#0B0B0C", "#FF7A1A", "#F2F0EB"] }, content: { style: "native" }, guidance: { angles: ["5 meals I prep every Sunday, ranked by speed", "the nights I don't cook", "what a week of lunches costs me"] } },
  { id: "apex-strength", brand: "APEX", product: "strength tracking app", niche: "fitness", requirements: { min_slides: 5, max_slides: 10 }, assets: { palette: ["#0B0B0C", "#FF5A1F", "#F2F0EB"] }, content: { style: "feed" } },
  { id: "lumen-barrier", brand: "LUMEN", product: "barrier serum", niche: "skincare", requirements: { min_slides: 5, max_slides: 10 }, assets: { palette: ["#0B0B0C", "#FF4FA3", "#F2F0EB"] }, content: { style: "pastel" } },
  { id: "ledger-money", brand: "LEDGER", product: "spend tracker", niche: "personal finance", requirements: { min_slides: 5, max_slides: 8 }, assets: { palette: ["#0B0B0C", "#34C36B", "#F2F0EB"] }, content: { style: "native" } },
  { id: "northbound-trail", brand: "NORTHBOUND", product: "field guides", niche: "travel", requirements: { min_slides: 6, max_slides: 10 }, assets: { palette: ["#0B0B0C", "#E0B84A", "#F2F0EB"] }, content: { style: "rail" } },
];

export default async function DesignPreview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  // laptops with FC_DEMO_PREVIEW=1, and the hidden demo host in production —
  // the owner's four links (D-048). Fixtures only: no session, no database.
  const host = (await headers()).get("x-forwarded-host") ?? (await headers()).get("host");
  const onDemoHost = isDemoHost(host);
  if (!onDemoHost && (process.env.NODE_ENV === "production" || process.env.FC_DEMO_PREVIEW !== "1")) notFound();
  const q = await searchParams;
  const orgId = "00000000-0000-0000-0000-000000000000";
  const partners = demoPartners("FCDEMO42");
  if (q.view === "admin") {
    // the admin surface on fixtures: the same component the real /admin renders
    const viewer = {
      user: { id: "00000000-0000-0000-0000-0000000000aa", email: "you@thefutureclips.com" },
      memberships: [], role: "owner", isPlatformOwner: true,
      org: { id: "00000000-0000-0000-0000-0000000000ab", name: "Future Clips", plan: "agency", seat_limit: 10, is_platform: true, billing_status: "none", current_period_start: null, current_period_end: null },
    } as unknown as Viewer;
    return (
      <AdminView
        viewer={viewer}
        readOnly
        engineOn
        fund={{
          gross_usd: 1_249.83, reserve_usd: 437.44, spent_usd: 118.62, balance_usd: 318.82, sales: 37, share: 0.35,
          since: new Date(Date.now() - 24 * 86400000).toISOString(),
          anthropic_usd: 41.17, openai_usd: 77.45, unsplit_usd: 0,
          anthropic_day: 1.37, openai_day: 2.58, anthropic_float: 41.1, openai_float: 77.4, float_days: 30,
        }}
        demo={{
          madeToday: 4, perDay: 15, perVisitor: 3, spentThisMonth: 1.48, budget: 15,
          left: 3, allowed: 5, since: new Date(Date.now() - 3 * 3600000).toISOString(),
          recent: [
            { id: "d1", campaign: "apex-strength", ask: "the 3 gym habits that finally stuck for me", status: "done", slides: 5, cost: 0.3482, at: new Date(Date.now() - 42 * 60000).toISOString() },
            { id: "d2", campaign: "northbound-trail", ask: "one thing i wish i packed", status: "done", slides: 6, cost: 0.27, at: new Date(Date.now() - 96 * 60000).toISOString() },
          ],
        }}
        specs={SPECS.map((c) => ({ id: c.id, brand: c.brand, niche: c.niche, status: "live", content: { style: (c as { content?: { style?: string } }).content?.style }, requirements: c.requirements }))}
        campaigns={[
          { id: "meridian-endurance", name: "Meridian Endurance", niche: "fitness", brand: { handle: "@meridian.endurance", colors: { ink: "#171512", accents: { rust: "#A8442A" } } }, rules: { min_slides: 5, max_slides: 10, zero_gen_mode: false }, agency: { code: "MERIDIAN25" } },
          { id: "quiet-mindset", name: "Quiet Hours", niche: "mindset", brand: { handle: "@quiet.hours", colors: { ink: "#15171B", accents: { primary: "#5A6B3C" } } }, rules: { min_slides: 5, max_slides: 8, zero_gen_mode: true }, agency: { code: "QUIET25" } },
          { id: "signal-creator", name: "Signal Studio", niche: "creator", brand: { handle: "@signal.studio", colors: { ink: "#121212", accents: { primary: "#D93A56" } } }, rules: { min_slides: 6, max_slides: 10 }, agency: { code: "SIGNAL25" } },
        ]}
      />
    );
  }
  if (q.view === "brief") {
    // the brief editor on a fixture campaign, so the whole form can be read
    // without a platform-owner session
    return <BriefForm spec={DEMO_BRIEF} readOnly />;
  }
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
    plan: { id: "grind", price_usd_month: 49.99, slides_per_month: 400, priority_slides_per_month: 50, hd_per_slide_usd: 0, seats: 1, can_pin_style: true, can_lock_brand: false, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
    usage: { period_start: "2026-09-01", slides_used: 24, priority_slides_used: 8, hd_slides_used: 0, extra_slides_purchased: 0, extra_priority_slides_purchased: 0, extra_hd_slides_purchased: 0 },
    periodEnd: null, left: { batch: 376, priority: 42 }, cap: { batch: 400, priority: 50 }, balance: 0, packs: [],
    sale: [
      { id: "solo", label: "Clipper", price_usd_month: 19.99, slides_per_month: 200, priority_slides_per_month: 0, hd_per_slide_usd: null, seats: 1, can_pin_style: true, can_lock_brand: false, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
      { id: "grind", label: "Pro", price_usd_month: 49.99, slides_per_month: 400, priority_slides_per_month: 50, hd_per_slide_usd: 0, seats: 1, can_pin_style: true, can_lock_brand: false, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
      { id: "agency", label: "Studio", price_usd_month: 99.99, slides_per_month: 1000, priority_slides_per_month: 100, hd_per_slide_usd: 0, seats: 5, can_pin_style: true, can_lock_brand: true, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
    ],
  };
  const plan = q.plan && ["free", "solo", "grind", "agency"].includes(q.plan) ? q.plan : "grind";
  const account = demoAccount(base, plan);
  const sets = demoSets(process.cwd(), orgId);
  return (
    <Dashboard
      viewer={{ email: "you@example.com", orgName: "mira.clips", plan, billing: "none", checkout: false, isPlatformOwner: true, engine: true }}
      specs={[DEMO_BRIEF as unknown as (typeof SPECS)[number], ...SPECS]}
      account={account}
      sets={sets}
      partners={partners}
    />
  );
}
