import "server-only";

/**
 * The numbers the dashboard shows: plan, allowance, what is used this
 * period. Read as the member (RLS), the same rows the quota gate writes.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Viewer } from "@/lib/auth";

export type PlanRow = {
  id: string;
  /** 0006: the customer-facing name (Free / Clipper / Pro / Studio); absent before the migration */
  label?: string;
  welcome_slides?: number;
  price_usd_month: number;
  slides_per_month: number;
  priority_slides_per_month: number;
  hd_per_slide_usd: number | null;
  seats: number;
  can_pin_style: boolean;
  can_lock_brand: boolean;
  own_creator: boolean;
  extra_slide_usd: number | null;
  extra_priority_slide_usd: number | null;
};

export type UsageRow = {
  period_start: string;
  slides_used: number;
  priority_slides_used: number;
  hd_slides_used: number;
  extra_slides_purchased: number;
  extra_priority_slides_purchased: number;
  extra_hd_slides_purchased: number;
};

export type Pack = { id: string; slides: number; price_usd: number };

export type Account = {
  plan: PlanRow;
  usage: UsageRow;
  periodEnd: string | null;
  /** slides left, per lane: allowance + purchased extras − used, plus the carried balance on the batch lane */
  left: { batch: number; priority: number };
  cap: { batch: number; priority: number };
  /** 0006: purchased + welcome slides that never expire (spent after the allowance) */
  balance: number;
  /** 0006: the packs on sale; empty before the migration or until checkout */
  packs: Pack[];
};

export { PLAN_LABELS, planLabel } from "@/lib/plans";

const EMPTY = (period_start: string): UsageRow => ({
  period_start, slides_used: 0, priority_slides_used: 0, hd_slides_used: 0,
  extra_slides_purchased: 0, extra_priority_slides_purchased: 0, extra_hd_slides_purchased: 0,
});

/** The same period rule as fc_period_start: billing period if set, else the calendar month (UTC). */
export function periodStart(viewer: Viewer): string {
  const o = viewer.org as any;
  if (o.current_period_start && o.current_period_end && new Date(o.current_period_end) > new Date()) {
    return String(o.current_period_start).slice(0, 10);
  }
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function getAccount(sb: SupabaseClient, viewer: Viewer): Promise<Account> {
  const ps = periodStart(viewer);
  const [{ data: plan }, { data: usage }, packsRes] = await Promise.all([
    sb.from("plans").select("*").eq("id", viewer.org.plan).single(),
    sb.from("usage").select("*").eq("org_id", viewer.org.id).eq("period_start", ps).maybeSingle(),
    sb.from("packs").select("id, slides, price_usd").eq("active", true).order("slides"),
  ]);
  const p = plan as PlanRow;
  const u = (usage as UsageRow | null) ?? EMPTY(ps);
  const balance = Number(viewer.org.slide_balance ?? 0);
  const packs: Pack[] = packsRes.error ? [] : ((packsRes.data ?? []) as any[]).map((k) => ({ id: k.id, slides: Number(k.slides), price_usd: Number(k.price_usd) }));
  const cap = { batch: p.slides_per_month + u.extra_slides_purchased, priority: p.priority_slides_per_month + u.extra_priority_slides_purchased };
  return {
    plan: p,
    usage: u,
    periodEnd: viewer.org.current_period_end,
    cap,
    left: { batch: Math.max(0, cap.batch - u.slides_used) + balance, priority: Math.max(0, cap.priority - u.priority_slides_used) },
    balance,
    packs,
  };
}
