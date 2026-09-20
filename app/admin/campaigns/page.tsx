import Link from "next/link";
import { requirePlatformOwner } from "@/lib/auth";
import { engineAvailable, ENGINE_MISSING } from "@/lib/engine";
import AppShell from "@/components/AppShell";
import { createBlankBrief } from "../actions";
import { AddCampaign } from "./AdminClient";

export const dynamic = "force-dynamic";

/**
 * Add a campaign: paste the agency's brief and let the extractor read it, or
 * start from a name. Either way the result opens in the brief editor, paused,
 * and goes live only when the admin says so. Platform owners only.
 */
export default async function AdminCampaignsPage() {
  const viewer = await requirePlatformOwner();
  return (
    <AppShell active="admin" viewer={viewer}>
      <header className="fc-head">
        <p className="fc-eyebrow"><Link href="/admin">Admin</Link> · briefs</p>
        <h1>Add a campaign.</h1>
        <p className="fc-sub">
          Paste what the agency sent — the whole email, the PDF&rsquo;s text, the Notion page. It is read for you: the rules that
          get a post rejected are separated from advice about what performs, and you check the result in the editor before
          anyone sees it.
        </p>
      </header>

      <AddCampaign engine={engineAvailable()} engineMissing={ENGINE_MISSING} />

      <section className="fc-card">
        <h2>Or start from a name</h2>
        <p className="fc-note" style={{ marginTop: -4 }}>
          No brief yet? Give it a brand and the editor opens with sensible defaults — 5 to 10 slides, the native look — paused until you go live.
        </p>
        <form action={createBlankBrief} className="fc-form" style={{ marginTop: 12 }}>
          <div className="fc-row">
            <label><span>Brand</span><input name="brand" required maxLength={80} placeholder="TradeLens" /></label>
            <label><span>Product <em>— one line</em></span><input name="product" maxLength={200} placeholder="a chart reader that marks the levels a trader would draw by hand" /></label>
            <label><span>Niche</span><input name="niche" maxLength={40} placeholder="trading" /></label>
          </div>
          <div><button className="fc-btn" data-variant="ghost" type="submit">Open the editor</button></div>
        </form>
      </section>
    </AppShell>
  );
}
