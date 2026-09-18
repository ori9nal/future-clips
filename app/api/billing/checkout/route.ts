import { viewerForRequest } from "@/lib/auth";
import { createCheckout, dodoEnabled, productMap } from "@/lib/billing/dodo";
import { requestOrigin, sameOrigin } from "@/lib/login";
import { isDemo, DEMO_REASON } from "@/lib/demo";

/**
 * Start a hosted checkout for the signed-in member's workspace.
 * Body: { plan: "solo"|"grind"|"agency", yearly?: boolean } or { pack: "p100"|"p250"|"p600" }
 * Only an owner of the workspace may buy for it.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: "cross-site request" }, { status: 403 });
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  if (isDemo(viewer)) return Response.json({ error: DEMO_REASON, code: "FC_DEMO", url: "https://www.thefutureclips.com/#pricing" }, { status: 403 });
  if (viewer.role !== "owner") return Response.json({ error: "only the workspace owner can change billing" }, { status: 403 });
  if (!dodoEnabled()) return Response.json({ error: "checkout is not connected yet — email team@thefutureclips.com" }, { status: 503 });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const plan = String(body.plan ?? ""), pack = String(body.pack ?? "");
  const sku = plan ? (body.yearly ? `${plan}_year` : plan) : pack;
  const kind = plan ? "plan" : "pack";
  if (!/^(solo|grind|agency)(_year)?$|^p\d+$/.test(sku) || !productMap()[sku]) {
    return Response.json({ error: `"${sku || "?"}" is not on sale` }, { status: 400 });
  }
  const origin = requestOrigin(req);
  try {
    const url = await createCheckout({ kind, sku, orgId: viewer.org.id, email: viewer.user.email, returnUrl: `${origin}/app?page=settings&tab=plan&checkout=done` });
    return Response.json({ url });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "could not start checkout" }, { status: 502 });
  }
}
