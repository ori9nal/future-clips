import { adminClient, hasServiceRole } from "@/lib/supabase/admin";
import { verifyWebhook, skuFor, dodoWebhookEnabled, type DodoEvent } from "@/lib/billing/dodo";

/**
 * Dodo Payments → us. Public route (middleware allows /api/webhooks/*), gated
 * by the signature. Every effect runs as the service role; the member never
 * touches billing fields (orgs_protect_billing).
 *
 * What each event does:
 *   subscription.active | renewed | plan_changed → plan, billing ids, period; commission for a referred org
 *   subscription.cancelled                        → billing_status 'cancelled' (plan stays until the period ends)
 *   subscription.on_hold | failed                 → billing_status 'past_due'
 *   subscription.expired                          → plan 'free', billing_status 'expired'
 *   payment.succeeded with metadata.pack          → fc_credit_pack
 * Anything else is stored and acknowledged.
 */
export const runtime = "nodejs";

const PLAN_SKUS = new Set(["solo", "grind", "agency"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const planFromSku = (sku: string | null) => (sku ? sku.replace(/_year$/, "") : null);

export async function POST(req: Request) {
  if (!dodoWebhookEnabled()) return Response.json({ error: "billing webhook not configured" }, { status: 503 });
  if (!hasServiceRole()) return Response.json({ error: "service role not configured on this host" }, { status: 503 });
  const raw = await req.text();
  let id: string, event: DodoEvent;
  try { ({ id, event } = verifyWebhook(req.headers, raw)); }
  catch (e: any) { return Response.json({ error: e?.message ?? "bad signature" }, { status: 400 }); }

  const db = adminClient();
  // idempotency: the first delivery wins; any other failure to record it is
  // a real error, answered 500 so Dodo retries (a missing table must not
  // look like a duplicate)
  const { error: ins } = await db.from("billing_events").insert({ id, type: event.type, payload: event });
  if (ins) {
    if (ins.code === "23505") return Response.json({ ok: true, duplicate: true });
    return Response.json({ error: `could not record the event: ${ins.message}` }, { status: 500 });
  }

  let outcome = "ignored";
  try {
    outcome = await handle(db, event);
  } catch (e: any) {
    outcome = `error: ${e?.message ?? e}`;
    await db.from("billing_events").update({ outcome }).eq("id", id);
    return Response.json({ error: outcome }, { status: 500 }); // Dodo retries on non-2xx
  }
  await db.from("billing_events").update({ outcome }).eq("id", id);
  return Response.json({ ok: true, outcome });
}

async function handle(db: ReturnType<typeof adminClient>, ev: DodoEvent): Promise<string> {
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
    const pack = meta.pack ?? (d.product_cart ?? []).map((c) => skuFor(c.product_id)).find((s) => s && /^p\d+$/.test(s)) ?? null;
    if (!pack) return "payment without a pack (subscription invoice)";
    const { error } = await db.rpc("fc_credit_pack", { p_org: orgId, p_pack: pack, p_note: `dodo ${d.payment_id ?? ""}` });
    if (error) throw error;
    return `credited ${pack}`;
  }
  return `stored ${ev.type}`;
}

async function orgByCustomer(db: ReturnType<typeof adminClient>, customerId?: string): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await db.from("orgs").select("id").eq("billing_customer_id", customerId).maybeSingle();
  return data?.id ?? null;
}
