import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCampaign, libraryFor } from "@/lib/campaigns";
import { updateCampaign, uploadLogo, uploadVisuals, removeCampaign } from "../../actions";

export const dynamic = "force-dynamic";

export default async function CampaignEditor({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = getCampaign(id);
  if (!c) notFound();

  const lib = libraryFor(c.niche, "people");
  const accents = Object.entries(c.brand.colors.accents);
  const save = updateCampaign.bind(null, id);
  const doLogo = uploadLogo.bind(null, id);
  const doVisuals = uploadVisuals.bind(null, id);
  const doRemove = removeCampaign.bind(null, id);

  return (
    <main className="adm">
      <header className="adm-head">
        <div>
          <p className="adm-eyebrow">
            <Link href="/admin">Admin</Link> / {c.id}
          </p>
          <h1>{c.name}</h1>
          <p className="adm-sub">{c.brand.handle}</p>
        </div>
      </header>

      <form action={save} className="adm-form adm-panel">
        <h2>Brand kit</h2>
        <div className="adm-row">
          <label><span>Campaign name</span><input name="name" defaultValue={c.name} required /></label>
          <label><span>Brand name</span><input name="brand_name" defaultValue={c.brand.name} /></label>
        </div>
        <div className="adm-row">
          <label><span>Handle</span><input name="handle" defaultValue={c.brand.handle} required /></label>
          <label><span>Wordmark</span><input name="wordmark" defaultValue={c.brand.wordmark} /></label>
        </div>
        <div className="adm-row">
          <label><span>Ink</span><input name="ink" type="color" defaultValue={c.brand.colors.ink} /></label>
          <label><span>Paper</span><input name="paper" type="color" defaultValue={c.brand.colors.paper} /></label>
          <label><span>Niche</span><input name="niche" defaultValue={c.niche} required /></label>
        </div>

        <fieldset className="adm-fieldset">
          <legend>Accent colours</legend>
          <p className="adm-note">
            Leave these matching ink for the monochrome format the top-performing
            references use. Every extra hue is a chromatic cluster the validator counts.
          </p>
          {[0, 1, 2].map((i) => {
            const [label, hex] = accents[i] || ["", "#111111"];
            return (
              <div className="adm-row" key={i}>
                <label><span>Name</span><input name={`accent_name_${i}`} defaultValue={label} placeholder="mono" /></label>
                <label><span>Hex</span><input name={`accent_hex_${i}`} type="color" defaultValue={hex} /></label>
              </div>
            );
          })}
        </fieldset>

        <h2>Rules</h2>
        <p className="adm-note">Enforced as a hard validator before packaging. A carousel that fails is never delivered.</p>
        <div className="adm-row">
          <label><span>Min slides</span><input name="min_slides" type="number" min={1} max={20} defaultValue={c.rules.min_slides} /></label>
          <label><span>Max slides</span><input name="max_slides" type="number" min={1} max={20} defaultValue={c.rules.max_slides} /></label>
          <label><span>Canvas</span><input name="canvas" defaultValue={c.rules.canvas} /></label>
        </div>
        <label><span>Banned claims <em>(one per line)</em></span>
          <textarea name="banned_claims" rows={3} defaultValue={c.rules.banned_claims.join("\n")} /></label>
        <label><span>Banned phrases <em>(one per line)</em></span>
          <textarea name="banned_phrases" rows={3} defaultValue={c.rules.banned_phrases.join("\n")} /></label>
        <div className="adm-row adm-checks">
          <label className="adm-check">
            <input type="checkbox" name="cta_required_on_last" defaultChecked={c.rules.cta_required_on_last} />
            <span>CTA verb required on the final slide</span>
          </label>
          <label className="adm-check">
            <input type="checkbox" name="zero_gen_mode" defaultChecked={c.rules.zero_gen_mode} />
            <span><strong>Zero-gen mode</strong> — client-supplied visuals only, nothing generated or third-party</span>
          </label>
        </div>

        <h2>Source</h2>
        <label><span>Source video URL or path <em>(frames are scene-detected from this)</em></span>
          <input name="source_video" defaultValue={c.source.video || ""} placeholder="https:// or ./media/campaign.mp4" /></label>

        <button type="submit" className="adm-btn">Save campaign</button>
      </form>

      <section className="adm-panel">
        <h2>Logo</h2>
        {c.brand.logo ? (
          <div className="adm-logo"><Image src={c.brand.logo} alt="" width={160} height={80} unoptimized /></div>
        ) : <p className="adm-note">No logo uploaded.</p>}
        <form action={doLogo} className="adm-form">
          <label><span>Upload logo <em>(png, jpg, webp, svg)</em></span>
            <input type="file" name="logo" accept=".png,.jpg,.jpeg,.webp,.svg" required /></label>
          <button type="submit" className="adm-btn adm-btn-ghost">Upload logo</button>
        </form>
      </section>

      <section className="adm-panel">
        <h2>Source visuals</h2>
        <p className="adm-note">
          Each upload is matted, cleaned and gated on halo, stray blobs and subject tone, then
          added to the <strong>{c.niche}</strong> library. Anything that fails is rejected with the
          measured reason rather than quietly accepted. Matting is ~5s per image.
        </p>
        <form action={doVisuals} className="adm-form">
          <label><span>Upload visuals <em>(multiple allowed)</em></span>
            <input type="file" name="visuals" accept="image/*" multiple required /></label>
          <button type="submit" className="adm-btn adm-btn-ghost">Upload and matte</button>
        </form>
      </section>

      <section className="adm-panel">
        <h2>Cutout library <span className="adm-count">{lib.items.length}</span></h2>
        {lib.items.length ? (
          <ul className="adm-lib">
            {lib.items.map((it: any) => (
              <li key={it.id}>
                <div className="adm-thumb">
                  <Image src={"/api/library/" + String(it.bwFile || it.file).replace(/^assets\/library\//, "")} alt="" width={110} height={150} unoptimized />
                </div>
                <p className="adm-lib-id">{it.provider}</p>
                <p className="adm-lib-credit">{it.credit?.author || it.credit?.license || "—"}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-note">
            No cutouts yet. Upload visuals above, or build a stock library with{" "}
            <code>node --env-file=.env.local tools/build-library.mjs --niche {c.niche}</code>.
          </p>
        )}
      </section>

      <section className="adm-panel adm-danger">
        <h2>Delete</h2>
        <form action={doRemove}>
          <button type="submit" className="adm-btn adm-btn-danger">Delete campaign</button>
        </form>
      </section>
    </main>
  );
}
