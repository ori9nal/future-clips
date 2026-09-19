import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createCampaign, setBriefStatus, removeBrief } from "./actions";
import type { Viewer } from "@/lib/auth";

/**
 * The admin surface as pure markup, so the real page (with the database
 * behind it) and `/design-preview?view=admin` (fixtures, no session) render
 * exactly the same thing. The page loads, this draws.
 */
export type Fund = { gross_usd: number; reserve_usd: number; spent_usd: number; balance_usd: number; sales: number; share: number; since: string | null };
export type AdminSpec = { id: string; brand: string; niche: string; status: string; content?: { style?: string }; requirements?: { min_slides?: number; max_slides?: number } };
export type AdminCampaign = { id: string; name: string; niche: string; brand: { handle?: string; colors: { ink: string; accents: Record<string, string> } }; rules: { min_slides: number; max_slides: number; zero_gen_mode?: boolean }; agency?: { code?: string } | null };

const usd = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AdminView({ viewer, specs, campaigns, fund, engineOn, readOnly = false }: {
  viewer: Viewer;
  specs: AdminSpec[];
  campaigns: AdminCampaign[];
  fund: Fund | null;
  engineOn: boolean;
  /** the preview renders the same markup with the forms disabled */
  readOnly?: boolean;
}) {
  return (
    <AppShell active="admin" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow">Admin</p>
        <h1>Everything a brand hands over, once.</h1>
        <p className="fc-sub">
          Two kinds of campaign live here: <b>briefs</b> (ingested from an agency brief, what clippers generate against)
          and <b>brand kits</b> (the older admin-authored shape). They are stored apart and never overwrite each other.
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
            <p className="fc-note" style={{ marginTop: 10 }}>
              Every Dodo payment earmarks this share for the model providers; rendering draws it down at real provider cost.
              Keep auto-recharge on in both consoles and top them up from the balance. The share is <code>app_settings.provider_reserve</code>.
            </p>
          </>
        ) : (
          <p className="fc-note">The fund appears after the first Dodo payment (migration 0012, webhook <code>payment.succeeded</code>).</p>
        )}
      </section>

      <section className="fc-card">
        <h2>Briefs <span className="fc-tag">{specs.length}</span></h2>
        <table className="fc-table">
          <thead><tr><th>Brand</th><th>Niche</th><th>Style</th><th>Slides</th><th>Status</th><th /></tr></thead>
          <tbody>
            {specs.map((s) => (
              <tr key={s.id} data-bad={s.status === "paused" ? "1" : undefined}>
                <td><b>{s.brand}</b> <span className="fc-note">{s.id}</span></td>
                <td>{s.niche}</td>
                <td>{s.content?.style ?? "—"}</td>
                <td>{s.requirements?.min_slides ?? "?"}–{s.requirements?.max_slides ?? "?"}</td>
                <td>{s.status}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <form action={setBriefStatus.bind(null, s.id, s.status === "live" ? "paused" : "live")} style={{ display: "inline" }}>
                    <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly}>{s.status === "live" ? "Pause" : "Go live"}</button>
                  </form>{" "}
                  <form action={removeBrief.bind(null, s.id)} style={{ display: "inline" }}>
                    <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly}>Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="fc-grid" style={{ marginBottom: 26 }}>
        {campaigns.map((c) => {
          const accent = Object.values(c.brand.colors.accents)[0] as string;
          return (
            <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="fc-tile">
              <div className="fc-tile-top">
                <span className="fc-sw" style={{ background: c.brand.colors.ink, width: 34, height: 34 }} />
                <span className="fc-sw" style={{ background: accent, width: 34, height: 34 }} />
                <div>
                  <h3>{c.name}</h3>
                  <p className="fc-handle">{c.brand.handle || "no handle set"}</p>
                </div>
              </div>
              <div className="fc-meta">
                <div><span>Niche</span><b>{c.niche}</b></div>
                <div><span>Slides</span><b>{c.rules.min_slides}–{c.rules.max_slides}</b></div>
                <div><span>Zero-gen</span><b>{c.rules.zero_gen_mode ? "on" : "off"}</b></div>
              </div>
              {c.agency ? <p className="fc-tag" style={{ marginTop: 14, display: "inline-block" }}>{c.agency.code}</p> : null}
            </Link>
          );
        })}
        {!campaigns.length ? <p className="fc-note">No brand kits yet. Create the first one below.</p> : null}
      </section>

      <section className="fc-card">
        <h2>New brand kit</h2>
        <form action={createCampaign} className="fc-form">
          <div className="fc-row">
            <label><span>Campaign name</span><input name="name" required placeholder="Meridian Endurance" /></label>
            <label><span>Handle</span><input name="handle" required placeholder="@meridian.endurance" /></label>
          </div>
          <div className="fc-row">
            <label><span>Niche</span><input name="niche" defaultValue="fitness" required /></label>
            <label>
              <span>Agency ref code <em>(optional)</em></span>
              <input name="agency_code" placeholder="MERIDIAN25" />
            </label>
          </div>
          <button type="submit" className="fc-btn" disabled={readOnly}>Create campaign</button>
        </form>
      </section>
    </AppShell>
  );
}
