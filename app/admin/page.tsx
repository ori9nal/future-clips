import Link from "next/link";
import { listCampaigns, libraryFor } from "@/lib/campaigns";
import { createCampaign } from "./actions";

export const dynamic = "force-dynamic";

export default function AdminHome() {
  const campaigns = listCampaigns();

  return (
    <main className="adm">
      <header className="adm-head">
        <div>
          <p className="adm-eyebrow">Admin</p>
          <h1>Partner campaigns</h1>
          <p className="adm-sub">
            Everything an agency hands over once — brand kit, handle, rules, source visuals.
            Clippers open a campaign and generate; they never upload any of this.
          </p>
        </div>
      </header>

      <section className="adm-grid">
        {campaigns.map((c) => {
          const lib = libraryFor(c.niche, "people");
          return (
            <Link key={c.id} href={`/admin/campaigns/${c.id}`} className="adm-card">
              <div className="adm-card-top">
                <span className="adm-swatch" style={{ background: c.brand.colors.ink }} />
                <div>
                  <h2>{c.name}</h2>
                  <p className="adm-handle">{c.brand.handle || "no handle set"}</p>
                </div>
              </div>
              <dl className="adm-meta">
                <div><dt>Niche</dt><dd>{c.niche}</dd></div>
                <div><dt>Slides</dt><dd>{c.rules.min_slides}–{c.rules.max_slides}</dd></div>
                <div><dt>Cutouts</dt><dd>{lib.items.length}</dd></div>
                <div><dt>Zero-gen</dt><dd>{c.rules.zero_gen_mode ? "on" : "off"}</dd></div>
              </dl>
              {c.agency ? <p className="adm-agency">Attributed to {c.agency.code}</p> : null}
            </Link>
          );
        })}
        {!campaigns.length ? <p className="adm-empty">No campaigns yet. Create the first one below.</p> : null}
      </section>

      <section className="adm-new">
        <h2>New campaign</h2>
        <form action={createCampaign} className="adm-form">
          <label>
            <span>Campaign name</span>
            <input name="name" required placeholder="Atlas Performance" />
          </label>
          <label>
            <span>Handle</span>
            <input name="handle" required placeholder="@atlas.performance" />
          </label>
          <label>
            <span>Niche</span>
            <input name="niche" defaultValue="fitness" required />
          </label>
          <label>
            <span>Agency ref code <em>(optional — 25% share)</em></span>
            <input name="agency_code" placeholder="ATLAS25" />
          </label>
          <button type="submit" className="adm-btn">Create campaign</button>
        </form>
      </section>
    </main>
  );
}
