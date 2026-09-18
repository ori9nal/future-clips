"use client";

/**
 * The partner dashboard: an affiliate-only workspace (orgs.is_partner). It
 * refers clippers and gets paid; it never generates. Same design system as
 * the product (app/dashboard.css), a smaller map: Overview, Referrals,
 * Payouts, Settings.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { PLAN_LABELS } from "@/lib/plans";
import type { AgencySummary, ReferredOrg, Commission } from "@/lib/referrals";

type Page = "overview" | "referrals" | "payouts" | "settings";
type Payout = { method: "paypal" | "bank" | "wise"; details: Record<string, string> } | null;
type Props = {
  viewer: { email: string; orgName: string; isPlatformOwner: boolean };
  partners: { summary: AgencySummary; referred: ReferredOrg[]; commissions: Commission[] };
  payout: Payout;
};
type Theme = "light" | "dark";

const TITLES: Record<Page, string> = { overview: "Overview", referrals: "Referrals", payouts: "Payouts", settings: "Settings" };
const I = {
  overview: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 20V10" /></svg>,
  referrals: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5" /><circle cx="17" cy="10" r="2.2" /><path d="M15.5 14.5c2.6.3 4.4 1.8 5 4.5" /></svg>,
  payouts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h3" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></svg>,
  admin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6z" /></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
};
const usd = (n: number) => `$${n.toFixed(2)}`;
const pct = (r: number) => `${Math.round(r * 100)}%`;
const month = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "long", year: "numeric" });
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function PartnerDashboard({ viewer, partners, payout: payout0 }: Props) {
  const [page, setPage] = useState<Page>("overview");
  const [menu, setMenu] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");
  const [toast, setToast] = useState<string | null>(null);
  const [payout, setPayout] = useState<Payout>(payout0);
  const [method, setMethod] = useState<"paypal" | "bank" | "wise">(payout0?.method ?? "paypal");
  const [details, setDetails] = useState<Record<string, string>>(payout0?.details ?? {});
  const [saving, setSaving] = useState(false);
  const P = partners.summary;
  const link = `https://www.thefutureclips.com/signup?ref=${P.code}`;
  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2800); };

  useEffect(() => {
    const t = document.documentElement.dataset.theme; if (t === "light" || t === "dark") setTheme(t);
    const q = new URLSearchParams(window.location.search); const pg = q.get("page") as Page | null;
    if (pg && pg in TITLES) { setPage(pg); window.history.replaceState(null, "", "/app"); }
  }, []);
  const applyTheme = (t: Theme) => { setTheme(t); document.documentElement.dataset.theme = t; try { localStorage.setItem("fc.theme", t); } catch { /* ignore */ } };
  const go = (p: Page) => { setPage(p); setMenu(false); };
  const copy = async () => { try { await navigator.clipboard.writeText(link); say("Link copied"); } catch { say(link); } };

  const pending = partners.commissions.filter((c) => c.status === "pending");
  const paid = partners.commissions.filter((c) => c.status === "paid");
  const byMonth = Object.entries(partners.commissions.reduce<Record<string, number>>((a, c) => { a[c.period_start] = (a[c.period_start] ?? 0) + c.commission_usd; return a; }, {})).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6);
  const max = Math.max(1, ...byMonth.map(([, v]) => v));

  async function savePayout() {
    setSaving(true);
    try {
      const r = await fetch("/api/partner/payout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, details }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { say(j.error ?? "Could not save"); return; }
      setPayout({ method, details }); say("Payout details saved");
    } finally { setSaving(false); }
  }
  const field = (k: string, label: string, ph: string) => (
    <div className="field" key={k}><label className="label" htmlFor={`pd-${k}`}>{label}</label><input id={`pd-${k}`} className="input" value={details[k] ?? ""} placeholder={ph} onChange={(e) => setDetails({ ...details, [k]: e.target.value })} /></div>
  );

  return (
    <div className={`app${menu ? " menu" : ""}`}>
      <button className="sideScrim" aria-label="Close menu" onClick={() => setMenu(false)} />
      <aside className="side">
        <button className="ws" onClick={() => go("settings")}>
          <span className="mark">{(viewer.orgName.trim()[0] ?? "P").toUpperCase()}</span>
          <span className="name">{viewer.orgName}</span>
          <span className="plan">Partner</span>
        </button>
        <nav className="nav" aria-label="Main">
          {(["overview", "referrals", "payouts"] as Page[]).map((id) => <button key={id} className={page === id ? "on" : ""} onClick={() => go(id)}>{I[id]}{TITLES[id]}</button>)}
        </nav>
        <div className="foot nav">
          {viewer.isPlatformOwner && <Link href="/admin">{I.admin}Admin</Link>}
          <button className={page === "settings" ? "on" : ""} onClick={() => go("settings")}>{I.settings}Settings</button>
          <div className="themeRow"><span>Dark theme</span><button className={`sw${theme === "dark" ? " on" : ""}`} role="switch" aria-checked={theme === "dark"} aria-label="Dark theme" onClick={() => applyTheme(theme === "dark" ? "light" : "dark")} /></div>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <button className="btn quiet burger" onClick={() => setMenu(true)} aria-label="Menu">{I.menu}</button>
          <h1>{TITLES[page]}</h1>
          <span className="grow" />
          <div className="meter" title={P.next_tier ? `${P.referred} of ${P.next_tier.min_referred} referred accounts toward ${pct(P.next_tier.rate)}` : "Top tier"}>
            <div className="row"><span>Next tier</span><b className="num">{P.next_tier ? `${P.referred} of ${P.next_tier.min_referred}` : "Top tier"}</b></div>
            <div className="bar"><i style={{ width: `${P.next_tier ? Math.min(100, Math.round((P.referred / P.next_tier.min_referred) * 100)) : 100}%` }} /></div>
          </div>
        </header>

        <div className="view">
          <div className="page">
            {page === "overview" && (
              <>
                <header><div><h1>Your referral link</h1><p>Anyone who signs up through it is credited to you. You earn {pct(P.rate)} of every subscription they pay, settled monthly.</p></div></header>
                <div className="card"><div className="body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="linkbox"><code>{link}</code><button className="btn primary sm" onClick={copy}>Copy link</button></div>
                  <p className="hint">Your code is {P.code}. It works on every page of thefutureclips.com and in the app's sign-in.</p>
                </div></div>
                <div className="stats">
                  <div className="stat"><span className="k">Referred accounts</span><span className="v">{P.referred}</span><span className="d">{P.paying} on a paid plan</span></div>
                  <div className="stat"><span className="k">Your rate</span><span className="v">{pct(P.rate)}</span><span className="d">{P.next_tier ? `${pct(P.next_tier.rate)} from ${P.next_tier.min_referred} referred` : "top tier"}</span></div>
                  <div className="stat"><span className="k">Owed to you</span><span className="v">{usd(P.pending_usd)}</span><span className="d">settled at month end</span></div>
                  <div className="stat"><span className="k">Paid so far</span><span className="v">{usd(P.paid_usd)}</span><span className="d">all time</span></div>
                </div>
                {P.next_tier && (
                  <div className="card"><div className="body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><b>Next tier</b><span className="muted">{P.next_tier.min_referred - P.referred} more referred accounts unlock {pct(P.next_tier.rate)} on everything from then on</span></div>
                    <div className="progress"><i style={{ width: `${Math.min(100, Math.round((P.referred / P.next_tier.min_referred) * 100))}%` }} /></div>
                  </div></div>
                )}
                <section>
                  <header style={{ marginBottom: 12 }}><h2>Commission by month</h2></header>
                  {byMonth.length ? (
                    <div className="card"><div className="body bars">
                      {byMonth.map(([m, v]) => (
                        <div className="barrow" key={m}><span className="bl">{month(m)}</span><span className="bt"><i style={{ width: `${Math.round((v / max) * 100)}%` }} /></span><span className="bv num">{usd(v)}</span></div>
                      ))}
                    </div></div>
                  ) : <div className="empty"><h3>No commission yet</h3><p>Share your link. The first month a referred account pays, it shows up here.</p><button className="btn primary sm" onClick={copy}>Copy link</button></div>}
                </section>
              </>
            )}

            {page === "referrals" && (
              <>
                <header><div><h1>Accounts you referred</h1><p>Each one earns you {pct(P.rate)} of what it pays, for as long as it stays subscribed.</p></div><button className="btn" onClick={copy}>Copy link</button></header>
                {partners.referred.length ? (
                  <div className="card"><table className="table">
                    <thead><tr><th>Workspace</th><th>Plan</th><th>Billing</th><th>Since</th></tr></thead>
                    <tbody>{partners.referred.map((r) => <tr key={r.id}><td>{r.name}</td><td>{PLAN_LABELS[r.plan] ?? r.plan}</td><td>{r.billing_status === "none" ? <span className="pill">Not paying yet</span> : r.billing_status === "active" ? <span className="pill ok">Active</span> : <span className="pill warn">{r.billing_status.replace("_", " ")}</span>}</td><td>{day(r.referred_at)}</td></tr>)}</tbody>
                  </table></div>
                ) : <div className="empty"><h3>No referrals yet</h3><p>Send your link to your roster. Accounts that sign up through it appear here with their plan and billing state.</p><button className="btn primary sm" onClick={copy}>Copy link</button></div>}
              </>
            )}

            {page === "payouts" && (
              <>
                <header><div><h1>Payouts</h1><p>Commission is settled at the end of each month to the details below, by bank transfer, PayPal or Wise. Nothing runs through the payment provider.</p></div></header>
                <div className="stats">
                  <div className="stat"><span className="k">Owed to you</span><span className="v">{usd(P.pending_usd)}</span><span className="d">{pending.length} pending {pending.length === 1 ? "commission" : "commissions"}</span></div>
                  <div className="stat"><span className="k">Paid so far</span><span className="v">{usd(P.paid_usd)}</span><span className="d">{paid.length} settled</span></div>
                  <div className="stat"><span className="k">Payout method</span><span className="v" style={{ fontSize: 20 }}>{payout ? { paypal: "PayPal", bank: "Bank transfer", wise: "Wise" }[payout.method] : "Not set"}</span><span className="d">{payout ? (payout.details.email ?? payout.details.iban ?? payout.details.account ?? "") : "Add one below"}</span></div>
                </div>
                <section>
                  <header style={{ marginBottom: 12 }}><h2>History</h2></header>
                  {partners.commissions.length ? (
                    <div className="card"><table className="table">
                      <thead><tr><th>Period</th><th>Account</th><th className="n">Revenue</th><th className="n">Rate</th><th className="n">Commission</th><th>Status</th></tr></thead>
                      <tbody>{partners.commissions.map((c) => <tr key={c.id}><td>{month(c.period_start)}</td><td>{partners.referred.find((r) => r.id === c.referred_org_id)?.name ?? "Referred account"}</td><td className="n">{usd(c.revenue_usd)}</td><td className="n">{pct(c.rate)}</td><td className="n"><b>{usd(c.commission_usd)}</b></td><td>{c.status === "paid" ? <span className="pill ok">Paid {c.paid_at ? day(c.paid_at) : ""}</span> : c.status === "pending" ? <span className="pill">Pending</span> : <span className="pill">Void</span>}</td></tr>)}</tbody>
                    </table></div>
                  ) : <div className="empty"><h3>Nothing to pay out yet</h3><p>Commission appears here the first month a referred account pays.</p></div>}
                </section>
                <section>
                  <header style={{ marginBottom: 12 }}><h2>Where to pay you</h2></header>
                  <div className="card"><div className="body" style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
                    <div className="control"><span>Method</span><div className="seg" role="radiogroup">{(["paypal", "bank", "wise"] as const).map((m) => <button key={m} role="radio" aria-checked={method === m} className={method === m ? "on" : ""} onClick={() => setMethod(m)}>{{ paypal: "PayPal", bank: "Bank transfer", wise: "Wise" }[m]}</button>)}</div></div>
                    {method === "paypal" && field("email", "PayPal email", "you@example.com")}
                    {method === "wise" && field("email", "Wise email", "you@example.com")}
                    {method === "bank" && <>{field("name", "Account holder", "Full name on the account")}{field("iban", "IBAN or account number", "GB29 NWBK 6016 1331 9268 19")}{field("bic", "BIC, SWIFT or routing number", "NWBKGB2L")}</>}
                    <div><button className="btn primary" disabled={saving} onClick={savePayout}>{saving ? "Saving" : "Save payout details"}</button></div>
                  </div></div>
                </section>
              </>
            )}

            {page === "settings" && (
              <div className="card rows">
                <div className="rowi"><div className="l"><b>Email</b><small>Where sign-in links and payout notices go</small></div><div className="r">{viewer.email}</div></div>
                <div className="rowi"><div className="l"><b>Workspace</b><small>A partner workspace refers clippers; it does not generate slideshows</small></div><div className="r">{viewer.orgName}</div></div>
                <div className="rowi"><div className="l"><b>Your code</b><small>Shown in every link you share</small></div><div className="r">{P.code}</div></div>
                <div className="rowi"><div className="l"><b>Sign out</b><small>On this device</small></div><div className="r"><form action="/auth/signout" method="post"><button className="btn sm" type="submit">Sign out</button></form></div></div>
                <div className="rowi"><div className="l"><b>Dark theme</b><small>Remembered on this device</small></div><div className="r"><button className={`sw${theme === "dark" ? " on" : ""}`} role="switch" aria-checked={theme === "dark"} aria-label="Dark theme" onClick={() => applyTheme(theme === "dark" ? "light" : "dark")} /></div></div>
                <div className="rowi"><div className="l"><b>Close account</b><small>Email us from this address. Outstanding commission is paid first.</small></div><div className="r"><a className="btn sm danger" href="mailto:team@thefutureclips.com?subject=Close%20partner%20account">Email us</a></div></div>
              </div>
            )}

            <footer className="legal">
              <Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/acceptable-use">Acceptable use</Link><Link href="/refunds">Refunds</Link><Link href="/accessibility">Accessibility</Link>
              <a href="mailto:team@thefutureclips.com">team@thefutureclips.com</a>
            </footer>
          </div>
        </div>
      </div>
      <div className={`toast${toast ? " show" : ""}`} role="status">{toast ?? ""}</div>
    </div>
  );
}
