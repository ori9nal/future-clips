import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole, adminClient } from "@/lib/supabase/admin";
import AppShell from "@/components/AppShell";
import { listTiers, listCommissions, pct, usd } from "@/lib/referrals";
import { markCommissionPaid, voidCommission, saveTier, removeTier, recordCommission } from "../actions";

export const dynamic = "force-dynamic";

type AgencyRow = { id: string; name: string; plan: string; referral_code: string; referred: number; rate: number; pending: number; paid: number };
type ReferredRow = { id: string; name: string; plan: string; billing_status: string; referred_by: string; agency: string; referred_at: string | null };

/**
 * The agency referral programme, from the platform's side: who is referring,
 * at what rate, what is owed, and the tier table. Commission rows are written
 * by the billing webhook (phase 5); until then the form at the bottom records
 * a referred account's revenue for a period by hand. Settlement is by hand
 * too — pay the agency, then mark the row paid here.
 */
export default async function PartnersPage() {
  const viewer = await requirePlatformOwner();
  const sb = await createClient();
  const wide = hasServiceRole();
  const db = wide ? adminClient() : sb;

  // every org the admin can see (all of them with the service role, else RLS's view)
  const [{ data: orgs }, tiers, commissions] = await Promise.all([
    db.from("orgs").select("id, name, plan, referral_code, referred_by, referred_at, billing_status").order("created_at"),
    listTiers(sb),
    listCommissions(sb),
  ]);
  const all = (orgs ?? []) as any[];
  const byId = new Map(all.map((o) => [o.id, o]));
  const referred: ReferredRow[] = all.filter((o) => o.referred_by).map((o) => ({
    id: o.id, name: o.name, plan: o.plan, billing_status: o.billing_status, referred_by: o.referred_by,
    agency: byId.get(o.referred_by)?.name ?? o.referred_by, referred_at: o.referred_at,
  }));
  const rateFor = (n: number) => [...tiers].reverse().find((t) => t.min_referred <= n)?.rate ?? tiers[0]?.rate ?? 0.2;
  const agencies: AgencyRow[] = all
    .map((o) => {
      const n = referred.filter((r) => r.referred_by === o.id).length;
      const mine = commissions.filter((c) => c.agency_org_id === o.id);
      return { id: o.id, name: o.name, plan: o.plan, referral_code: o.referral_code, referred: n, rate: rateFor(n),
        pending: mine.filter((c) => c.status === "pending").reduce((a, c) => a + c.commission_usd, 0),
        paid: mine.filter((c) => c.status === "paid").reduce((a, c) => a + c.commission_usd, 0) };
    })
    .filter((a) => a.referred > 0 || a.pending > 0 || a.paid > 0)
    .sort((a, b) => b.referred - a.referred);
  const pending = commissions.filter((c) => c.status === "pending");
  const owed = pending.reduce((a, c) => a + c.commission_usd, 0);
  const schemaReady = tiers.length > 0;

  return (
    <AppShell active="admin" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow">Admin · partners</p>
        <h1>Who is bringing clippers in.</h1>
        <p className="fc-sub">
          An agency earns a share of every subscription its referred accounts pay for: <b>{tiers[0] ? pct(tiers[0].rate) : "20%"}</b> to
          start, stepping up with volume to <b>{tiers.length ? pct(tiers[tiers.length - 1].rate) : "30%"}</b>. Paid by us, from margin,
          after the fact — nothing goes through the payment provider.
        </p>
      </header>

      {!schemaReady && (
        <section className="fc-card" data-tone="warn">
          <h2>Migration 0005 is not applied</h2>
          <p className="fc-note">Apply <code>supabase/migrations/0005_agency_referrals.sql</code> to the database; this page fills in on the next load.</p>
        </section>
      )}

      <section className="fc-card">
        <h2>Owed right now <span className="fc-tag" data-ok={owed > 0 ? "0" : "1"}>{usd(owed)}</span></h2>
        {pending.length ? (
          <table className="fc-table">
            <thead><tr><th>Agency</th><th>Referred account</th><th>Period</th><th>Revenue</th><th>Rate</th><th>Commission</th><th /></tr></thead>
            <tbody>
              {pending.map((c) => (
                <tr key={c.id}>
                  <td>{byId.get(c.agency_org_id)?.name ?? c.agency_org_id}</td>
                  <td>{byId.get(c.referred_org_id)?.name ?? c.referred_org_id}</td>
                  <td className="fc-mono">{c.period_start}</td>
                  <td>{usd(c.revenue_usd)}</td>
                  <td>{pct(c.rate)}</td>
                  <td><b>{usd(c.commission_usd)}</b></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <form action={markCommissionPaid.bind(null, c.id)} style={{ display: "inline" }}><button className="fc-btn" data-size="sm" type="submit">Mark paid</button></form>{" "}
                    <form action={voidCommission.bind(null, c.id)} style={{ display: "inline" }}><button className="fc-btn" data-variant="ghost" data-size="sm" type="submit">Void</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="fc-note">Nothing pending. Rows appear here as referred accounts pay each period.</p>}
      </section>

      <section className="fc-card">
        <h2>Agencies <span className="fc-tag">{agencies.length}</span></h2>
        {agencies.length ? (
          <table className="fc-table">
            <thead><tr><th>Workspace</th><th>Plan</th><th>Code</th><th>Referred</th><th>Rate now</th><th>Pending</th><th>Paid</th></tr></thead>
            <tbody>
              {agencies.map((a) => (
                <tr key={a.id}><td>{a.name}</td><td>{a.plan}</td><td className="fc-mono">{a.referral_code}</td><td>{a.referred}</td><td>{pct(a.rate)}</td><td>{usd(a.pending)}</td><td>{usd(a.paid)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="fc-note">No workspace has referred anyone yet. Every workspace already has a code (Refer &amp; earn in the app).</p>}
        {!wide && <p className="fc-note" style={{ marginTop: 10 }}>Without <code>SUPABASE_SERVICE_ROLE_KEY</code> on this host this list only shows the workspaces you are a member of.</p>}
      </section>

      <section className="fc-card">
        <h2>Referred accounts <span className="fc-tag">{referred.length}</span></h2>
        {referred.length ? (
          <table className="fc-table">
            <thead><tr><th>Workspace</th><th>Plan</th><th>Billing</th><th>Referred by</th><th>Since</th></tr></thead>
            <tbody>
              {referred.map((r) => (
                <tr key={r.id}><td>{r.name}</td><td>{r.plan}</td><td>{r.billing_status}</td><td>{r.agency}</td><td className="fc-mono">{r.referred_at ? r.referred_at.slice(0, 10) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="fc-note">Nobody has arrived through a referral link yet.</p>}
      </section>

      <section className="fc-card">
        <h2>Tiers</h2>
        <p className="fc-note" style={{ marginBottom: 12 }}>The rate an agency earns once it has referred at least this many accounts. The database refuses anything above 30%.</p>
        <table className="fc-table" style={{ maxWidth: 520 }}>
          <thead><tr><th>Referred accounts</th><th>Rate</th><th /></tr></thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.min_referred}>
                <td className="fc-mono">{t.min_referred}+</td><td>{pct(t.rate)}</td>
                <td>{t.min_referred > 0 && <form action={removeTier.bind(null, t.min_referred)}><button className="fc-btn" data-variant="ghost" data-size="sm" type="submit">Remove</button></form>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={saveTier} className="fc-form" style={{ marginTop: 14 }}>
          <div className="fc-row">
            <label>Referred accounts<input name="min_referred" type="number" min={0} step={1} required placeholder="200" /></label>
            <label>Rate (%)<input name="rate" type="number" min={1} max={30} step={1} required placeholder="25" /></label>
            <button className="fc-btn" type="submit" style={{ alignSelf: "end" }} disabled={!schemaReady}>Add or update tier</button>
          </div>
        </form>
      </section>

      <section className="fc-card">
        <h2>Record revenue by hand</h2>
        <p className="fc-note" style={{ marginBottom: 12 }}>
          Until the billing webhook lands (phase 5), enter what a referred account paid for a period. The commission is computed at the agency's current rate.
          {!wide && <> <b>Needs <code>SUPABASE_SERVICE_ROLE_KEY</code> on this host.</b></>}
        </p>
        <form action={recordCommission} className="fc-form">
          <div className="fc-row">
            <label>Referred workspace
              <select name="referred_org_id" required defaultValue="">
                <option value="" disabled>pick one</option>
                {referred.map((r) => <option key={r.id} value={r.id}>{r.name} — via {r.agency}</option>)}
              </select>
            </label>
            <label>Period start<input name="period_start" type="date" required /></label>
            <label>Revenue (USD)<input name="revenue_usd" type="number" min={0} step="0.01" required placeholder="19.00" /></label>
          </div>
          <label>Note (optional)<input name="note" type="text" placeholder="invoice 1234" /></label>
          <button className="fc-btn" type="submit" disabled={!schemaReady || !wide || !referred.length}>Record</button>
        </form>
      </section>
    </AppShell>
  );
}
