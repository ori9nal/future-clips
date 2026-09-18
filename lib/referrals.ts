import "server-only";

/**
 * The agency referral programme (migration 0005).
 *
 * Every org has a code. An account that arrives through ?ref=CODE is stamped
 * `referred_by` once, on first sign-in (fc_claim_referral, from the cookie the
 * middleware sets). Commission rows are written per referred org per billing
 * period by fc_record_commission — the billing webhook in phase 5, the admin
 * by hand until then — at the agency's tier rate at that moment: 20% under
 * 200 referred accounts, stepping up to a 30% ceiling (referral_tiers).
 * Payouts are settled by hand and marked here; nothing moves through the
 * payment provider.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const REF_COOKIE = "fc_ref";
export const REF_COOKIE_DAYS = 30;
/** The link an agency shares. The site's /signup redirect carries the query through to the app's login. */
export const referralLink = (code: string) => `https://www.thefutureclips.com/signup?ref=${encodeURIComponent(code)}`;

export type AgencySummary = {
  code: string;
  referred: number;
  paying: number;
  rate: number;
  next_tier: { min_referred: number; rate: number } | null;
  pending_usd: number;
  paid_usd: number;
};
export type ReferredOrg = { id: string; name: string; plan: string; billing_status: string; referred_at: string };
export type Commission = {
  id: number; agency_org_id: string; referred_org_id: string; period_start: string;
  revenue_usd: number; rate: number; commission_usd: number; status: "pending" | "paid" | "void";
  paid_at: string | null; note: string | null; created_at: string;
};
export type Tier = { min_referred: number; rate: number };

const num = (v: unknown) => (v == null ? 0 : Number(v));

export async function getAgencySummary(sb: SupabaseClient, orgId: string): Promise<AgencySummary | null> {
  const { data, error } = await sb.rpc("fc_agency_summary", { p_org: orgId });
  if (error || !data) return null; // before 0005 is applied the RPC does not exist; the page hides the section
  const d = data as any;
  return {
    code: String(d.code ?? ""), referred: num(d.referred), paying: num(d.paying), rate: num(d.rate),
    next_tier: d.next_tier ? { min_referred: num(d.next_tier.min_referred), rate: num(d.next_tier.rate) } : null,
    pending_usd: num(d.pending_usd), paid_usd: num(d.paid_usd),
  };
}

export async function listReferred(sb: SupabaseClient, orgId: string): Promise<ReferredOrg[]> {
  const { data } = await sb.rpc("fc_referred_orgs", { p_org: orgId });
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, name: r.name, plan: r.plan, billing_status: r.billing_status, referred_at: r.referred_at }));
}

export async function listCommissions(sb: SupabaseClient, orgId?: string): Promise<Commission[]> {
  let q = sb.from("commissions").select("*").order("period_start", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (orgId) q = q.eq("agency_org_id", orgId);
  const { data, error } = await q;
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({ ...r, revenue_usd: num(r.revenue_usd), rate: num(r.rate), commission_usd: num(r.commission_usd) }));
}

export async function listTiers(sb: SupabaseClient): Promise<Tier[]> {
  const { data } = await sb.from("referral_tiers").select("*").order("min_referred");
  return ((data ?? []) as any[]).map((t) => ({ min_referred: num(t.min_referred), rate: num(t.rate) }));
}

/** Stamp the caller's personal org with the agency behind `code`. Never throws; false when there was nothing to do. */
export async function claimReferral(sb: SupabaseClient, code: string): Promise<boolean> {
  const { data, error } = await sb.rpc("fc_claim_referral", { p_code: code });
  return !error && data === true;
}

export const pct = (rate: number) => `${Math.round(rate * 100)}%`;
export const usd = (n: number) => `$${n.toFixed(2)}`;
