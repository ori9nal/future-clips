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
import type { Viewer } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Spec } from "@/lib/specs";
import manifest from "./demo-manifest";

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
  // the shipped prices and allowances (D-048): the `plans` row is the truth,
  // this table only mirrors it so a preview shows what a customer would pay
  solo:   { id: "solo",   label: "Clipper", price_usd_month: 19.99, slides_per_month: 200,  priority_slides_per_month: 0,   hd_per_slide_usd: null, seats: 1 },
  grind:  { id: "grind",  label: "Pro",     price_usd_month: 49.99, slides_per_month: 400,  priority_slides_per_month: 0,  hd_per_slide_usd: 0,    seats: 1 },
  agency: { id: "agency", label: "Studio",  price_usd_month: 99.99, slides_per_month: 1000, priority_slides_per_month: 0, hd_per_slide_usd: 0,    seats: 5 },
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

/* ── the demo workspace (migration 0013): production, shipped fixtures ────────
 * A shared org on the Clipper plan that invited prospects join as members.
 * Everything it shows comes from lib/demo-manifest.ts and public/demo/
 * (built by tools/build-demo.mjs from sets this machine rendered), so the
 * hosted demo needs no Storage, no engine and no provider spend. Writes are
 * refused with FC_DEMO. */

export type DemoSpec = { id: string; brand: string; product: string; niche: string; requirements: { min_slides: number; max_slides: number }; assets: { palette: string[] }; content: { style?: string }; guidance?: { angles?: string[]; hook_style?: string } };
type ManifestSet = { id: string; name: string; campaign_id: string; style: string; lane: "batch" | "priority"; slides: number; ask: string; caption: string | null; hashtags: string[]; bio: string | null; cost_usd: number | null; days_ago: number; urls: string[]; clean?: { frames?: number; slides?: number; stripped?: { chunk: string; what: string; count: number }[]; verified?: boolean } };
type ManifestSpec = Omit<DemoSpec, "content" | "guidance"> & { content: { style: string | null }; guidance: DemoSpec["guidance"] | null };
const M = manifest as unknown as { built_at: string; sets: ManifestSet[]; specs: ManifestSpec[] };

export const isDemo = (viewer: Pick<Viewer, "org">) => !!viewer.org.is_demo;
export const DEMO_REASON = "This is the demo workspace: everything here was made with The Future Clips. Pick a plan to make your own.";

export function demoWorkspaceSpecs(): DemoSpec[] {
  return M.specs.map((s) => ({ ...s, content: { style: s.content.style ?? undefined }, guidance: s.guidance ?? undefined }));
}

function demoRow(m: ManifestSet, orgId: string): SetRow & { urls: string[] } {
  const at = new Date(Date.now() - m.days_ago * 86400000 - (m.days_ago * 7919) % 86400000).toISOString();
  return {
    id: m.id, org_id: orgId, campaign_id: m.campaign_id, style: m.style, ask: m.ask,
    slides: m.slides, slides_min: 6, slides_max: 8, reserved_slides: 8, quality: "medium", lane: m.lane, hd: false,
    status: "done", stage: "done", caption: m.caption, cost_usd: m.cost_usd,
    files_json: m.urls, content_json: { caption: m.caption, hashtags: m.hashtags, bio: m.bio }, compliance_json: m.clean ? { pass: true, clean: m.clean } : null, error: null,
    cancel_requested: false, created_at: at, started_at: at, finished_at: at, updated_at: at,
    urls: m.urls,
  };
}

export function demoWorkspaceSets(orgId: string): (SetRow & { urls: string[] })[] {
  return M.sets.map((m) => demoRow(m, orgId)).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function demoWorkspaceSet(orgId: string, id: string): (SetRow & { urls: string[] }) | null {
  const m = M.sets.find((x) => x.id === id);
  return m ? demoRow(m, orgId) : null;
}

/** The Clipper plan with this month's example sets counted as used. */
export function demoWorkspaceAccount(): Account {
  const now = new Date();
  const ps = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
  const used = M.sets.filter((m) => m.days_ago < now.getUTCDate()).reduce((n, m) => n + m.slides, 0);
  const p = PLANS.solo;
  const cap = { batch: p.slides_per_month!, priority: p.priority_slides_per_month! };
  return {
    plan: { id: "solo", label: "Clipper", welcome_slides: 0, price_usd_month: 19.99, slides_per_month: 200, priority_slides_per_month: 0, hd_per_slide_usd: null, seats: 1, can_pin_style: true, can_lock_brand: false, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
    usage: { period_start: ps, slides_used: used, priority_slides_used: 0, hd_slides_used: 0, extra_slides_purchased: 0, extra_priority_slides_purchased: 0, extra_hd_slides_purchased: 0 },
    periodEnd: end,
    left: { batch: Math.max(0, cap.batch - used), priority: 0 },
    cap, balance: 0,
    packs: [{ id: "p100", slides: 100, price_usd: 8 }, { id: "p250", slides: 250, price_usd: 18 }, { id: "p600", slides: 600, price_usd: 40 }],
    sale: [
      { id: "solo", label: "Clipper", price_usd_month: 19.99, slides_per_month: 200, priority_slides_per_month: 0, hd_per_slide_usd: null, seats: 1, can_pin_style: true, can_lock_brand: false, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
      { id: "grind", label: "Pro", price_usd_month: 49.99, slides_per_month: 400, priority_slides_per_month: 0, hd_per_slide_usd: 0, seats: 1, can_pin_style: true, can_lock_brand: false, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
      { id: "agency", label: "Studio", price_usd_month: 99.99, slides_per_month: 1000, priority_slides_per_month: 0, hd_per_slide_usd: 0, seats: 5, can_pin_style: true, can_lock_brand: true, own_creator: true, extra_slide_usd: null, extra_priority_slide_usd: null },
    ],
  };
}

/* ── the demo host (D-045) ───────────────────────────────────────────────────
 * One hidden hostname on the app project (FC_DEMO_HOSTNAME) signs every
 * visitor in as the demo account with no email; FC_DEMO_GENERATE=1 lets the
 * demo workspace make real sets of exactly DEMO_SLIDES slides. */
export const DEMO_EMAIL = "demo@thefutureclips.com";
export const DEMO_SLIDES = 5;

/**
 * How many slides the demo makes for one campaign.
 *
 * It was a flat 4, and a 4-slide set cannot be compliant: 16 of the 21 briefs
 * set `min_slides` to 5 or 6, so `check()` in the engine refused every one —
 * three paid runs on apex-strength each burned three copy attempts and showed
 * the visitor a failure (Product, 2026-09-19, P-22). The demo therefore makes
 * the brief's own minimum, which is the shortest set that can legally ship;
 * the same ask at 5 slides passed on the first attempt.
 */
export const demoSlidesFor = (minSlides?: number | null) =>
  Math.max(DEMO_SLIDES, Math.min(10, Math.round(Number(minSlides) || 0) || DEMO_SLIDES));
export const isDemoHost = (host: string | null | undefined) => {
  const want = process.env.FC_DEMO_HOSTNAME?.toLowerCase();
  return !!want && (host ?? "").split(":")[0].toLowerCase() === want;
};
export const demoGenerationOn = () => process.env.FC_DEMO_GENERATE === "1";

/**
 * How many carousels the demo has left, all visitors together.
 *
 * The daily limits cap how fast the demo can spend; this caps how much. The
 * number and the moment it counts from live in `app_settings.demo_budget`
 * (migration 0026), so the owner can raise it or restart the clock with one
 * update. `fc_reserve_set` enforces the same figure under the org lock — this
 * is only so the page can say what is left before anyone presses Make.
 *
 * null when no budget is set: then the daily limits and the spend cap are the
 * only gates, which is how the demo behaved before 0026.
 */
export type DemoBudget = { allowed: number; used: number; left: number; since: string };
export async function demoBudget(sb: SupabaseClient, orgId: string): Promise<DemoBudget | null> {
  const { data, error } = await sb.rpc("fc_demo_budget", { p_org: orgId });
  if (error || !data) return null;
  return data as DemoBudget;
}

/**
 * One brief with every field filled in, for `/design-preview?view=brief`.
 * A fictional advertiser and a fictional agency — nothing here is a client.
 */
export const DEMO_BRIEF: Spec = {
  id: "tradelens-app-reachify",
  brand: "TradeLens",
  wordmark: "TradeLens",
  handle: "@tradelens.app",
  product: "a chart reader that marks the levels a trader would draw by hand",
  niche: "trading",
  status: "live",
  advertiser: "TradeLens Labs",
  agency: "Reachify",
  payout: {
    rate_usd: 1.4, min_payout_usd: 25, max_payout_usd: 900,
    budget_total_usd: 18000, budget_remaining_usd: 11420, review_days: 9,
    platforms: ["instagram", "tiktok"],
  },
  requirements: { min_slides: 5, max_slides: 10, aspect: "9:16", required_mention: "@tradelens.app", must_show_app: true },
  rules: {
    banned_claims: ["guaranteed returns", "risk free", "signals that always win"],
    banned_topics: ["leverage above 5x", "other people's account screenshots"],
    tone: "Plain and unexcited. A trader explaining a habit, not a pitch.",
    disclosure: "#ad",
    required_phrase: "TradeLens", never_bare: "Lens", no_exclamation: true,
  },
  guidance: {
    hook_style: "One line that names the mistake, then the fix on the next line.",
    angles: ["levels I stopped drawing by hand", "the 4 charts I check before the open", "what I do on a red morning"],
    notes: ["never show a live brokerage screen", "the app is a reader, not a signal service"],
  },
  client: {
    agency: { name: "Reachify", contact: "campaigns@reachify.example", code: "REACHIFY25", commission_pct: 15 },
    advertiser: { name: "TradeLens Labs", contact: "marketing@tradelens.example", site: "https://tradelens.example" },
    opens: "2026-09-01", closes: "2026-11-30",
    source: { name: "Reachify brief v3", url: "https://reachify.example/briefs/tradelens-q4", received: "2026-08-24" },
  },
  deliverables: {
    sets_wanted: 40, due: "2026-10-15", platforms: ["instagram", "tiktok"],
    cta_url: "https://tradelens.example/get", tracking_url: "https://rch.fy/tl-q4",
    audience: "Traders one to three years in who already read charts and want their own levels back faster. Not beginners.",
  },
  references: [
    { url: "https://instagram.example/p/levels-post", note: "the hook sits in the top third, nothing under it", kind: "post" },
    { url: "https://instagram.example/p/morning-routine", note: "four panels, one habit each, no numbers", kind: "post" },
  ],
  app_store: {
    title: "TradeLens", subtitle: "Read the chart, not the noise", developer: "TradeLens Labs",
    rating: 4.8, ratings: "12.4K", age: "4+", category: "Finance", theme: "dark",
  },
  assets: {
    palette: ["#0B0B0C", "#1F5EFF", "#F2F0EB"],
    mascot: null,
    photos: { dir: "", credit: "Pexels" },
    look: "cinematic",
  },
  content: {
    style: "native",
    hook: { photo: 0, lines: ["I stopped drawing levels", "by hand"] },
    ranked: [],
    closer: { lines: ["The reader marks them"], cta: "TradeLens on the App Store" },
  },
};
