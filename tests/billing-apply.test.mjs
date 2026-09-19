import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DODO_PRODUCTS = "solo=pdt_solo,grind=pdt_grind,agency=pdt_agency,grind_year=pdt_grind_year,p100=pdt_p100";

const { applyEvent } = await import("../lib/billing/apply.ts");

const ORG = "0d3e0000-0000-4000-8000-000000000001";

/** A Supabase-shaped stub that records what the table did. */
function stub({ orgByCustomer = null } = {}) {
  const calls = { updates: [], rpcs: [] };
  const db = {
    from(table) {
      return {
        update(patch) {
          return { eq: (col, val) => { calls.updates.push({ table, patch, col, val }); return Promise.resolve({ error: null }); } };
        },
        select() {
          return { eq: () => ({ maybeSingle: () => Promise.resolve({ data: orgByCustomer ? { id: orgByCustomer } : null }) }) };
        },
      };
    },
    rpc(fn, args) { calls.rpcs.push({ fn, args }); return Promise.resolve({ error: null }); },
  };
  return { db, calls };
}

const sub = (type, extra = {}) => ({
  business_id: "bus_x", type, timestamp: new Date().toISOString(),
  data: {
    payload_type: "Subscription", subscription_id: "sub_1", customer: { customer_id: "cus_1", email: "a@b.c" },
    metadata: { org_id: ORG, plan: "grind" }, previous_billing_date: "2026-09-01T00:00:00Z", next_billing_date: "2026-10-01T00:00:00Z",
    recurring_pre_tax_amount: 4999, ...extra,
  },
});

test("an active subscription sets the plan, the ids and the period", async () => {
  const { db, calls } = stub();
  const out = await applyEvent(db, sub("subscription.active"));
  assert.equal(out, "plan grind active");
  assert.equal(calls.updates.length, 1);
  const { table, patch, val } = calls.updates[0];
  assert.equal(table, "orgs");
  assert.equal(val, ORG);
  assert.equal(patch.plan, "grind");
  assert.equal(patch.billing_status, "active");
  assert.equal(patch.billing_subscription_id, "sub_1");
  assert.equal(patch.current_period_end, "2026-10-01T00:00:00Z");
});

test("a yearly sku is the same plan, not a plan of its own", async () => {
  const { db, calls } = stub();
  const e = sub("subscription.active");
  e.data.metadata = { org_id: ORG };
  e.data.product_id = "pdt_grind_year";
  assert.equal(await applyEvent(db, e), "plan grind active");
  assert.equal(calls.updates[0].patch.plan, "grind");
});

test("cancelled keeps the plan, expired drops it to free", async () => {
  const a = stub();
  assert.equal(await applyEvent(a.db, sub("subscription.cancelled")), "canceled (access until period end)");
  assert.equal(a.calls.updates[0].patch.billing_status, "canceled");
  assert.equal(a.calls.updates[0].patch.plan, undefined, "a cancellation must not take the plan away yet");

  const b = stub();
  assert.equal(await applyEvent(b.db, sub("subscription.expired")), "expired → free");
  assert.equal(b.calls.updates[0].patch.plan, "free");
  assert.equal(b.calls.updates[0].patch.current_period_end, null);
});

test("a failed or held payment is past_due, a pause is paused", async () => {
  for (const [type, status] of [["subscription.failed", "past_due"], ["subscription.on_hold", "past_due"], ["subscription.paused", "paused"]]) {
    const { db, calls } = stub();
    await applyEvent(db, sub(type));
    assert.equal(calls.updates[0].patch.billing_status, status, type);
  }
});

test("an unknown sku changes nothing", async () => {
  const { db, calls } = stub();
  const e = sub("subscription.active");
  e.data.metadata = { org_id: ORG };
  e.data.product_id = "pdt_not_ours";
  assert.match(await applyEvent(db, e), /unknown plan sku/);
  assert.equal(calls.updates.length, 0);
});

test("an event with no workspace, or a junk one, is refused before any write", async () => {
  const { db, calls } = stub();
  const e = sub("subscription.active");
  e.data.metadata = {};
  e.data.customer = {};
  assert.equal(await applyEvent(db, e), "no org for this event");

  const j = sub("subscription.active");
  j.data.metadata = { org_id: "'; drop table orgs; --" };
  assert.match(await applyEvent(db, j), /is not a workspace id/);
  assert.equal(calls.updates.length, 0);
});

test("a subscription invoice records the sale; a pack also credits the slides", async () => {
  const pay = (meta, cart) => ({
    business_id: "bus_x", type: "payment.succeeded", timestamp: new Date().toISOString(),
    data: { payload_type: "Payment", payment_id: "pay_1", customer: { customer_id: "cus_1" }, metadata: meta, product_cart: cart, total_amount: 4999 },
  });

  const a = stub();
  assert.match(await applyEvent(a.db, pay({ org_id: ORG, plan: "grind" }, [{ product_id: "pdt_grind", quantity: 1 }])), /subscription invoice/);
  assert.equal(a.calls.rpcs[0].fn, "fc_record_sale");
  assert.equal(a.calls.rpcs[0].args.p_gross_usd, 49.99);
  assert.equal(a.calls.rpcs.length, 1, "a plan invoice must not credit a pack");

  const b = stub();
  assert.equal(await applyEvent(b.db, pay({ org_id: ORG, pack: "p100" }, [{ product_id: "pdt_p100", quantity: 1 }])), "credited p100");
  assert.deepEqual(b.calls.rpcs.map((r) => r.fn), ["fc_record_sale", "fc_credit_pack"]);
});

test("a refund gives the earmarked share back, once per refund id", async () => {
  const { db, calls } = stub();
  const ev = {
    business_id: "bus_x", type: "refund.succeeded", timestamp: new Date().toISOString(),
    data: { payload_type: "Payment", payment_id: "pay_1", refund_id: "ref_1", metadata: { org_id: ORG }, amount: 4999 },
  };
  assert.match(await applyEvent(db, ev), /refund recorded/);
  assert.equal(calls.rpcs[0].fn, "fc_record_sale");
  assert.equal(calls.rpcs[0].args.p_payment_id, "ref_1");
  assert.equal(calls.rpcs[0].args.p_gross_usd, -49.99);
});

test("the workspace is found by its Dodo customer when the event carries no metadata", async () => {
  const { db, calls } = stub({ orgByCustomer: ORG });
  const e = sub("subscription.renewed");
  e.data.metadata = {};              // no org_id: it has to come from the customer
  e.data.product_id = "pdt_grind";   // and the plan from the product map
  assert.equal(await applyEvent(db, e), "plan grind active");
  assert.equal(calls.updates[0].val, ORG);
});
