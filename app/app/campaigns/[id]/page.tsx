import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSpec } from "@/lib/db/campaigns";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

/**
 * One campaign: what the brief locks, and the ask form.
 *
 * The form itself lands with the hosted engine (phase 3). Until then the
 * page says so plainly rather than rendering a button that fails — a free
 * account sees the ready-made slideshow slot, a paid one sees the controls
 * it will get.
 */
export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireViewer();
  const { id } = await params;
  const sb = await createClient();
  const spec = await getSpec(sb, id);
  if (!spec) notFound();

  const paid = viewer.org.plan !== "free";
  const rules = spec.rules ?? ({} as any);
  const req = spec.requirements ?? ({} as any);

  return (
    <AppShell active="app" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow"><Link href="/app">Campaigns</Link> · {spec.niche}</p>
        <h1>{spec.brand}</h1>
        <p className="fc-sub">{spec.product}</p>
      </header>

      <section className="fc-card">
        <h2>What the brief locks <span className="fc-tag">enforced before render</span></h2>
        <div className="fc-meta">
          <div><span>Slides</span><b>{req.min_slides ?? 5}–{req.max_slides ?? 10}</b></div>
          {req.required_mention && <div><span>Mention</span><b>{req.required_mention}</b></div>}
          {rules.required_phrase && <div><span>Always written as</span><b>{rules.required_phrase}</b></div>}
          {req.must_show_app && <div><span>App</span><b>must appear</b></div>}
          {spec.payout?.rate_usd != null && <div><span>Rate</span><b>${spec.payout.rate_usd} / 1k views</b></div>}
          {spec.payout?.review_days != null && <div><span>Review</span><b>{spec.payout.review_days} days</b></div>}
        </div>
        {rules.banned_claims?.length ? (
          <p className="fc-note" style={{ marginTop: 14 }}><b>Banned claims:</b> {rules.banned_claims.join(" · ")}</p>
        ) : null}
        {rules.tone && <p className="fc-note" style={{ marginTop: 8 }}><b>Tone:</b> {rules.tone}</p>}
      </section>

      {paid ? (
        <section className="fc-card">
          <h2>Make a slideshow</h2>
          <p className="fc-note">
            Generation on this host is being wired up (the engine's hosted path). Your plan gives you{" "}
            <b>{viewer.org.plan}</b> allowances — see <Link href="/app/usage">Usage</Link>. This form goes live with it.
          </p>
        </section>
      ) : (
        <section className="fc-card fc-card-soft">
          <h2>Ready-made slideshow</h2>
          <p className="fc-note">
            The free plan includes one ready-made slideshow per live campaign. This campaign's is being rendered; it will
            appear here with a download button.
          </p>
        </section>
      )}
    </AppShell>
  );
}
