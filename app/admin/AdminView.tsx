import Link from "next/link";
import AppShell from "@/components/AppShell";
import { setBriefStatus, removeBrief, makeSample, endAdminSessions, resetAuthenticator, syncCheckoutDescriptions } from "./actions";
import type { Viewer } from "@/lib/auth";

/**
 * The admin surface as pure markup, so the real page (with the database
 * behind it) and `/design-preview?view=admin` (fixtures, no session) render
 * exactly the same thing. The page loads, this draws.
 */
export type Fund = {
  gross_usd: number; reserve_usd: number; spent_usd: number; balance_usd: number; sales: number; share: number; since: string | null;
  /** the split (migration 0021): what each provider has consumed, its daily burn, and what to keep loaded there */
  anthropic_usd: number; openai_usd: number; unsplit_usd: number;
  anthropic_day: number; openai_day: number;
  anthropic_float: number; openai_float: number; float_days: number;
};
export type DemoActivity = {
  madeToday: number; perDay: number; perVisitor: number;
  spentThisMonth: number; budget: number;
  /** the fixed number of carousels the demo has left at all (0026); null when no budget is set */
  left: number | null; allowed: number | null; since: string | null;
  recent: { id: string; campaign: string; ask: string; status: string; slides: number | null; cost: number | null; at: string }[];
};
export type AdminSession = { id: string; agent: string | null; ip: string | null; created_at: string; expires_at: string };
export type AdminSpec = { id: string; org_id?: string | null; brand: string; niche: string; status: string; content?: { style?: string }; requirements?: { min_slides?: number; max_slides?: number }; sample?: { urls?: string[] } | null };
export type AdminCampaign = { id: string; name: string; niche: string; brand: { handle?: string; colors: { ink: string; accents: Record<string, string> } }; rules: { min_slides: number; max_slides: number; zero_gen_mode?: boolean }; agency?: { code?: string } | null };

const usd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminView({ viewer, specs, campaigns, fund, engineOn, sessions = [], demo = null, demoOrgId = null, unlockHours = 8, readOnly = false }: {
  viewer: Viewer;
  specs: AdminSpec[];
  campaigns: AdminCampaign[];
  fund: Fund | null;
  engineOn: boolean;
  /** admin sessions open right now for this owner (migration 0025) */
  sessions?: AdminSession[];
  /** what strangers have made in the shared demo workspace */
  demo?: DemoActivity | null;
  /** the demo workspace, whose briefs are fixtures nobody else sees (0029) */
  demoOrgId?: string | null;
  /** how long one code keeps admin open */
  unlockHours?: number;
  /** the preview renders the same markup with the forms disabled */
  readOnly?: boolean;
}) {
  // The demo's briefs are fixtures nobody but its visitors sees (0029). They
  // are listed under the demo, not among the briefs customers get.
  const demoSpecs = demoOrgId ? specs.filter((s) => s.org_id === demoOrgId) : [];
  const platformSpecs = demoOrgId ? specs.filter((s) => s.org_id !== demoOrgId) : specs;
  const briefRows = (rows: AdminSpec[]) => rows.map((s) => (
              <tr key={s.id} data-bad={s.status === "paused" ? "1" : undefined}>
                <td>
                  <b>{s.brand}</b> <span className="fc-note">{s.id}</span>
                  {s.org_id && s.org_id !== demoOrgId ? <> <span className="fc-tag" title="Owned by the admins' workspace: the three of you see it, customers do not.">admins only</span></> : null}
                </td>
                <td>{s.niche}</td>
                <td>{s.content?.style ?? "—"}</td>
                <td>{s.requirements?.min_slides ?? "?"}–{s.requirements?.max_slides ?? "?"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {s.sample?.urls?.length
                    ? <span className="fc-tag">{s.sample.urls.length} slides</span>
                    : <span className="fc-note">none</span>}{" "}
                  <form action={makeSample.bind(null, s.id)} style={{ display: "inline" }}>
                    <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly || s.status !== "live"}
                      title={s.status === "live" ? "Render three public slides for this brief" : "Only a live brief gets a sample"}>
                      {s.sample?.urls?.length ? "Remake" : "Make"}
                    </button>
                  </form>
                </td>
                <td>{s.status}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="fc-btn" data-variant="ghost" data-size="sm" href={`/admin/briefs/${s.id}`}>Edit</Link>{" "}
                  <form action={setBriefStatus.bind(null, s.id, s.status === "live" ? "paused" : "live")} style={{ display: "inline" }}>
                    <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly}>{s.status === "live" ? "Pause" : "Go live"}</button>
                  </form>{" "}
                  <form action={removeBrief.bind(null, s.id)} style={{ display: "inline" }}>
                    <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly}>Delete</button>
                  </form>
                </td>
              </tr>
  ));

  return (
    <AppShell active="admin" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow">Admin</p>
        <h1>Everything a brand hands over, once.</h1>
        <p className="fc-sub">
          A <b>brief</b> is what an agency sends and what clippers generate against. Add one by pasting it — the rules that
          get a post rejected are read out of it and enforced before every render — then check it in the editor and go live.
        </p>
        <p className="fc-note" style={{ marginTop: 10 }}>
          <Link href="/admin/invites">Invites &amp; access</Link> · <Link href="/admin/partners">Partners</Link>
          {engineOn
            ? <> · <Link href="/admin/campaigns">Briefs &amp; ingest</Link> · <Link href="/studio">Studio</Link></>
            : <> · <span className="fc-note">Briefs ingest and the studio arrive with the render engine.</span></>}
        </p>
      </header>

      <section className="fc-card">
        <h2>Provider fund <span className="fc-tag">{fund ? `${Math.round(fund.share * 100)}% of every sale` : "not connected"}</span></h2>
        {fund ? (
          <>
            <table className="fc-table">
              <thead><tr><th>Sales</th><th>Gross</th><th>Earmarked for Anthropic + OpenAI</th><th>Consumed by rendering</th><th>Balance</th></tr></thead>
              <tbody>
                <tr>
                  <td>{fund.sales}{fund.since ? <span className="fc-note"> since {new Date(fund.since).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span> : null}</td>
                  <td>{usd(fund.gross_usd)}</td>
                  <td>{usd(fund.reserve_usd)}</td>
                  <td>{usd(fund.spent_usd)}</td>
                  <td data-bad={fund.balance_usd < 0 ? "1" : undefined}><b>{usd(fund.balance_usd)}</b></td>
                </tr>
              </tbody>
            </table>
            <p className="fc-note" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span>The descriptions a buyer reads at Dodo&rsquo;s checkout are written from the plans table — by the poller once a day, or now:</span>
              <form action={syncCheckoutDescriptions} style={{ display: "inline" }}>
                <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly}>Rewrite the checkout copy</button>
              </form>
            </p>
            {(() => {
              // A day of burn across both providers turns the balance into the
              // only number that answers "when do I have to act": days of
              // rendering the earmark still covers.
              const day = (fund.anthropic_day ?? 0) + (fund.openai_day ?? 0);
              if (day <= 0) return null;
              const days = Math.floor(fund.balance_usd / day);
              const tone = days < 7 ? "danger" : days < 21 ? "warn" : "ok";
              return (
                <p className={`fc-note`} style={{ marginTop: 12 }}>
                  <span className="fc-tag" data-tone={tone}>{days} days of runway</span>{" "}
                  at {usd(day)} a day across both providers. {days < 7
                    ? "Top both consoles up now — rendering stops when either account empties."
                    : days < 21
                      ? "Worth topping up on your next billing day."
                      : "No action needed."}
                </p>
              );
            })()}
            <div className="fc-grid" style={{ marginTop: 14 }}>
              {[
                { name: "Anthropic", what: "writes the copy", spent: fund.anthropic_usd, day: fund.anthropic_day, float: fund.anthropic_float, href: "https://console.anthropic.com/settings/billing" },
                { name: "OpenAI", what: "draws the frames", spent: fund.openai_usd, day: fund.openai_day, float: fund.openai_float, href: "https://platform.openai.com/settings/organization/billing/overview" },
              ].map((p) => (
                <div key={p.name} className="fc-tile" style={{ cursor: "default" }}>
                  <div>
                    <h3>{p.name}</h3>
                    <p className="fc-handle">{p.what}</p>
                  </div>
                  <div className="fc-meta">
                    <div><span>Consumed</span><b>{usd(p.spent)}</b></div>
                    <div><span>A day</span><b>{p.day > 0 ? usd(p.day) : "—"}</b></div>
                    <div><span>Keep loaded</span><b>{usd(p.float)}</b></div>
                  </div>
                  <p className="fc-note" style={{ marginTop: 8 }}>
                    {p.day > 0
                      ? <>{fund.float_days} days at the measured rate. </>
                      : <>No rendering measured yet, so this is the floor. </>}
                    <a href={p.href} target="_blank" rel="noreferrer noopener">Top up →</a>
                  </p>
                </div>
              ))}
            </div>
            <p className="fc-note" style={{ marginTop: 10 }}>
              Every Dodo payment earmarks <b>{Math.round(fund.share * 100)}%</b> of it for the model providers; rendering draws the
              earmark down at real provider cost, and each set records what it spent with each of them separately
              (<code>spend_ledger.copy_usd</code> / <code>art_usd</code>, migration 0021). Providers cannot be paid by API, so
              keep auto-recharge on in both consoles and hold the “keep loaded” figure there — it is {fund.float_days} days of the
              measured burn, never less than the floor. The share is <code>app_settings.provider_reserve</code>; the float is
              <code>app_settings.provider_float</code>.
              {fund.unsplit_usd > 0 ? <> {usd(fund.unsplit_usd)} was spent before the split existed and is not attributed.</> : null}
            </p>
          </>
        ) : (
          <p className="fc-note">The fund appears after the first Dodo payment (migration 0012, webhook <code>payment.succeeded</code>).</p>
        )}
      </section>

      <section className="fc-card">
        <h2>Admin access <span className="fc-tag">a code every time</span></h2>
        <p className="fc-note">
          Admin opens on a six-digit code from your authenticator and stays open on that browser for
          {" "}{unlockHours} hours. The code is generated on your phone, so reaching your mailbox is not enough to
          reach your campaigns, your fund or your customers. A code works once — one seen over your shoulder
          cannot be used again inside its ninety seconds.
        </p>
        {sessions.length > 0 && (
          <table className="fc-table" style={{ marginTop: 12 }}>
            <thead><tr><th>Open since</th><th>Until</th><th>Browser</th><th>From</th></tr></thead>
            <tbody>
              {sessions.map((u) => (
                <tr key={u.id}>
                  <td>{new Date(u.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  <td>{new Date(u.expires_at).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" })}</td>
                  <td>{u.agent ?? "—"}</td>
                  <td className="fc-note">{u.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <form action={endAdminSessions}>
            <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly}>
              Sign out of admin everywhere
            </button>
          </form>
          <form action={resetAuthenticator}>
            <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly}>
              Set up a new authenticator
            </button>
          </form>
        </div>
      </section>

      {demo && (
        <section className="fc-card">
          <h2>The demo{" "}
            {demo.left !== null && (
              <span className="fc-tag" data-tone={demo.left === 0 ? "warn" : demo.left <= 2 ? "warn" : undefined}>
                {demo.left === 0 ? "no carousels left" : `${demo.left} of ${demo.allowed} left`}
              </span>
            )}
            <span className="fc-tag" data-tone={demo.madeToday >= demo.perDay ? "warn" : undefined}>{demo.madeToday} of {demo.perDay} today</span>
          </h2>
          <p className="fc-note">
            Everyone you send the link to shares one workspace, so this is every carousel strangers have made
            with it. Each visitor may make {demo.perVisitor} a day and the workspace {demo.perDay}; between them they
            have spent {usd(demo.spentThisMonth)} of the {usd(demo.budget)} this month allows.
            {demo.left !== null && demo.allowed !== null && (
              <> On top of that the demo has a fixed budget of {demo.allowed} carousels
                {demo.since ? ` from ${new Date(demo.since).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""},
                and {demo.left === 0 ? "it is spent" : `${demo.left} of those are left`}. Raise it, or start the count again,
                with the <code>demo_budget</code> row in <code>app_settings</code>.</>
            )} When anything runs out the demo stops making anything — the examples stay on screen.
          </p>
          {demo.recent.length > 0 ? (
            <table className="fc-table" style={{ marginTop: 12 }}>
              <thead><tr><th>What they asked for</th><th>Campaign</th><th>Slides</th><th>Cost</th><th>When</th></tr></thead>
              <tbody>
                {demo.recent.map((r) => (
                  <tr key={r.id} data-bad={r.status === "failed" ? "1" : undefined}>
                    <td><b>{r.ask}</b></td>
                    <td className="fc-note">{r.campaign}</td>
                    <td>{r.slides ?? (r.status === "failed" ? "—" : "…")}</td>
                    <td className="n">{r.cost === null ? "—" : usd(r.cost)}</td>
                    <td className="fc-note">{new Date(r.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="fc-note" style={{ marginTop: 10 }}>Nobody has made anything with the demo yet.</p>}
          {demoSpecs.length > 0 && (
            <>
              <h3 style={{ marginTop: 22 }}>Demo briefs <span className="fc-tag">{demoSpecs.length}</span></h3>
              <p className="fc-note">What the demo&rsquo;s visitors pick from. Fixtures in the demo workspace; customers never see them.</p>
              <table className="fc-table" style={{ marginTop: 12 }}>
                <thead><tr><th>Brand</th><th>Niche</th><th>Style</th><th>Slides</th><th>Sample</th><th>Status</th><th /></tr></thead>
                <tbody>{briefRows(demoSpecs)}</tbody>
              </table>
            </>
          )}
        </section>
      )}

      <section className="fc-card">
        <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          Briefs <span className="fc-tag">{platformSpecs.length}</span>
          <span style={{ flex: 1 }} />
          <Link className="fc-btn" data-size="sm" href="/admin/campaigns">Add a campaign</Link>
        </h2>
        <p className="fc-note" style={{ marginTop: -6 }}>Every workspace sees a brief added here unless it is tagged <span className="fc-tag">admins only</span>. The demo&rsquo;s own briefs are under <b>The demo</b>.</p>
        {!platformSpecs.length && <p className="fc-note" style={{ marginTop: 10 }}>No briefs yet. Customers see an empty picker until one is added.</p>}
        <table className="fc-table">
          <thead><tr><th>Brand</th><th>Niche</th><th>Style</th><th>Slides</th><th>Sample</th><th>Status</th><th /></tr></thead>
          <tbody>
            {briefRows(platformSpecs)}
          </tbody>
        </table>
      </section>

      {campaigns.length > 0 && (
        // the older admin-authored "brand kit" shape: none are made any more
        // (0029 deleted the fixtures), but one that exists is still reachable
        <section className="fc-grid" style={{ marginBottom: 26 }}>
          {campaigns.map((c) => (
            <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="fc-tile">
              <div className="fc-tile-top"><div><h3>{c.name}</h3><p className="fc-handle">{c.brand.handle || "brand kit"}</p></div></div>
            </Link>
          ))}
        </section>
      )}
    </AppShell>
  );
}
