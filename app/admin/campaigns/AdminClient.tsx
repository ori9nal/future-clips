"use client";

import { useState } from "react";

type Spec = any;

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** The rules that get a post rejected, pulled out so an admin can see them at a glance. */
function HardRules({ spec }: { spec: Spec }) {
  const R = spec.rules ?? {}, Q = spec.requirements ?? {};
  const rows: [string, string][] = [];
  if (R.required_phrase) rows.push(["Must always write", R.required_phrase]);
  if (R.never_bare) rows.push(["Never write bare", R.never_bare]);
  if (Q.must_show_app) {
    const span = (a: number[], one: (n: number) => string, many: (r: string) => string) => (a[0] === a[1] ? one(a[0]) : many(a.join("–")));
    const p = (Q.app_placement ?? []).map((x: any) => `${span(x.when_slides, (n) => `${n} slides`, (r) => `${r} slides`)} → ${span(x.on_slides, (n) => `slide ${n}`, (r) => `slides ${r}`)}`);
    rows.push(["App must appear", p.length ? p.join(" · ") : "somewhere in the set"]);
  }
  if (Q.min_slides || Q.max_slides) rows.push(["Slide count", `${Q.min_slides ?? "?"}–${Q.max_slides ?? "?"}`]);
  if (Q.first_slide_must_be_hook) rows.push(["Slide 1", "must be the hook"]);
  if ((R.banned_claims ?? []).length) rows.push(["Banned claims", R.banned_claims.join(" · ")]);
  if (!rows.length) return <p className="hint">No hard rules extracted — check the brief pasted in full.</p>;
  return (
    <dl className="hard">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

export function AdminClient({ campaigns }: { campaigns: Spec[] }) {
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [spec, setSpec] = useState<Spec | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function extract(save: boolean) {
    setBusy(true); setError(null); if (!save) { setSpec(null); setSaved(null); }
    try {
      const r = await fetch("/api/ingest", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, save }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "extraction failed");
      else {
        setSpec(j.spec); setCost(j.usd);
        if (j.saved) { setSaved(j.spec.id); setTimeout(() => window.location.reload(), 900); }
      }
    } catch (e: any) {
      setError(e?.message ?? "network error");
    } finally { setBusy(false); }
  }

  return (
    <>

      <section className="panel col">
        <div className="field">
          <label htmlFor="brief">Paste the campaign brief</label>
          <textarea
            id="brief" rows={12} value={brief} onChange={(e) => setBrief(e.target.value)}
            placeholder="Paste the whole thing — payout, rules, naming requirements, app placement, everything. The extractor separates rules that get a post rejected from advice about what performs well."
          />
          <p className="hint">{brief.trim().length} characters</p>
        </div>
        <div className="row-actions">
          <button className="primary" onClick={() => extract(false)} disabled={busy || brief.trim().length < 80}>
            {busy ? "Reading…" : "Extract rules"}
          </button>
          {spec && (
            <button className="ghost" onClick={() => extract(true)} disabled={busy}>
              Save as campaign
            </button>
          )}
          {cost != null && <span className="hint">${cost.toFixed(4)}</span>}
        </div>
      </section>

      {error && <p className="error" role="alert">{error}</p>}
      {saved && <p className="ok" role="status">Saved “{saved}”. Reloading…</p>}

      {spec && (
        <section className="review">
          <h2>What it found</h2>
          <div className="head">
            <strong>{spec.brand}</strong>
            <span className="meta">{spec.niche} · {spec.agency ?? "no agency"} · {(spec.platforms ?? []).join(", ")}</span>
          </div>
          <dl className="facts">
            <div><dt>Rate</dt><dd>{money(spec.payout?.rate_usd)} / 1k</dd></div>
            <div><dt>Min</dt><dd>{money(spec.payout?.min_payout_usd)}</dd></div>
            <div><dt>Max / post</dt><dd>{money(spec.payout?.max_payout_usd)}</dd></div>
            <div><dt>Budget</dt><dd>{money(spec.payout?.budget_total_usd)}</dd></div>
          </dl>
          <h3>Hard rules — enforced before any render</h3>
          <HardRules spec={spec} />
          {spec.guidance && (
            <>
              <h3>Guidance — advice, not enforced</h3>
              <p className="hint">{spec.guidance.hook_style}</p>
              {!!(spec.guidance.angles ?? []).length && (
                <ul className="angles">{spec.guidance.angles.map((a: string) => <li key={a}>{a}</li>)}</ul>
              )}
            </>
          )}
          <details><summary>Raw spec</summary><pre>{JSON.stringify(spec, null, 2)}</pre></details>
        </section>
      )}

      <section>
        <h2>Live campaigns</h2>
        {!campaigns.length && <p className="hint">None yet.</p>}
        <ul className="camps">
          {campaigns.map((c) => (
            <li key={c.id}>
              <div>
                <strong>{c.brand}</strong>
                <span className="meta">{c.niche} · {money(c.payout?.rate_usd)}/1k · budget {money(c.payout?.budget_remaining_usd)}</span>
              </div>
              <div className="tags">
                {c.rules?.required_phrase && <span className="tag hard">naming</span>}
                {c.requirements?.must_show_app && <span className="tag hard">app placement</span>}
                {!!(c.rules?.banned_claims ?? []).length && <span className="tag">{c.rules.banned_claims.length} banned</span>}
                <a className="tag go" href={`/studio?campaign=${c.id}`}>open in studio →</a>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
