"use client";

import { useState } from "react";

type Concept = { i: number; hook: string; structure: string; slides: number };
type Campaign = {
  id: string; name: string; niche: string; handle: string;
  ink: string; paper: string; accent: string; concepts: Concept[];
};
type Family = { id: string; name: string; canvas: string };

type Result = {
  id: string; family: string; slides: number; ms: number; valid: boolean;
  errors?: { rule: string; detail: string }[];
  files: string[];
  subjects: { slide: number; id: string; matched: boolean | null; score: number | null; intent: string | null }[];
};

export default function StudioClient({
  campaigns, families,
}: { campaigns: Campaign[]; families: Family[] }) {
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [conceptIndex, setConceptIndex] = useState(0);
  const [family, setFamily] = useState(families[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const campaign = campaigns.find((c) => c.id === campaignId);

  async function generate() {
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId, conceptIndex, family }),
      });
      const json = await res.json();
      if (!res.ok) setErr(json.error || `HTTP ${res.status}`);
      else setResult(json);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  const fallbacks = result?.subjects.filter((s) => s.id && s.matched === false).length ?? 0;

  return (
    <>
      <header className="fc-head">
        <p className="fc-eyebrow">Studio</p>
        <h1>Turn an idea into a slideshow.</h1>
        <p className="fc-sub">
          Pick a campaign, a concept and a look. The engine lays out every slide against the
          campaign&apos;s brand kit and hard-validates it before you see it.
        </p>
      </header>

      <section className="fc-card">
        <div className="fc-form">
          <div className="fc-row">
            <label>
              <span>Campaign</span>
              <select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setConceptIndex(0); }}>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.niche}</option>)}
              </select>
            </label>
            <label>
              <span>Look</span>
              <select value={family} onChange={(e) => setFamily(e.target.value)}>
                {families.map((f) => <option key={f.id} value={f.id}>{f.name} · {f.canvas}</option>)}
              </select>
            </label>
          </div>

          <label>
            <span>Idea <em>— the hook the set is built around</em></span>
            <select value={conceptIndex} onChange={(e) => setConceptIndex(Number(e.target.value))}>
              {campaign?.concepts.map((k) => (
                <option key={k.i} value={k.i}>{k.structure} — “{k.hook}”</option>
              ))}
            </select>
          </label>

          {campaign ? (
            <div className="fc-swatches">
              <span className="fc-sw" style={{ background: campaign.ink }} title={`ink ${campaign.ink}`} />
              <span className="fc-sw" style={{ background: campaign.paper }} title={`paper ${campaign.paper}`} />
              <span className="fc-sw" style={{ background: campaign.accent }} title={`accent ${campaign.accent}`} />
              <code>{campaign.handle}</code>
            </div>
          ) : null}

          <button className="fc-btn" data-variant="lime" onClick={generate} disabled={busy || !campaignId}>
            {busy ? "Generating…" : "Generate slideshow"}
          </button>
        </div>
      </section>

      {err ? (
        <section className="fc-card fc-err">
          <h2>Could not generate</h2>
          <pre>{err}</pre>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="fc-card">
            <h2>
              {result.family}
              <span className="fc-tag">{result.slides} slides</span>
              <span className="fc-tag">{(result.ms / 1000).toFixed(1)}s</span>
              <span className="fc-tag" data-ok={result.valid ? "1" : "0"}>
                {result.valid ? "rules pass" : "rules fail"}
              </span>
              {fallbacks ? <span className="fc-tag" data-ok="0">{fallbacks} unmatched image{fallbacks > 1 ? "s" : ""}</span> : null}
            </h2>

            {!result.valid && result.errors?.length ? (
              <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 12.5, color: "var(--fc-bad)" }}>
                {result.errors.map((e, i) => <li key={i}><strong>{e.rule}</strong> — {e.detail}</li>)}
              </ul>
            ) : null}

            <div className="fc-slides">
              {result.files.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={f} href={f} target="_blank" rel="noreferrer" className="fc-slide">
                  <img src={f} alt={`slide ${i + 1}`} />
                  <b>{String(i + 1).padStart(2, "0")}</b>
                </a>
              ))}
            </div>
          </section>

          <section className="fc-card">
            <h2>Image match</h2>
            <p className="fc-note" style={{ marginBottom: 12 }}>
              Whether each slide&apos;s picture was chosen to answer its own text, or fell back
              because nothing in the library matched. A fallback is a real defect, not a style choice.
            </p>
            <table className="fc-table">
              <thead><tr><th>#</th><th>intent</th><th>image</th><th>score</th></tr></thead>
              <tbody>
                {result.subjects.filter((s) => s.id).map((s) => (
                  <tr key={s.slide} data-bad={s.matched === false ? "1" : "0"}>
                    <td>{s.slide}</td>
                    <td>{s.intent || <em>none given</em>}</td>
                    <td>{s.id}</td>
                    <td>{s.matched === false ? "fallback" : s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </>
  );
}
