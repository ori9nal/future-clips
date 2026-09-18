"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Spec } from "@/lib/specs";

type Logic = { pass: boolean; failures: string[]; warnings: string[] };
type Result = { style: string; canvas: { w: number; h: number }; ms: number; logic: Logic; slides: string[] };
type StyleOption = {
  id: string; label: string; blurb: string;
  canvas: { w: number; h: number };
  fit: "native" | "adjacent" | "stretch";
};

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const ratio = (c: { w: number; h: number }) => {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(c.w, c.h);
  return `${c.w / d}:${c.h / d}`;
};

const FIT_NOTE: Record<StyleOption["fit"], string> = {
  native: "Made for this niche",
  adjacent: "Works — used by neighbouring niches",
  stretch: "Unusual here, which is sometimes the point",
};

export function StudioClient({ campaigns }: { campaigns: Spec[] }) {
  const [id, setId] = useState(campaigns[0]?.id ?? "");
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [style, setStyle] = useState<string>("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spec = campaigns.find((c) => c.id === id);

  // Style options come from the engine's registry rather than a list duplicated
  // in the UI — a new style module should appear here without a second edit.
  useEffect(() => {
    if (!spec) return;
    let live = true;
    setResult(null);
    fetch(`/api/styles?niche=${encodeURIComponent(spec.niche ?? "")}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        const opts: StyleOption[] = j.styles ?? [];
        setStyles(opts);
        const declared = spec.content?.style;
        setStyle(opts.find((o) => o.id === declared)?.id ?? opts[0]?.id ?? "");
      })
      .catch(() => live && setStyles([]));
    return () => { live = false; };
  }, [id, spec?.niche]);

  const hasMascot = !!spec?.assets.mascot;
  const usable = (o: StyleOption) => o.id !== "mascot" || hasMascot;
  const shown = showAll ? styles : styles.filter((o) => o.fit !== "stretch");
  const current = styles.find((o) => o.id === style);

  async function render() {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await fetch("/api/studio/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: id, style }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "render failed"); else setResult(j);
    } catch (e: any) {
      setError(e?.message ?? "network error");
    } finally {
      setBusy(false);
    }
  }

  if (!campaigns.length) {
    return <p className="empty">No campaigns yet. <Link href="/admin/new">Create one</Link>.</p>;
  }

  return (
    <>
      <section className="panel">
        <div className="field">
          <label htmlFor="campaign">Campaign</label>
          <select id="campaign" value={id} onChange={(e) => setId(e.target.value)}>
            {campaigns.map((c) => {
              // two campaigns can share a brand and a niche (LEDGER runs both a
              // native set and a document set); the id disambiguates them
              const clash = campaigns.some((o) => o.id !== c.id && o.brand === c.brand && o.niche === c.niche);
              return (
                <option key={c.id} value={c.id}>
                  {c.brand} — {c.niche}{clash ? ` · ${c.content?.style ?? c.id}` : ""}
                </option>
              );
            })}
          </select>
        </div>
        {/* an ingested brief has rules but no copy until a set is generated; the studio renders stored copy only */}
        {spec && !spec.content?.ranked?.length ? (
          <p className="ok" style={{ background: "rgba(255,180,60,.12)", color: "#e2a33c" }}>
            This brief has no copy yet — generate a set from the app (Create → {spec.brand}) and it will render here.
          </p>
        ) : (
          <button className="primary" onClick={render} disabled={busy || !style || !spec}>
            {busy ? "Rendering…" : `Render ${(spec?.content?.ranked?.length ?? 0) + 2} slides`}
          </button>
        )}
      </section>

      <section className="styles">
        <div className="styles-head">
          <h2>Style</h2>
          <button type="button" className="link" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show recommended only" : `Show all ${styles.length}`}
          </button>
        </div>
        <div className="cards" role="radiogroup" aria-label="Style">
          {shown.map((o) => {
            const ok = usable(o);
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={style === o.id}
                disabled={!ok}
                title={ok ? FIT_NOTE[o.fit] : "This campaign has no mascot asset"}
                className={`card ${style === o.id ? "on" : ""} fit-${o.fit}`}
                onClick={() => { setStyle(o.id); setResult(null); }}
              >
                <span className="card-top">
                  <strong>{o.label}</strong>
                  <em>{ratio(o.canvas)}</em>
                </span>
                <span className="card-blurb">{o.blurb}</span>
                <span className="card-fit">{FIT_NOTE[o.fit]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {spec && (
        <section className="brief">
          <h2>What the brief locks</h2>
          <dl>
            <div><dt>Rate</dt><dd>{money(spec.payout.rate_usd)} / 1k</dd></div>
            <div><dt>Budget left</dt><dd>{money(spec.payout.budget_remaining_usd)}</dd></div>
            <div><dt>Review</dt><dd>{spec.payout.review_days} days</dd></div>
            <div><dt>Canvas</dt><dd>{current ? ratio(current.canvas) : spec.requirements.aspect}</dd></div>
            <div><dt>Mention</dt><dd>{spec.requirements.required_mention}</dd></div>
          </dl>
          <p className="banned"><strong>Banned claims:</strong> {spec.rules.banned_claims.join(" · ")}</p>
        </section>
      )}

      {error && <p className="error" role="alert">{error}</p>}

      {result && (
        <section>
          <div className={`verdict ${result.logic.pass ? "ok" : "bad"}`}>
            <strong>{result.logic.pass ? "Checks passed" : "Checks failed"}</strong>
            <span>
              {result.slides.length} slides · {result.canvas.w}×{result.canvas.h} · {(result.ms / 1000).toFixed(1)}s
            </span>
          </div>
          {result.logic.failures.map((f) => <p className="issue fail" key={f}>{f}</p>)}
          {result.logic.warnings.map((w) => <p className="issue warn" key={w}>{w}</p>)}
          <div className="strip">
            {result.slides.map((s, i) => (
              <figure key={s} style={{ aspectRatio: `${result.canvas.w} / ${result.canvas.h}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s} alt={`Slide ${i + 1}`} />
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
