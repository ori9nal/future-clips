"use client";

import { useEffect, useRef, useState } from "react";

/**
 * What the metadata gate did, made visible.
 *
 * Every frame the image provider returns carries a C2PA manifest (the `caBX`
 * chunk), and often EXIF and XMP as well. The engine strips those bytes when
 * the frame is written and refuses to ship a slide that is anything but
 * pixels (`engine/clean.mjs`). The set records what was removed in
 * `compliance_json.clean`; this is that record as a small animation: the tags
 * peel off the slide, the seal closes, the claim on the site ("no visible
 * watermark, nothing stamped into the file") becomes something a member can
 * see. A set rendered before the record existed still went through the same
 * gate, so it shows the check rather than the counts.
 *
 * The peel plays ONCE, on the set that just landed (`fresh`): four seals all
 * peeling as the Recent list scrolled by turned the moment into wallpaper
 * (Product, 2026-09-19). Every other card carries the closed seal — shield
 * drawn, no tags — with the same words and the same detail table.
 */
export type CleanRecord = {
  frames?: number;
  slides?: number;
  stripped?: { chunk: string; what: string; count: number }[];
  verified?: boolean;
};

/** The chunk types the gate looks for, in the order they are shown. */
const CHECKED: { chunk: string; what: string }[] = [
  { chunk: "caBX", what: "C2PA manifest" },
  { chunk: "eXIf", what: "EXIF block" },
  { chunk: "iTXt", what: "XMP" },
  { chunk: "tEXt", what: "text" },
];

export function CleanSeal({ clean, slides, fresh = false }: { clean?: CleanRecord | null; slides?: number; fresh?: boolean }) {
  const [seen, setSeen] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen || !fresh) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen, fresh]);

  const stripped = (clean?.stripped ?? []).filter((s) => s.count > 0);
  const measured = stripped.length > 0;
  const chips = measured ? stripped : CHECKED.map((c) => ({ ...c, count: 0 }));
  const removed = stripped.reduce((n, s) => n + s.count, 0);
  const n = clean?.slides ?? slides ?? 0;

  return (
    <div className={`fc-seal${seen ? " in" : ""}${fresh ? "" : " settled"}`} ref={ref}>
      <button type="button" className="fc-seal-row" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="fc-seal-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.8 20 6v6.1c0 4.4-3.2 7.9-8 9.1-4.8-1.2-8-4.7-8-9.1V6l8-3.2Z" className="fc-seal-shield" />
            <path d="m8.4 12.2 2.6 2.6 4.8-5" className="fc-seal-tick" />
          </svg>
        </span>
        <span className="fc-seal-tags" aria-hidden="true">
          {chips.map((c, i) => (
            <span key={c.chunk} className="fc-seal-tag" style={{ ["--i" as string]: i }}>
              {c.chunk}{c.count > 1 ? ` ×${c.count}` : ""}
            </span>
          ))}
        </span>
        <span className="fc-seal-text">
          {measured
            ? <><b>{removed} metadata {removed === 1 ? "tag" : "tags"} removed.</b> Your {n || ""} slides are pixels only.</>
            : <><b>Metadata removed.</b> Every slide checked: pixels only.</>}
        </span>
        <span className="fc-seal-more" aria-hidden="true">{open ? "Hide" : "What was removed"}</span>
      </button>
      {open && (
        <div className="fc-seal-detail">
          <table>
            <thead><tr><th>Chunk</th><th>What it is</th><th className="n">{measured ? "Removed" : "Checked"}</th></tr></thead>
            <tbody>
              {chips.map((c) => (
                <tr key={c.chunk}><td><code>{c.chunk}</code></td><td>{c.what}</td><td className="n">{measured ? c.count : "—"}</td></tr>
              ))}
            </tbody>
          </table>
          <p>
            {measured
              ? <>Stripped from {clean?.frames ?? 0} generated {clean?.frames === 1 ? "frame" : "frames"} as they were written, then every finished slide was read back{clean?.verified === false ? " (one did not pass: tell us)" : " and carried nothing but pixels"}.</>
              : <>Every generated frame is stripped as it is written and every finished slide is read back; a slide that carries anything but pixels is never shipped.</>}
            {" "}No visible watermark, no stamp in the file.
          </p>
        </div>
      )}
    </div>
  );
}
