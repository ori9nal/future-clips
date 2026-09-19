import "server-only";

/**
 * What each Dodo event does to a workspace.
 *
 * This lived inside the webhook route, where nothing could reach it: the
 * route needs a signature, a service-role client and a live request, so the
 * table that decides "which event sets which plan" had never been run by a
 * test. It is the part that must not be wrong — a mis-read event either
 * leaves someone paying for a plan they do not have, or hands out one they
 * have not paid for — so it lives here and takes any client shaped like
 * Supabase's.
 */
import { skuFor } from "@/lib/billing/dodo";
import type { DodoEvent } from "@/lib/billing/dodo";

/**
 * Just enough of the Supabase client for this table; a test passes a stub.
 * Deliberately loose: the point is that the decisions can be exercised, not
 * that the query builder's generics are re-declared here.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type BillingDb = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

const PLAN_SKUS = new Set(["solo", "grind", "agency"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const planFromSku = (sku: string | null) => (sku ? sku.replace(/_year$/, "") : null);

export async function applyEvent(db: BillingDb, ev: DodoEvent): Promise<string> {
  const d = ev.data ?? {};
  const meta = d.metadata ?? {};
  const orgId = meta.org_id ?? (await orgByCustomer(db, d.customer?.customer_id));
  if (!orgId) return "no org for this event";
  if (!UUID.test(orgId)) return `ignored: org_id "${orgId}" is not a workspace id`;

  if (ev.type.startsWith("subscription.")) {
    const sku = meta.plan ?? skuFor(d.product_id ?? "") ?? null;
    const plan = planFromSku(sku);
    const period = { current_period_start: d.previous_billing_date ?? null, current_period_end: d.next_billing_date ?? null };
    const ids = { billing_provider: "dodo", billing_customer_id: d.customer?.customer_id ?? null, billing_subscription_id: d.subscription_id ?? null };

    switch (ev.type) {
      case "subscription.active":
      case "subscription.renewed":
      case "subscription.plan_changed": {
        if (!plan || !PLAN_SKUS.has(plan)) return `unknown plan sku "${sku}"`;
        const { error } = await db.from("orgs").update({ plan, billing_status: "active", ...ids, ...period }).eq("id", orgId);
        if (error) throw error;
        // the referral programme is dormant (D-001, D-017): only with its
        // schema applied and the flag on; a failure there never fails the plan
        if (process.env.FC_REFERRALS === "1") {
          const revenue = (d.recurring_pre_tax_amount ?? 0) / 100;
          if (revenue > 0 && period.current_period_start) {
            const { error: rc } = await db.rpc("fc_record_commission", { p_referred: orgId, p_period: period.current_period_start.slice(0, 10), p_revenue: revenue, p_note: `dodo ${d.subscription_id ?? ""} ${ev.type}` });
            if (rc) console.warn(`commission not recorded for ${orgId}: ${rc.message}`);
          }
        }
        return `plan ${plan} active`;
      }
      case "subscription.cancelled": {
        const { error } = await db.from("orgs").update({ billing_status: "canceled", ...ids }).eq("id", orgId);
        if (error) throw error;
        return "canceled (access until period end)";
      }
      case "subscription.paused": {
        const { error } = await db.from("orgs").update({ billing_status: "paused", ...ids }).eq("id", orgId);
        if (error) throw error;
        return "paused";
      }
      case "subscription.on_hold":
      case "subscription.failed": {
        const { error } = await db.from("orgs").update({ billing_status: "past_due", ...ids }).eq("id", orgId);
        if (error) throw error;
        return "past_due";
      }
      case "subscription.expired": {
        const { error } = await db.from("orgs").update({ plan: "free", billing_status: "expired", ...ids, current_period_start: null, current_period_end: null }).eq("id", orgId);
        if (error) throw error;
        return "expired → free";
      }
    }
    return `stored ${ev.type}`;
  }

  if (ev.type === "payment.succeeded") {
    // the provider fund: a share of every paid invoice is earmarked for Anthropic and OpenAI (migration 0012)
    const gross = (d.total_amount ?? 0) / 100;
    const sku = meta.plan ?? meta.pack ?? (d.product_cart ?? []).map((c) => skuFor(c.product_id)).find(Boolean) ?? null;
    if (gross > 0 && d.payment_id) {
      const { error: fe } = await db.rpc("fc_record_sale", { p_org: orgId, p_payment_id: d.payment_id, p_sku: sku, p_gross_usd: gross, p_note: `dodo ${ev.type}` });
      if (fe) console.warn(`sale not recorded in the provider fund: ${fe.message}`);
    }
    const pack = meta.pack ?? (d.product_cart ?? []).map((c) => skuFor(c.product_id)).find((s) => s && /^p\d+$/.test(s)) ?? null;
    if (!pack) return "payment without a pack (subscription invoice)";
    const { error } = await db.rpc("fc_credit_pack", { p_org: orgId, p_pack: pack, p_note: `dodo ${d.payment_id ?? ""}` });
    if (error) throw error;
    return `credited ${pack}`;
  }
  if (ev.type === "refund.succeeded") {
    // the provider fund gives the earmarked share back
    const amount = (d.amount ?? d.total_amount ?? 0) / 100;
    const refundId = d.refund_id ?? (d.payment_id ? `refund:${d.payment_id}` : null);
    if (amount > 0 && refundId) {
      const { error: fe } = await db.rpc("fc_record_sale", { p_org: orgId, p_payment_id: refundId, p_sku: null, p_gross_usd: -amount, p_note: `dodo refund of ${d.payment_id ?? "?"}` });
      if (fe) console.warn(`refund not recorded in the provider fund: ${fe.message}`);
      return `refund recorded (-$${amount.toFixed(2)})`;
    }
    return "refund without an amount";
  }
  return `stored ${ev.type}`;
}

async function orgByCustomer(db: BillingDb, customerId?: string): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await db.from("orgs").select("id").eq("billing_customer_id", customerId).maybeSingle();
  return data?.id ?? null;
}
