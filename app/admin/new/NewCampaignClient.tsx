"use client";

import { useState } from "react";

type RankedRow = { photo: string; name: string; score: string; lines: string };

const blankRow = (): RankedRow => ({ photo: "", name: "", score: "", lines: "" });

/** The engine wants an array of hand-broken lines; the form takes a textarea. */
const toLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function NewCampaignClient({ photoDirs }: { photoDirs: string[] }) {
  const [f, setF] = useState({
    id: "", brand: "", product: "", niche: "", handle: "@",
    rate: "1.00", budget: "10000", review: "9",
    banned: "guaranteed, medically proven, cures",
    palette: "#0B0B0C, #FF5A1F, #F2F0EB",
    photosDir: photoDirs[0] ?? "",
    mascot: "",
    hookPhoto: "", hookLines: "", hookSub: "",
    closerPhoto: "", closerLines: "", closerCta: "",
  });
  const [rows, setRows] = useState<RankedRow[]>([blankRow(), blankRow()]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const setRow = (i: number, k: keyof RankedRow, v: string) =>
    setRows(rows.map((r, j) => (i === j ? { ...r, [k]: v } : r)));

  const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const spec = {
      id: f.id, brand: f.brand, product: f.product, niche: f.niche,
      status: "live",
      payout: {
        rate_usd: Number(f.rate) || 0, min_payout_usd: 1, max_payout_usd: 500,
        budget_total_usd: Number(f.budget) || 0, budget_remaining_usd: Number(f.budget) || 0,
        review_days: Number(f.review) || 0, platforms: ["instagram", "tiktok"],
      },
      requirements: {
        min_slides: 5, max_slides: 10, aspect: "9:16",
        required_mention: f.handle, must_show_app: false,
      },
      rules: { banned_claims: csv(f.banned) },
      assets: {
        palette: csv(f.palette),
        mascot: f.mascot.trim() || null,
        photos: { dir: f.photosDir, credit: "Pexels" },
      },
      content: {
        style: "native",
        hook: { photo: f.hookPhoto, lines: toLines(f.hookLines), sub: toLines(f.hookSub) },
        ranked: rows
          .filter((r) => r.name.trim() && r.photo.trim())
          .map((r) => ({ photo: r.photo.trim(), name: r.name.trim(), score: r.score.trim(), lines: toLines(r.lines) })),
        closer: { photo: f.closerPhoto, lines: toLines(f.closerLines), cta: f.closerCta },
      },
    };
    try {
      const r = await fetch("/api/specs", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(spec),
      });
      const j = await r.json();
      if (!r.ok) setMsg({ kind: "bad", text: j.error ?? "could not save" });
      else setMsg({ kind: "ok", text: `Saved "${j.campaign.id}". Open the studio to render it.` });
    } catch (err: any) {
      setMsg({ kind: "bad", text: err?.message ?? "network error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={save}>
      <fieldset>
        <legend>Brand</legend>
        <div className="grid">
          <label>Campaign id<input value={f.id} onChange={set("id")} placeholder="core-creatine" required /></label>
          <label>Brand<input value={f.brand} onChange={set("brand")} placeholder="CORE" required /></label>
          <label>Product<input value={f.product} onChange={set("product")} placeholder="creatine" required /></label>
          <label>Niche<input value={f.niche} onChange={set("niche")} placeholder="supplements" required /></label>
          <label>Required mention<input value={f.handle} onChange={set("handle")} placeholder="@core.labs" required /></label>
          <label>Palette (ink, accent, paper)<input value={f.palette} onChange={set("palette")} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Terms</legend>
        <div className="grid">
          <label>Rate per 1k views (USD)<input type="number" step="0.05" min="0" value={f.rate} onChange={set("rate")} /></label>
          <label>Budget (USD)<input type="number" step="100" min="0" value={f.budget} onChange={set("budget")} /></label>
          <label>Review window (days)<input type="number" min="0" value={f.review} onChange={set("review")} /></label>
          <label className="wide">Banned claims (comma separated)<input value={f.banned} onChange={set("banned")} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Assets</legend>
        <div className="grid">
          <label>
            Photo folder <em>(local only — hosted campaigns render with AI art)</em>
            <select value={f.photosDir} onChange={set("photosDir")} disabled={!photoDirs.length}>
              {!photoDirs.length && <option value="">none · art=ai</option>}
              {photoDirs.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>Mascot PNG (optional)<input value={f.mascot} onChange={set("mascot")} placeholder="output/mascot/m4-cut.png" /></label>
        </div>
        <p className="note">
          Photo ids below are the filenames in that folder, without the extension. The agency supplies
          the palette and any mascot; the clipper brings the footage.
        </p>
      </fieldset>

      <fieldset>
        <legend>Hook</legend>
        <div className="grid">
          <label>Photo id<input value={f.hookPhoto} onChange={set("hookPhoto")} placeholder="30165254" required /></label>
          <label className="wide">Headline — one line per row
            <textarea rows={3} value={f.hookLines} onChange={set("hookLines")} placeholder={"FOUR THINGS THAT\nACTUALLY MOVED\nMY LIFTS"} required />
          </label>
          <label className="wide">Subline<textarea rows={1} value={f.hookSub} onChange={set("hookSub")} placeholder="ranked worst to best" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Ranked payload</legend>
        <p className="note">Counted down, so the last one is rank 1 and the swipe pays off at the end.</p>
        {rows.map((r, i) => (
          <div className="row" key={i}>
            <span className="rank">{rows.length - i}</span>
            <input value={r.photo} onChange={(e) => setRow(i, "photo", e.target.value)} placeholder="photo id" />
            <input value={r.name} onChange={(e) => setRow(i, "name", e.target.value)} placeholder="name" />
            <input className="score" value={r.score} onChange={(e) => setRow(i, "score", e.target.value)} placeholder="2/10" />
            <textarea rows={2} value={r.lines} onChange={(e) => setRow(i, "lines", e.target.value)} placeholder={"one line per row"} />
            <button type="button" className="ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`Remove row ${i + 1}`}>×</button>
          </div>
        ))}
        <button type="button" className="ghost add" onClick={() => setRows([...rows, blankRow()])}>+ Add item</button>
      </fieldset>

      <fieldset>
        <legend>Closer</legend>
        <div className="grid">
          <label>Photo id<input value={f.closerPhoto} onChange={set("closerPhoto")} placeholder="30165251" required /></label>
          <label className="wide">Lines<textarea rows={2} value={f.closerLines} onChange={set("closerLines")} required /></label>
          <label className="wide">Call to action<input value={f.closerCta} onChange={set("closerCta")} placeholder="Follow @core.labs" required /></label>
        </div>
      </fieldset>

      <div className="actions">
        <button className="primary" disabled={saving}>{saving ? "Saving…" : "Save campaign"}</button>
        {msg && <p className={msg.kind === "ok" ? "ok" : "bad"} role="status">{msg.text}</p>}
      </div>
    </form>
  );
}
