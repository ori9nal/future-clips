import { viewerForRequest } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** A partner's payout details (migration 0008). RLS scopes the row to the member's own workspace. */
export async function POST(req: Request) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  if (viewer.role !== "owner") return Response.json({ error: "only the workspace owner can change payout details" }, { status: 403 });
  let body: any = {};
  try { body = await req.json(); } catch { return Response.json({ error: "invalid JSON body" }, { status: 400 }); }
  const method = String(body.method ?? "");
  if (!["paypal", "bank", "wise"].includes(method)) return Response.json({ error: "pick PayPal, bank transfer or Wise" }, { status: 400 });
  const d = body.details ?? {};
  const details: Record<string, string> = {};
  for (const k of ["email", "name", "iban", "bic"]) if (typeof d[k] === "string" && d[k].trim()) details[k] = d[k].trim().slice(0, 120);
  if ((method === "paypal" || method === "wise") && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(details.email ?? "")) return Response.json({ error: "that is not an email address" }, { status: 400 });
  if (method === "bank" && (!details.name || !details.iban)) return Response.json({ error: "the account holder and the account number are needed" }, { status: 400 });
  const sb = await createClient();
  const { error } = await sb.from("partner_payouts").upsert({ org_id: viewer.org.id, method, details, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
