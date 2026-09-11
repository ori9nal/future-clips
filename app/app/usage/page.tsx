import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

type PlanRow = {
  id: string; price_usd_month: number; slides_per_month: number; priority_slides_per_month: number;
  hd_per_slide_usd: number | null; seats: number; extra_slide_usd: number | null; extra_priority_slide_usd: number | null;
};
type UsageRow = {
  period_start: string; slides_used: number; priority_slides_used: number; hd_slides_used: number;
  extra_slides_purchased: number; extra_priority_slides_purchased: number; extra_hd_slides_purchased: number;
};

const monthStart = () => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`; };

/** The counters the quota gate reads, shown to the account that owns them. */
export default async function UsagePage() {
  const viewer = await requireViewer();
  const sb = await createClient();
  const [{ data: plan }, { data: usage }] = await Promise.all([
    sb.from("plans").select("*").eq("id", viewer.org.plan).single(),
    sb.from("usage").select("*").eq("org_id", viewer.org.id).eq("period_start", monthStart()).maybeSingle(),
  ]);
  const p = plan as PlanRow;
  const u = (usage as UsageRow | null) ?? {
    period_start: monthStart(), slides_used: 0, priority_slides_used: 0, hd_slides_used: 0,
    extra_slides_purchased: 0, extra_priority_slides_purchased: 0, extra_hd_slides_purchased: 0,
  };
  const slidesCap = p.slides_per_month + u.extra_slides_purchased;
  const prioCap = p.priority_slides_per_month + u.extra_priority_slides_purchased;
  const pct = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

  return (
    <AppShell active="usage" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow">Usage &amp; plan</p>
        <h1>{viewer.org.name}</h1>
        <p className="fc-sub">
          Plan <b>{p.id}</b> · ${p.price_usd_month}/mo · {p.seats} seat{p.seats > 1 ? "s" : ""} · billing {viewer.org.billing_status}
          {viewer.org.current_period_end ? ` · renews ${new Date(viewer.org.current_period_end).toLocaleDateString()}` : ""}
        </p>
      </header>

      <section className="fc-card">
        <h2>This month <span className="fc-tag">from {u.period_start}</span></h2>
        <div className="fc-bars">
          <div>
            <div className="fc-bar-label"><span>Slides</span><b>{u.slides_used} / {slidesCap}</b></div>
            <div className="fc-bar"><i style={{ width: `${pct(u.slides_used, slidesCap)}%` }} /></div>
          </div>
          {(p.priority_slides_per_month > 0 || u.extra_priority_slides_purchased > 0) && (
            <div>
              <div className="fc-bar-label"><span>Priority slides</span><b>{u.priority_slides_used} / {prioCap}</b></div>
              <div className="fc-bar"><i style={{ width: `${pct(u.priority_slides_used, prioCap)}%` }} /></div>
            </div>
          )}
          {p.hd_per_slide_usd != null && (
            <div>
              <div className="fc-bar-label"><span>HD slides</span><b>{u.hd_slides_used} · +${p.hd_per_slide_usd}/slide</b></div>
            </div>
          )}
        </div>
      </section>

      <section className="fc-card">
        <h2>Extras</h2>
        {p.extra_slide_usd != null ? (
          <p className="fc-note">
            Past the allowance, slides are ${p.extra_slide_usd} each{p.extra_priority_slide_usd != null ? ` (priority $${p.extra_priority_slide_usd})` : ""}.
            Purchased this month: {u.extra_slides_purchased} slides, {u.extra_priority_slides_purchased} priority.
            Buying extras lands with billing.
          </p>
        ) : (
          <p className="fc-note">The free plan has no allowance to extend. Upgrading lands with billing.</p>
        )}
      </section>
    </AppShell>
  );
}
