import Link from "next/link";
import { saveBrief, uploadBriefAsset } from "../actions";
import type { Spec } from "@/lib/specs";

/**
 * One brief, whole, as markup — so `/admin/briefs/<id>` (the database behind
 * it) and `/design-preview?view=brief` (a fixture, no session) show exactly
 * the same page. The renderer reads some of these fields (palette, logo, app
 * card, required mention), the copy model reads others (guidance, audience,
 * reference notes), and the rest is what a person needs to run the campaign:
 * who is paying, what it is worth, when it closes.
 */

/** Blank rather than "undefined" in an input. */
const v = (x: unknown) => (x === null || x === undefined ? "" : String(x));
const lines = (x?: string[] | null) => (x ?? []).join("\n");

/** One upload slot: shows what is there, takes a replacement. */
function Asset({ id, slot, label, src, readOnly }: { id: string; slot: string; label: string; src?: string | null; readOnly?: boolean }) {
  return (
    <form action={uploadBriefAsset.bind(null, id)} className="brief-asset">
      <input type="hidden" name="slot" value={slot} />
      <span className="brief-asset-box">
        {src ? <img src={src} alt="" /> : <em>none</em>}
      </span>
      <label>{label}<input type="file" name="file" accept="image/png,image/jpeg,image/webp" required disabled={readOnly} /></label>
      <button className="fc-btn" data-variant="ghost" data-size="sm" type="submit" disabled={readOnly}>Upload</button>
    </form>
  );
}

export default function BriefForm({ spec: s, readOnly = false }: { spec: Spec; readOnly?: boolean }) {
  const id = s.id;
  const refs = [...(s.references ?? []), {}, {}].slice(0, 8);

  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Admin</p>
        <h1>{s.brand}</h1>
        <p className="lede">
          <code>{s.id}</code> · {s.niche} · {s.status ?? "live"}. Everything below is saved into the brief the
          engine reads. <Link href="/admin">Back to admin</Link>
        </p>
      </header>

      <form className="admin-form" action={saveBrief.bind(null, id)}>
        <fieldset>
          <legend>Brand</legend>
          <div className="grid">
            <label>Brand<input name="brand" defaultValue={v(s.brand)} required /></label>
            <label>Wordmark<input name="wordmark" defaultValue={v(s.wordmark)} placeholder="how the brand writes itself" /></label>
            <label>Brand handle<input name="handle" defaultValue={v(s.handle)} placeholder="@brand" /></label>
            <label>Niche<input name="niche" defaultValue={v(s.niche)} required /></label>
            <label className="wide">Product<input name="product" defaultValue={v(s.product)} required /></label>
            <label>Palette (comma separated)<input name="palette" defaultValue={(s.assets?.palette ?? []).join(", ")} /></label>
            <label>Look<input name="look" defaultValue={v(s.assets?.look)} placeholder="cinematic, clinical, pastel…" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Who is paying</legend>
          <div className="grid">
            <label>Advertiser<input name="advertiser" defaultValue={v(s.advertiser ?? s.client?.advertiser?.name)} /></label>
            <label>Advertiser contact<input name="advertiser_contact" defaultValue={v(s.client?.advertiser?.contact)} placeholder="name, email" /></label>
            <label>Advertiser site<input name="advertiser_site" defaultValue={v(s.client?.advertiser?.site)} /></label>
            <label>Agency<input name="agency" defaultValue={v(s.agency ?? s.client?.agency?.name)} /></label>
            <label>Agency contact<input name="agency_contact" defaultValue={v(s.client?.agency?.contact)} /></label>
            <label>Agency code<input name="agency_code" defaultValue={v(s.client?.agency?.code)} placeholder="REACHIFY" /></label>
            <label>Agency commission %<input name="agency_commission_pct" type="number" step="0.5" defaultValue={v(s.client?.agency?.commission_pct)} /></label>
            <label>Opens<input name="opens" type="date" defaultValue={v(s.client?.opens)} /></label>
            <label>Closes<input name="closes" type="date" defaultValue={v(s.client?.closes)} /></label>
            <label>Brief came from<input name="source_name" defaultValue={v(s.client?.source?.name)} placeholder="who sent it" /></label>
            <label>Brief link<input name="source_url" defaultValue={v(s.client?.source?.url)} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Budget</legend>
          <div className="grid">
            <label>Rate per 1k USD<input name="rate_usd" type="number" step="0.01" defaultValue={v(s.payout?.rate_usd)} /></label>
            <label>Min payout USD<input name="min_payout_usd" type="number" step="0.01" defaultValue={v(s.payout?.min_payout_usd)} /></label>
            <label>Max payout USD<input name="max_payout_usd" type="number" step="0.01" defaultValue={v(s.payout?.max_payout_usd)} /></label>
            <label>Budget total USD<input name="budget_total_usd" type="number" step="1" defaultValue={v(s.payout?.budget_total_usd)} /></label>
            <label>Budget left USD<input name="budget_remaining_usd" type="number" step="1" defaultValue={v(s.payout?.budget_remaining_usd)} /></label>
            <label>Review days<input name="review_days" type="number" step="1" defaultValue={v(s.payout?.review_days)} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>What it wants back</legend>
          <div className="grid">
            <label>Sets wanted<input name="sets_wanted" type="number" step="1" defaultValue={v(s.deliverables?.sets_wanted)} /></label>
            <label>Due<input name="due" type="date" defaultValue={v(s.deliverables?.due)} /></label>
            <label>Platforms (comma separated)<input name="platforms" defaultValue={(s.deliverables?.platforms ?? s.payout?.platforms ?? []).join(", ")} /></label>
            <label>CTA link<input name="cta_url" defaultValue={v(s.deliverables?.cta_url)} /></label>
            <label>Tracking link<input name="tracking_url" defaultValue={v(s.deliverables?.tracking_url)} /></label>
            <label className="wide">Audience<textarea name="audience" rows={2} defaultValue={v(s.deliverables?.audience)} placeholder="who the post is for — the copy model reads this" /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Requirements</legend>
          <div className="grid">
            <label>Min slides<input name="min_slides" type="number" step="1" defaultValue={v(s.requirements?.min_slides)} /></label>
            <label>Max slides<input name="max_slides" type="number" step="1" defaultValue={v(s.requirements?.max_slides)} /></label>
            <label>Aspect<input name="aspect" defaultValue={v(s.requirements?.aspect)} placeholder="9:16" /></label>
            <label>Required mention<input name="required_mention" defaultValue={v(s.requirements?.required_mention)} /></label>
            <label>Must show the app<input name="must_show_app" type="checkbox" defaultChecked={!!s.requirements?.must_show_app} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Rules</legend>
          <div className="grid">
            <label className="wide">Banned claims (one per line)<textarea name="banned_claims" rows={3} defaultValue={lines(s.rules?.banned_claims)} /></label>
            <label className="wide">Banned topics (one per line)<textarea name="banned_topics" rows={2} defaultValue={lines(s.rules?.banned_topics)} /></label>
            <label className="wide">Tone<textarea name="tone" rows={2} defaultValue={v(s.rules?.tone)} /></label>
            <label>Disclosure<input name="disclosure" defaultValue={v(s.rules?.disclosure)} placeholder="#ad" /></label>
            <label>Phrase that must appear<input name="required_phrase" defaultValue={v(s.rules?.required_phrase)} /></label>
            <label>Form forbidden on its own<input name="never_bare" defaultValue={v(s.rules?.never_bare)} /></label>
            <label>No exclamation marks<input name="no_exclamation" type="checkbox" defaultChecked={!!s.rules?.no_exclamation} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>How to write it</legend>
          <div className="grid">
            <label className="wide">Hook style<textarea name="hook_style" rows={2} defaultValue={v(s.guidance?.hook_style)} /></label>
            <label className="wide">Angles that work (one per line)<textarea name="angles" rows={3} defaultValue={lines(s.guidance?.angles)} /></label>
            <label className="wide">Notes (one per line)<textarea name="notes" rows={3} defaultValue={lines(s.guidance?.notes)} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>App Store card</legend>
          <div className="grid">
            <label>Title<input name="app_title" defaultValue={v(s.app_store?.title)} /></label>
            <label>Subtitle<input name="app_subtitle" defaultValue={v(s.app_store?.subtitle)} /></label>
            <label>Developer<input name="app_developer" defaultValue={v(s.app_store?.developer)} /></label>
            <label>Rating<input name="app_rating" type="number" step="0.1" min="0" max="5" defaultValue={v(s.app_store?.rating)} /></label>
            <label>Ratings count<input name="app_ratings" defaultValue={v(s.app_store?.ratings)} placeholder="12.4K" /></label>
            <label>Age<input name="app_age" defaultValue={v(s.app_store?.age)} placeholder="4+" /></label>
            <label>Category<input name="app_category" defaultValue={v(s.app_store?.category)} placeholder="Health &amp; Fitness" /></label>
            <label>Card theme
              <select name="app_theme" defaultValue={v(s.app_store?.theme) || "dark"}>
                <option value="dark">dark</option>
                <option value="light">light</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>References to imitate</legend>
          {refs.map((r, i) => (
            <div className="grid" key={i}>
              <label>Link<input name={`ref_url_${i}`} defaultValue={v(r.url)} /></label>
              <label>Kind
                <select name={`ref_kind_${i}`} defaultValue={v(r.kind) || "post"}>
                  <option value="post">post</option>
                  <option value="screenshot">screenshot</option>
                  <option value="moodboard">moodboard</option>
                  <option value="brand">brand</option>
                </select>
              </label>
              <label className="wide">What to take from it<input name={`ref_note_${i}`} defaultValue={v(r.note)} /></label>
              <input type="hidden" name={`ref_path_${i}`} value={v(r.path)} />
            </div>
          ))}
          <p className="note">Upload the picture itself below; the link and the note travel with it.</p>
        </fieldset>

        <div className="actions">
          <button className="fc-btn" type="submit" disabled={readOnly}>Save brief</button>
          <Link className="fc-btn" data-variant="ghost" href="/admin">Cancel</Link>
        </div>
      </form>

      <section className="admin-form brief-artwork">
        <fieldset>
          <legend>Artwork</legend>
          <div className="brief-assets">
            <Asset id={id} readOnly={readOnly} slot="logo" label="Brand logo" src={s.assets?.logo} />
            <Asset id={id} readOnly={readOnly} slot="app_icon" label="App icon" src={s.assets?.app_icon} />
            <Asset id={id} readOnly={readOnly} slot="app_screen" label="App screenshot" src={s.assets?.app_screen} />
            {refs.slice(0, 4).map((r, i) => (
              <Asset key={i} id={id} readOnly={readOnly} slot={`ref_${i}`} label={`Reference ${i + 1}`} src={r.path} />
            ))}
          </div>
          <p className="note">PNG, JPG or WebP, up to 4 MB. Each upload saves immediately.</p>
        </fieldset>
      </section>
    </main>
  );
}
