import "server-only";

/**
 * Demo mode — development only, never in production (the first line makes
 * sure of it). Three overrides for walkthrough videos and screenshots when
 * the database cannot be written to from this machine:
 *
 *   FC_DEMO_PLAN=solo|grind|agency|free   the dashboard shows this plan with the
 *                                         site's allowances (migration 0006 values)
 *   FC_DEMO_PARTNERS=1                    sample referral data on the Refer page
 *   FC_DEMO_PARTNER=1                     the workspace is an affiliate-only partner (0008)
 *   FC_DEMO_SETS=1                        the sets rendered on this machine
 *                                         (output/sets/*-priority) appear as finished
 *                                         sets, served through /api/file
 *
 * The quota gate, auth and every write still go to the real database; only
 * what the dashboard *displays* is substituted.
 */
import fs from "node:fs";
import path from "node:path";
import type { Account } from "@/lib/account";
import type { SetRow } from "@/lib/sets";
import type { AgencySummary, ReferredOrg, Commission } from "@/lib/referrals";

export function demo() {
  if (process.env.NODE_ENV === "production") return null;
  const plan = process.env.FC_DEMO_PLAN;
  const partners = process.env.FC_DEMO_PARTNERS === "1";
  const sets = process.env.FC_DEMO_SETS === "1";
  const partner = process.env.FC_DEMO_PARTNER === "1";   // the affiliate-only workspace (0008)
  if (!plan && !partners && !sets && !partner) return null;
  return { plan: plan && ["free", "solo", "grind", "agency"].includes(plan) ? plan : null, partners, sets, partner };
}

/** The plans as the site sells them (migration 0006). */
const PLANS: Record<string, Partial<Account["plan"]> & { balance?: number }> = {
  free:   { id: "free",   label: "No plan", price_usd_month: 0,  slides_per_month: 0,    priority_slides_per_month: 0,   hd_per_slide_usd: null, seats: 1, balance: 0 },
  solo:   { id: "solo",   label: "Clipper", price_usd_month: 16, slides_per_month: 200,  priority_slides_per_month: 0,   hd_per_slide_usd: null, seats: 1 },
  grind:  { id: "grind",  label: "Pro",     price_usd_month: 32, slides_per_month: 500,  priority_slides_per_month: 50,  hd_per_slide_usd: 0,    seats: 1 },
  agency: { id: "agency", label: "Studio",  price_usd_month: 79, slides_per_month: 1500, priority_slides_per_month: 150, hd_per_slide_usd: 0,    seats: 5 },
};

export function demoAccount(account: Account, plan: string): Account {
  const p = PLANS[plan];
  const used = account.usage;
  const balance = p.balance ?? 0;
  const cap = { batch: p.slides_per_month!, priority: p.priority_slides_per_month! };
  return {
    ...account,
    plan: { ...account.plan, ...p, extra_slide_usd: null, extra_priority_slide_usd: null, own_creator: plan !== "free", can_pin_style: plan !== "free", can_lock_brand: plan === "agency" },
    cap,
    balance,
    left: { batch: Math.max(0, cap.batch - used.slides_used) + balance, priority: Math.max(0, cap.priority - used.priority_slides_used) },
    packs: [{ id: "p100", slides: 100, price_usd: 8 }, { id: "p250", slides: 250, price_usd: 18 }, { id: "p600", slides: 600, price_usd: 40 }],
  };
}

export function demoPartners(code: string): { summary: AgencySummary; referred: ReferredOrg[]; commissions: Commission[] } {
  const ago = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const referred: ReferredOrg[] = [
    { id: "r1", name: "mira.clips", plan: "grind", billing_status: "active", referred_at: ago(3) },
    { id: "r2", name: "dev.edits", plan: "solo", billing_status: "active", referred_at: ago(6) },
    { id: "r3", name: "kai_posts", plan: "solo", billing_status: "active", referred_at: ago(9) },
    { id: "r4", name: "nova.reels", plan: "free", billing_status: "none", referred_at: ago(11) },
    { id: "r5", name: "tomclips", plan: "grind", billing_status: "past_due", referred_at: ago(19) },
    { id: "r6", name: "ayesha.cuts", plan: "solo", billing_status: "active", referred_at: ago(27) },
  ];
  const commissions: Commission[] = [
    { id: 4, agency_org_id: "me", referred_org_id: "r1", period_start: "2026-09-01", revenue_usd: 32, rate: 0.2, commission_usd: 6.4, status: "pending", paid_at: null, note: null, created_at: ago(3) },
    { id: 3, agency_org_id: "me", referred_org_id: "r2", period_start: "2026-09-01", revenue_usd: 16, rate: 0.2, commission_usd: 3.2, status: "pending", paid_at: null, note: null, created_at: ago(6) },
    { id: 2, agency_org_id: "me", referred_org_id: "r3", period_start: "2026-08-01", revenue_usd: 16, rate: 0.2, commission_usd: 3.2, status: "paid", paid_at: ago(8), note: null, created_at: ago(30) },
    { id: 1, agency_org_id: "me", referred_org_id: "r6", period_start: "2026-08-01", revenue_usd: 16, rate: 0.2, commission_usd: 3.2, status: "paid", paid_at: ago(8), note: null, created_at: ago(40) },
  ];
  return {
    summary: { code, referred: referred.length, paying: referred.filter((r) => r.billing_status === "active").length, rate: 0.2, next_tier: { min_referred: 200, rate: 0.25 }, pending_usd: 9.6, paid_usd: 6.4 },
    referred, commissions,
  };
}

/** The sets rendered on this machine through the lane, as finished rows the dashboard can show. */
export function demoSets(root: string, orgId: string): (SetRow & { urls: string[] })[] {
  const dir = path.join(root, "output", "sets");
  if (!fs.existsSync(dir)) return [];
  const out: (SetRow & { urls: string[] })[] = [];
  for (const name of fs.readdirSync(dir).filter((n) => /-(priority|batch)$/.test(n))) {
    const d = path.join(dir, name);
    const postP = path.join(d, "post.json"), contentP = path.join(d, "content.json");
    if (!fs.existsSync(postP)) continue;
    const post = JSON.parse(fs.readFileSync(postP, "utf8"));
    const content = fs.existsSync(contentP) ? JSON.parse(fs.readFileSync(contentP, "utf8")).content : null;
    const slides = fs.readdirSync(d).filter((f) => /^slide-\d+\.png$/.test(f)).sort((a, b) => +a.match(/\d+/)![0] - +b.match(/\d+/)![0]);
    if (!slides.length) continue;
    const m = name.match(/^(.*)-(feed|native|bedrock|mascot|rail|clinical|editorial|document|poster|pastel)-(priority|batch)$/);
    if (!m) continue;
    const st = fs.statSync(postP);
    out.push({
      id: `demo-${name}`, org_id: orgId, campaign_id: m[1], style: m[2], ask: content?.hook?.lines?.join(" ") ?? name,
      slides: slides.length, slides_min: 6, slides_max: 8, reserved_slides: 8, quality: "medium", lane: m[3] as any, hd: false,
      status: "done", stage: "done", caption: post.caption ?? null, cost_usd: post.cost?.total ?? null,
      files_json: slides.map((f) => `${name}/${f}`), content_json: content, compliance_json: post.compliance ?? null, error: null,
      cancel_requested: false, created_at: st.mtime.toISOString(), started_at: st.mtime.toISOString(), finished_at: st.mtime.toISOString(), updated_at: st.mtime.toISOString(),
      urls: slides.map((f) => `/api/file/sets/${name}/${f}`),
    } as any);
  }
  return out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
