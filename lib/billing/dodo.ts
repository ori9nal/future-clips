import "server-only";

/**
 * Dodo Payments (merchant of record) — phase 5.
 *
 * Everything here is switched on by environment alone; nothing else in the
 * app changes when the merchant account is approved:
 *
 *   DODO_API_KEY          the business API key (Editor role)
 *   DODO_WEBHOOK_SECRET   the endpoint's signing secret (whsec_…)
 *   DODO_ENV              "test" (default) or "live"
 *   DODO_PRODUCTS         plan/pack id → Dodo product id, comma-separated:
 *                         "solo=pdt_…,grind=pdt_…,agency=pdt_…,p100=pdt_…,p250=pdt_…,p600=pdt_…"
 *                         (yearly plans, if sold: "solo_year=pdt_…" etc.)
 *
 * The checkout carries `metadata.org_id` and `metadata.plan` / `metadata.pack`,
 * so the webhook never has to guess what was bought; the product map is a
 * fallback for events that arrive without our metadata (dashboard-created
 * subscriptions, plan changes made in Dodo's portal).
 *
 * Money never touches our servers: Dodo hosts the checkout, holds the card,
 * and is the merchant of record. We receive signed events and set the plan.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const dodoEnabled = () => !!process.env.DODO_API_KEY;
export const dodoWebhookEnabled = () => !!process.env.DODO_WEBHOOK_SECRET;

const BASE = () => (process.env.DODO_ENV === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com");

/** plan/pack id → Dodo product id, from DODO_PRODUCTS. */
export function productMap(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of String(process.env.DODO_PRODUCTS ?? "").split(",")) {
    const [k, v] = pair.split("=").map((s) => s.trim());
    if (k && v) out[k] = v;
  }
  return out;
}
/** Dodo product id → plan/pack id (the inverse map). */
export function skuFor(productId: string): string | null {
  const m = productMap();
  return Object.keys(m).find((k) => m[k] === productId) ?? null;
}

async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const key = process.env.DODO_API_KEY;
  if (!key) throw new Error("DODO_API_KEY is not set");
  const res = await fetch(`${BASE()}${path}`, {
    ...init,
    method: init.method ?? (init.json ? "POST" : "GET"),
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) },
    body: init.json ? JSON.stringify(init.json) : init.body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Dodo ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export type CheckoutInput = {
  kind: "plan" | "pack";
  sku: string;              // "solo" | "grind" | "agency" | "solo_year" … | "p100" | "p250" | "p600"
  orgId: string;
  email: string;
  returnUrl: string;
};

/** A hosted checkout for a plan or a pack. Returns the URL to send the member to. */
export async function createCheckout(i: CheckoutInput): Promise<string> {
  const product = productMap()[i.sku];
  if (!product) throw new Error(`no Dodo product configured for "${i.sku}" (DODO_PRODUCTS)`);
  const r = await api<{ session_id: string; checkout_url?: string }>("/checkouts", {
    json: {
      product_cart: [{ product_id: product, quantity: 1 }],
      customer: { email: i.email },
      return_url: i.returnUrl,
      metadata: { org_id: i.orgId, [i.kind]: i.sku },
      feature_flags: { allow_discount_code: true },
    },
  });
  if (!r.checkout_url) throw new Error("Dodo returned no checkout_url");
  return r.checkout_url;
}

/** Dodo's hosted portal: manage the card, cancel, download invoices. */
export async function customerPortalUrl(customerId: string, returnUrl: string): Promise<string> {
  const r = await api<{ link: string }>(`/customers/${encodeURIComponent(customerId)}/customer-portal/session`, {
    json: { return_url: returnUrl },
  });
  return r.link;
}

/* ── webhooks (Standard Webhooks: webhook-id, webhook-timestamp, webhook-signature) ── */

const TOLERANCE_S = 5 * 60;

/**
 * Verify a webhook delivery. Returns the parsed event or throws. The body
 * must be the raw text exactly as received — re-serialising it would change
 * the bytes the signature covers.
 */
export function verifyWebhook(headers: Headers, rawBody: string): { id: string; event: DodoEvent } {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) throw new Error("DODO_WEBHOOK_SECRET is not set");
  const id = headers.get("webhook-id") ?? "";
  const ts = headers.get("webhook-timestamp") ?? "";
  const sig = headers.get("webhook-signature") ?? "";
  if (!id || !ts || !sig) throw new Error("missing webhook headers");
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > TOLERANCE_S) throw new Error("webhook timestamp outside tolerance");
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest();
  const ok = sig.split(" ").some((part) => {
    const [ver, val] = part.split(",");
    if (ver !== "v1" || !val) return false;
    const got = Buffer.from(val, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
  if (!ok) throw new Error("webhook signature mismatch");
  return { id, event: JSON.parse(rawBody) as DodoEvent };
}

export type DodoEvent = {
  business_id: string;
  type: string;                // "subscription.active" | "subscription.renewed" | "subscription.plan_changed" | "subscription.cancelled" | "subscription.expired" | "subscription.failed" | "subscription.on_hold" | "payment.succeeded" | …
  timestamp: string;
  data: {
    payload_type: "Subscription" | "Payment" | string;
    subscription_id?: string;
    payment_id?: string;
    product_id?: string;
    product_cart?: { product_id: string; quantity: number }[];
    customer?: { customer_id: string; email?: string; name?: string };
    metadata?: Record<string, string>;
    status?: string;
    previous_billing_date?: string;
    next_billing_date?: string;
    recurring_pre_tax_amount?: number;   // cents
    total_amount?: number;               // cents (payments)
    settlement_amount?: number;
    currency?: string;
  };
};
