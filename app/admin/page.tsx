import Link from "next/link";
import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { engineAvailable } from "@/lib/engine";
import { listCampaigns, listSpecs } from "@/lib/db/campaigns";
import AppShell from "@/components/AppShell";
import { createCampaign, setBriefStatus, removeBrief } from "./actions";

export const dynamic = "force-dynamic";

/** Platform owners only — requirePlatformOwner() sends anyone else to /app. */
export default async function AdminHome() {
  const viewer = await requirePlatformOwner();
  const sb = await createClient();
  const [campaigns, specs] = await Promise.all([listCampaigns(sb), listSpecs(sb)]);

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
          {engineAvailable()
            ? <> · <Link href="/admin/campaigns">Briefs &amp; ingest</Link> · <Link href="/studio">Studio</Link></>
            : <> · <span className="fc-note">Briefs ingest and the studio arrive with the render engine.</span></>}
        </p>
      </header>

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
                    <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit">{s.status === "live" ? "Pause" : "Go live"}</button>
                  </form>{" "}
                  <form action={removeBrief.bind(null, s.id)} style={{ display: "inline" }}>
                    <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit">Delete</button>
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
          <button type="submit" className="fc-btn">Create campaign</button>
        </form>
      </section>
    </AppShell>
  );
}
