import { viewerForRequest } from "@/lib/auth";
import { customerPortalUrl, dodoEnabled } from "@/lib/billing/dodo";

/** Dodo's customer portal for the workspace's subscription (card, invoices, cancel). */
export async function POST(req: Request) {
  const viewer = await viewerForRequest();
  if (!viewer) return Response.json({ error: "sign in required" }, { status: 401 });
  if (!dodoEnabled()) return Response.json({ error: "billing is not connected yet" }, { status: 503 });
  const customer = (viewer.org as any).billing_customer_id as string | null | undefined;
  if (!customer) return Response.json({ error: "no subscription on file for this workspace" }, { status: 404 });
  try {
    const url = await customerPortalUrl(customer, `${new URL(req.url).origin}/app?page=settings&tab=plan`);
    return Response.json({ url });
  } catch (e: any) {
    return Response.json({ error: e?.message ?? "could not open the portal" }, { status: 502 });
  }
}
