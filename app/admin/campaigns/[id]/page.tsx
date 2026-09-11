import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePlatformOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCampaign } from "@/lib/db/campaigns";
import AppShell from "@/components/AppShell";
import { updateCampaign, uploadLogo, removeCampaign } from "../../actions";

export const dynamic = "force-dynamic";

/** Brand-kit editor. Platform owners only; writes go through RLS as well. */
export default async function CampaignEditor({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePlatformOwner();
  const { id } = await params;
  const sb = await createClient();
  const c = await getCampaign(sb, id);
  if (!c) notFound();

  const accents = Object.entries(c.brand.colors.accents);
  const save = updateCampaign.bind(null, id);
  const doLogo = uploadLogo.bind(null, id);
  const doRemove = removeCampaign.bind(null, id);

  return (
    <AppShell active="admin" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow"><Link href="/admin">Admin</Link> / {c.id}</p>
        <h1>{c.name}</h1>
        <p className="fc-sub">{c.brand.handle}</p>
      </header>

      <form action={save} className="fc-card fc-form">
        <h2>Brand kit</h2>
        <div className="fc-row">
          <label><span>Campaign name</span><input name="name" defaultValue={c.name} required /></label>
          <label><span>Brand name</span><input name="brand_name" defaultValue={c.brand.name} /></label>
        </div>
        <div className="fc-row">
          <label><span>Handle</span><input name="handle" defaultValue={c.brand.handle} required /></label>
          <label><span>Wordmark</span><input name="wordmark" defaultValue={c.brand.wordmark} /></label>
        </div>
        <div className="fc-row">
          <label><span>Ink</span><input name="ink" type="color" defaultValue={c.brand.colors.ink} /></label>
          <label><span>Paper</span><input name="paper" type="color" defaultValue={c.brand.colors.paper} /></label>
          <label><span>Niche</span><input name="niche" defaultValue={c.niche} required /></label>
        </div>

        <fieldset className="fc-card">
          <legend>Accent colours</legend>
          <p className="fc-note">Leave these matching ink for the monochrome format the top-performing references use.</p>
          {[0, 1, 2].map((i) => {
            const [label, hex] = accents[i] || ["", "#111111"];
            return (
              <div className="fc-row" key={i}>
                <label><span>Name</span><input name={`accent_name_${i}`} defaultValue={label} placeholder="mono" /></label>
                <label><span>Hex</span><input name={`accent_hex_${i}`} type="color" defaultValue={hex} /></label>
              </div>
            );
          })}
        </fieldset>

        <h2>Rules</h2>
        <p className="fc-note">Enforced as a hard validator before packaging. A slideshow that fails is never delivered.</p>
        <div className="fc-row">
          <label><span>Min slides</span><input name="min_slides" type="number" min={1} max={20} defaultValue={c.rules.min_slides} /></label>
          <label><span>Max slides</span><input name="max_slides" type="number" min={1} max={20} defaultValue={c.rules.max_slides} /></label>
          <label><span>Canvas</span><input name="canvas" defaultValue={String(c.rules.canvas)} /></label>
        </div>
        <label><span>Banned claims <em>(one per line)</em></span>
          <textarea name="banned_claims" rows={3} defaultValue={c.rules.banned_claims.join("\n")} /></label>
        <label><span>Banned phrases <em>(one per line)</em></span>
          <textarea name="banned_phrases" rows={3} defaultValue={c.rules.banned_phrases.join("\n")} /></label>
        <div className="fc-form">
          <label className="fc-check">
            <input type="checkbox" name="cta_required_on_last" defaultChecked={c.rules.cta_required_on_last} />
            <span>CTA verb required on the final slide</span>
          </label>
          <label className="fc-check">
            <input type="checkbox" name="zero_gen_mode" defaultChecked={c.rules.zero_gen_mode} />
            <span><strong>Zero-gen mode</strong> — client-supplied visuals only, nothing generated or third-party</span>
          </label>
        </div>

        <h2>Source</h2>
        <label><span>Source video URL or path</span>
          <input name="source_video" defaultValue={c.source.video || ""} placeholder="https://" /></label>

        <button type="submit" className="fc-btn">Save campaign</button>
      </form>

      <section className="fc-card">
        <h2>Logo</h2>
        {c.brand.logo ? (
          <div className="fc-thumb" style={{ maxWidth: 180 }}><Image src={c.brand.logo} alt="" width={160} height={80} unoptimized /></div>
        ) : <p className="fc-note">No logo uploaded.</p>}
        <form action={doLogo} className="fc-form">
          <label><span>Upload logo <em>(png, jpg, webp, svg — under 2 MB)</em></span>
            <input type="file" name="logo" accept=".png,.jpg,.jpeg,.webp,.svg" required /></label>
          <button type="submit" className="fc-btn" data-variant="ghost">Upload logo</button>
        </form>
      </section>

      <section className="fc-card">
        <h2>Delete</h2>
        <form action={doRemove}>
          <button type="submit" className="fc-btn" data-variant="danger">Delete campaign</button>
        </form>
      </section>
    </AppShell>
  );
}
