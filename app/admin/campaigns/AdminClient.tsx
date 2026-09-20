"use client";

/**
 * Add a campaign from the brief an agency sent.
 *
 * Paste the whole thing. The extractor (engine/ingest.mjs, one model call)
 * separates the rules that get a post rejected — a required mention, a banned
 * claim, an app that must appear — from advice about what performs well, and
 * only the first kind is enforced before a render. What it found is shown
 * here to read; saving opens the editor on a PAUSED brief, so nothing reaches
 * a customer's picker until the admin has been through it and pressed Go live.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

type Spec = Record<string, any>;

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** The rules that get a post rejected, pulled out so an admin can see them at a glance. */
function HardRules({ spec }: { spec: Spec }) {
  const R = spec.rules ?? {}, Q = spec.requirements ?? {};
  const rows: [string, string][] = [];
  if (R.required_phrase) rows.push(["Must always write", R.required_phrase]);
  if (R.never_bare) rows.push(["Never write bare", R.never_bare]);
  if (Q.required_mention) rows.push(["Required mention", Q.required_mention]);
  if (Q.must_show_app) rows.push(["App must appear", "on at least one slide"]);
  if (Q.min_slides || Q.max_slides) rows.push(["Slide count", `${Q.min_slides ?? "?"}–${Q.max_slides ?? "?"}`]);
  if ((R.banned_claims ?? []).length) rows.push(["Banned claims", R.banned_claims.join(" · ")]);
  if ((R.banned_topics ?? []).length) rows.push(["Banned topics", R.banned_topics.join(" · ")]);
  if (R.disclosure) rows.push(["Disclosure", R.disclosure]);
  if (!rows.length) return <p className="fc-note">No hard rules found — check that the whole brief was pasted, including the terms.</p>;
  return (
    <table className="fc-table" style={{ marginTop: 8 }}>
      <tbody>{rows.map(([k, v]) => <tr key={k}><td style={{ whiteSpace: "nowrap", color: "var(--fc-muted)" }}>{k}</td><td><b>{v}</b></td></tr>)}</tbody>
    </table>
  );
}

export function AddCampaign({ engine, engineMissing }: { engine: boolean; engineMissing: string }) {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(save: boolean) {
    setBusy(save ? "save" : "read"); setError(null);
    try {
      const r = await fetch("/api/ingest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brief, save }) });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "the brief could not be read"); return; }
      setSpec(j.spec); setCost(j.usd);
      if (j.saved) router.push(`/admin/briefs/${j.spec.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "network error");
    } finally { setBusy(null); }
  }

  const chars = brief.trim().length;
  return (
    <>
      <section className="fc-card">
        <h2>Paste the brief</h2>
        {!engine && <p className="fc-err">The extractor needs the render engine, and {engineMissing}. You can still start from a name below.</p>}
        <div className="fc-form">
          <label>
            <span>Everything the agency sent <em>— payout, rules, naming, app placement, references</em></span>
            <textarea rows={12} value={brief} onChange={(e) => setBrief(e.target.value)} disabled={!engine}
              placeholder={"Campaign: TradeLens App — Reachify\nRate $1.40 per 1k views, min payout $25, max $900 per post…\nMust mention @tradelens.app. Never say 'guaranteed returns'…"} />
          </label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="fc-btn" type="button" onClick={() => run(false)} disabled={!engine || !!busy || chars < 80}>
              {busy === "read" ? "Reading…" : spec ? "Read it again" : "Read the brief"}
            </button>
            <span className="fc-note">{chars < 80 ? `${chars} characters — paste the whole brief` : `${chars.toLocaleString()} characters`}{cost != null ? ` · last read cost $${cost.toFixed(3)}` : ""}</span>
          </div>
          {error && <p className="fc-err" role="alert">{error}</p>}
        </div>
      </section>

      {spec && (
        <section className="fc-card">
          <h2 style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            What it found
            <span className="fc-tag">{spec.niche ?? "?"}</span>
            <span style={{ flex: 1 }} />
            <button className="fc-btn" type="button" onClick={() => run(true)} disabled={!!busy}>
              {busy === "save" ? "Saving…" : "Save and open the editor"}
            </button>
          </h2>
          <p className="fc-note" style={{ marginTop: -4 }}>
            It is saved <b>paused</b>. Check every field in the editor, then press Go live — only then do customers see it.
          </p>
          <table className="fc-table" style={{ marginTop: 12 }}>
            <thead><tr><th>Brand</th><th>Product</th><th>Agency</th><th>Rate</th><th>Payout</th><th>Budget</th><th>Platforms</th></tr></thead>
            <tbody><tr>
              <td><b>{spec.brand}</b><span className="fc-note"> {spec.id}</span></td>
              <td>{spec.product ?? "—"}</td>
              <td>{spec.agency ?? "—"}</td>
              <td>{money(spec.payout?.rate_usd)} / 1k</td>
              <td>{money(spec.payout?.min_payout_usd)} – {money(spec.payout?.max_payout_usd)}</td>
              <td>{money(spec.payout?.budget_total_usd)}</td>
              <td>{(spec.platforms ?? spec.payout?.platforms ?? []).join(", ") || "—"}</td>
            </tr></tbody>
          </table>
          <h3 style={{ marginTop: 18 }}>Hard rules <span className="fc-note">— enforced before any render</span></h3>
          <HardRules spec={spec} />
          {spec.guidance && (spec.guidance.hook_style || (spec.guidance.angles ?? []).length > 0) && (
            <>
              <h3 style={{ marginTop: 18 }}>Guidance <span className="fc-note">— advice the writer follows, not a rule</span></h3>
              {spec.guidance.hook_style && <p className="fc-note">{spec.guidance.hook_style}</p>}
              {!!(spec.guidance.angles ?? []).length && (
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{spec.guidance.angles.map((a: string) => <li key={a}>{a}</li>)}</ul>
              )}
            </>
          )}
          <details style={{ marginTop: 14 }}>
            <summary className="fc-note" style={{ cursor: "pointer" }}>Everything it extracted, as the engine reads it</summary>
            <pre className="fc-mono" style={{ fontSize: 12, lineHeight: 1.5, maxHeight: 340, overflow: "auto", marginTop: 8 }}>{JSON.stringify(spec, null, 2)}</pre>
          </details>
        </section>
      )}
    </>
  );
}
