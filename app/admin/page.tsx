import Link from "next/link";
import { listCampaigns, libraryFor } from "@/lib/campaigns";
import AppShell from "@/components/AppShell";
import { createCampaign } from "./actions";

export const dynamic = "force-dynamic";

export default function AdminHome() {
  const campaigns = listCampaigns();

  return (
    <AppShell active="admin">
      <header className="fc-head">
        <p className="fc-eyebrow">Campaigns</p>
        <h1>Everything a brand hands over, once.</h1>
        <p className="fc-sub">
          Brand kit, handle, rules and source visuals. A clipper opens a campaign and generates —
          they never upload any of this.
        </p>
      </header>

      <section className="fc-grid" style={{ marginBottom: 26 }}>
        {campaigns.map((c) => {
          const lib = libraryFor(c.niche, "people");
          const accent = Object.values(c.brand.colors.accents)[0] as string;
          return (
            <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="fc-tile">
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
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
                <div><span>Images</span><b>{lib.items.length}</b></div>
                <div><span>Zero-gen</span><b>{c.rules.zero_gen_mode ? "on" : "off"}</b></div>
              </div>
              {c.agency ? (
                <p className="fc-tag" style={{ marginTop: 14, display: "inline-block" }}>
                  {c.agency.code} · 25% share
                </p>
              ) : null}
            </Link>
          );
        })}
        {!campaigns.length ? <p className="fc-note">No campaigns yet. Create the first one below.</p> : null}
      </section>

      <section className="fc-card">
        <h2>New campaign</h2>
        <form action={createCampaign} className="fc-form">
          <div className="fc-row">
            <label><span>Campaign name</span><input name="name" required placeholder="Meridian Endurance" /></label>
            <label><span>Handle</span><input name="handle" required placeholder="@meridian.endurance" /></label>
          </div>
          <div className="fc-row">
            <label><span>Niche</span><input name="niche" defaultValue="fitness" required /></label>
            <label>
              <span>Agency ref code <em>(optional — 25% share)</em></span>
              <input name="agency_code" placeholder="MERIDIAN25" />
            </label>
          </div>
          <button type="submit" className="fc-btn">Create campaign</button>
        </form>
      </section>
    </AppShell>
  );
}
