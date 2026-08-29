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
  error?: string;
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

  return (
    <main className="adm stu">
      <header className="adm-head">
        <p className="adm-eyebrow">Studio</p>
        <h1>Generate a carousel</h1>
        <p className="adm-sub">
          Pick a campaign, a concept and a template family. Rendering runs the real engine —
          the first run is slower while fonts parse and libvips warms.
        </p>
      </header>

      <section className="adm-panel stu-controls">
        <label>
          <span>Campaign</span>
          <select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setConceptIndex(0); }}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.niche}</option>
            ))}
          </select>
        </label>

        <label>
          <span>Concept</span>
          <select value={conceptIndex} onChange={(e) => setConceptIndex(Number(e.target.value))}>
            {campaign?.concepts.map((k) => (
              <option key={k.i} value={k.i}>{k.structure} — “{k.hook}”</option>
            ))}
          </select>
        </label>

        <label>
          <span>Template family</span>
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
            {families.map((f) => (
              <option key={f.id} value={f.id}>{f.name} · {f.canvas}</option>
            ))}
          </select>
        </label>

        {campaign ? (
          <div className="stu-kit">
            <span className="stu-chip" style={{ background: campaign.ink }} title={`ink ${campaign.ink}`} />
            <span className="stu-chip" style={{ background: campaign.paper }} title={`paper ${campaign.paper}`} />
            <span className="stu-chip" style={{ background: campaign.accent }} title={`accent ${campaign.accent}`} />
            <code>{campaign.handle}</code>
          </div>
        ) : null}

        <button className="adm-btn" onClick={generate} disabled={busy || !campaignId}>
          {busy ? "Rendering…" : "Generate"}
        </button>
      </section>

      {err ? (
        <section className="adm-panel stu-err">
          <h2>Render failed</h2>
          <pre>{err}</pre>
        </section>
      ) : null}

      {result ? (
        <>
          <section className="adm-panel">
            <h2>
              {result.family}
              <span className="adm-count">{result.slides} slides</span>
              <span className="adm-count">{(result.ms / 1000).toFixed(1)}s</span>
              <span className="adm-count" style={{ color: result.valid ? "#1a7f4b" : "#C0342B" }}>
                {result.valid ? "rules PASS" : "rules FAIL"}
              </span>
            </h2>
            {!result.valid && result.errors?.length ? (
              <ul className="stu-errs">
                {result.errors.map((e, i) => <li key={i}><strong>{e.rule}</strong> — {e.detail}</li>)}
              </ul>
            ) : null}

            <div className="stu-grid">
              {result.files.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={f} href={f} target="_blank" rel="noreferrer" className="stu-slide">
                  <img src={f} alt={`slide ${i + 1}`} />
                  <span>{String(i + 1).padStart(2, "0")}</span>
                </a>
              ))}
            </div>
          </section>

          <section className="adm-panel">
            <h2>Subject match</h2>
            <p className="adm-note">
              Whether each slide&apos;s picture was chosen to answer its text, or fell back.
              A fallback is a real defect — it means nothing in the library matched the intent.
            </p>
            <table className="stu-table">
              <thead><tr><th>#</th><th>intent</th><th>subject</th><th>score</th></tr></thead>
              <tbody>
                {result.subjects.filter((s) => s.id).map((s) => (
                  <tr key={s.slide} className={s.matched === false ? "stu-bad" : ""}>
                    <td>{s.slide}</td>
                    <td>{s.intent || <em>none</em>}</td>
                    <td>{s.id}</td>
                    <td>{s.matched === false ? "fallback" : s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </main>
  );
}
