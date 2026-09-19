import { adminClient, hasServiceRole } from "@/lib/supabase/admin";
import { verifyWebhook, dodoWebhookEnabled, type DodoEvent } from "@/lib/billing/dodo";
import { applyEvent } from "@/lib/billing/apply";

/**
 * Dodo Payments → us. Public route (middleware allows /api/webhooks/*), gated
 * by the signature. Every effect runs as the service role; the member never
 * touches billing fields (orgs_protect_billing).
 *
 * What each event does:
 *   subscription.active | renewed | plan_changed → plan, billing ids, period; commission for a referred org
 *   subscription.cancelled                        → billing_status 'cancelled' (plan stays until the period ends)
 *   subscription.paused                          → billing_status 'paused'
 *   subscription.on_hold | failed                 → billing_status 'past_due'
 *   subscription.expired                          → plan 'free', billing_status 'expired'
 *   payment.succeeded                            → fc_record_sale (the provider fund); with metadata.pack → fc_credit_pack
 *   refund.succeeded                             → the provider fund gives the share back
 * Anything else is stored and acknowledged.
 */
export const runtime = "nodejs";


export async function POST(req: Request) {
  if (!dodoWebhookEnabled()) return Response.json({ error: "billing webhook not configured" }, { status: 503 });
  // the signature first: an unsigned request learns nothing about this host
  const raw = await req.text();
  let id: string, event: DodoEvent;
  try { ({ id, event } = verifyWebhook(req.headers, raw)); }
  catch (e: any) { return Response.json({ error: e?.message ?? "bad signature" }, { status: 400 }); }
  if (!hasServiceRole()) return Response.json({ error: "signature ok; service role not configured on this host, nothing applied" }, { status: 503 });

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
    outcome = await applyEvent(db, event);
  } catch (e: any) {
    outcome = `error: ${e?.message ?? e}`;
    await db.from("billing_events").update({ outcome }).eq("id", id);
    return Response.json({ error: outcome }, { status: 500 }); // Dodo retries on non-2xx
  }
  await db.from("billing_events").update({ outcome }).eq("id", id);
  return Response.json({ ok: true, outcome });
}
