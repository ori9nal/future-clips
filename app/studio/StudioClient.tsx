"use client";

import { useState } from "react";
import type { Spec } from "@/lib/specs";

type Logic = { pass: boolean; failures: string[]; warnings: string[] };
type Result = { style: string; ms: number; logic: Logic; slides: string[] };

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

export function StudioClient({ campaigns }: { campaigns: Spec[] }) {
  const [id, setId] = useState(campaigns[0]?.id ?? "");
  const [style, setStyle] = useState<"native" | "mascot">("native");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spec = campaigns.find((c) => c.id === id);
  const hasMascot = !!spec?.assets.mascot;

  async function render() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch("/api/sets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: id, style }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "render failed");
      else setResult(j);
    } catch (e: any) {
      setError(e?.message ?? "network error");
    } finally {
      setBusy(false);
    }
  }

  if (!campaigns.length) {
    return (
      <p className="empty">
        No campaigns yet. <a href="/admin/new">Create one</a>.
      </p>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="field">
          <label htmlFor="campaign">Campaign</label>
          <select id="campaign" value={id} onChange={(e) => { setId(e.target.value); setResult(null); }}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.brand} — {c.niche}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Style</label>
          <div className="segmented" role="group" aria-label="Style">
            <button
              type="button"
              aria-pressed={style === "native"}
              className={style === "native" ? "on" : ""}
              onClick={() => { setStyle("native"); setResult(null); }}
            >
              Native
            </button>
            <button
              type="button"
              aria-pressed={style === "mascot"}
              className={style === "mascot" ? "on" : ""}
              disabled={!hasMascot}
              title={hasMascot ? "" : "This campaign has no mascot asset"}
              onClick={() => { setStyle("mascot"); setResult(null); }}
            >
              Mascot
            </button>
          </div>
          {!hasMascot && <p className="hint">Mascot style needs a mascot asset on the campaign.</p>}
        </div>

        <button className="primary" onClick={render} disabled={busy}>
          {busy ? "Rendering…" : `Render ${(spec?.content.ranked.length ?? 0) + 2} slides`}
        </button>
      </section>

      {spec && (
        <section className="brief">
          <h2>What the brief locks</h2>
          <dl>
            <div><dt>Rate</dt><dd>{money(spec.payout.rate_usd)} / 1k views</dd></div>
            <div><dt>Budget left</dt><dd>{money(spec.payout.budget_remaining_usd)}</dd></div>
            <div><dt>Review</dt><dd>{spec.payout.review_days} days</dd></div>
            <div><dt>Aspect</dt><dd>{spec.requirements.aspect}</dd></div>
            <div><dt>Mention</dt><dd>{spec.requirements.required_mention}</dd></div>
            <div><dt>Platforms</dt><dd>{spec.payout.platforms.join(", ")}</dd></div>
          </dl>
          <p className="banned">
            <strong>Banned claims:</strong> {spec.rules.banned_claims.join(" · ")}
          </p>
        </section>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <section>
          <div className={`verdict ${result.logic.pass ? "ok" : "bad"}`}>
            <strong>{result.logic.pass ? "Checks passed" : "Checks failed"}</strong>
            <span>
              {result.slides.length} slides in {(result.ms / 1000).toFixed(1)}s
            </span>
          </div>
          {result.logic.failures.map((f) => (
            <p className="issue fail" key={f}>{f}</p>
          ))}
          {result.logic.warnings.map((w) => (
            <p className="issue warn" key={w}>{w}</p>
          ))}

          <div className="strip">
            {result.slides.map((s, i) => (
              <figure key={s}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s} alt={`Slide ${i + 1}`} width={1080} height={1920} />
                <figcaption>
                  {String(i + 1).padStart(2, "0")} / {String(result.slides.length).padStart(2, "0")}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
