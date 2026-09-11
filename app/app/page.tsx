import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listSpecs } from "@/lib/db/campaigns";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

/**
 * The customer home: the campaigns this account can make slideshows for.
 * Platform campaigns (org_id null) plus the org's own, straight from the
 * database under RLS. Mobile-first: one column at 375px, cards at wider.
 */
export default async function AppHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const viewer = await requireViewer();
  const { denied } = await searchParams;
  const sb = await createClient();
  const specs = await listSpecs(sb, { liveOnly: true });

  return (
    <AppShell active="app" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow">Campaigns</p>
        <h1>Pick a campaign.</h1>
        <p className="fc-sub">
          Every campaign carries its own brief, mention and banned claims; a slideshow is checked against them before it renders.
        </p>
        {denied === "admin" && <p className="fc-err-line" role="alert">That page is for platform owners.</p>}
      </header>

      {viewer.org.plan === "free" && (
        <section className="fc-card fc-card-soft">
          <h2>Free plan</h2>
          <p className="fc-note">
            Each live campaign has one ready-made slideshow you can download. Generating your own needs a paid plan —
            see <Link href="/app/usage">Usage &amp; plan</Link>.
          </p>
        </section>
      )}

      <section className="fc-grid">
        {specs.map((s) => (
          <Link key={s.id} href={`/app/campaigns/${s.id}`} className="fc-tile">
            <div className="fc-tile-top">
              <span className="fc-sw" style={{ background: s.assets?.palette?.[1] ?? "#0E0E10" }} />
              <div>
                <h3>{s.brand}</h3>
                <p className="fc-handle">{s.requirements?.required_mention ?? s.rules?.required_phrase ?? s.product}</p>
              </div>
            </div>
            <div className="fc-meta">
              <div><span>Niche</span><b>{s.niche}</b></div>
              <div><span>Slides</span><b>{s.requirements?.min_slides ?? 5}–{s.requirements?.max_slides ?? 10}</b></div>
              <div><span>Style</span><b>{s.content?.style ?? "feed"}</b></div>
              {s.payout?.rate_usd != null && <div><span>Rate</span><b>${s.payout.rate_usd} / 1k</b></div>}
            </div>
          </Link>
        ))}
        {!specs.length && <p className="fc-note">No live campaigns yet.</p>}
      </section>
    </AppShell>
  );
}
