"use client";

/**
 * Move the words on a slide, or say something else.
 *
 * The picture is the image model's; the type is ours, drawn over it as vector
 * text. So every block here is a real element — the renderer reports where it
 * put each one (migration 0027) and this draws those boxes over the slide at
 * whatever size the slide is being shown. Drag one, retype it, and the slide
 * is drawn again server-side in about a fifth of a second, with nothing
 * generated and nothing paid for.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SlideBlock, SlideLayout } from "@/lib/sets";
import { clampMove, MAX_LINE, MAX_LINES } from "@/lib/slideText";

export type BlockEdit = { lines?: string[]; dx?: number; dy?: number };
export type SlideEdits = Record<string, BlockEdit>;

const I = {
  move: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" /></svg>,
  undo: <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-7.7L3 8" /></svg>,
};

type Props = {
  setId: string;
  slide: number;
  url: string;
  layout: SlideLayout;
  saved: SlideEdits | null;
  onSaved: (o: { url: string | null; edits: SlideEdits }) => void;
  onClose: () => void;
};

export default function SlideEditor({ setId, slide, url, layout, saved, onSaved, onClose }: Props) {
  const [edits, setEdits] = useState<SlideEdits>(saved ?? {});
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scale, setScale] = useState(0);
  const frame = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; x: number; y: number; dx: number; dy: number } | null>(null);
  const { canvas, blocks } = layout;   // the baseline; `edits` is the difference from it

  // canvas pixels to screen pixels: everything below is stored in the slide's
  // own coordinates, so a drag means the same thing on a phone and a desktop
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / canvas.w);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvas.w]);

  const linesOf = useCallback((b: SlideBlock) => edits[b.id]?.lines ?? b.lines, [edits]);
  const offsetOf = (b: SlideBlock) => ({ dx: edits[b.id]?.dx ?? 0, dy: edits[b.id]?.dy ?? 0 });
  const dirty = Object.keys(edits).length > 0;

  /* ── dragging ─────────────────────────────────────────────────────────── */
  const onDown = (e: React.PointerEvent, b: SlideBlock) => {
    if ((e.target as HTMLElement).tagName === "TEXTAREA") return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const { dx, dy } = offsetOf(b);
    drag.current = { id: b.id, x: e.clientX, y: e.clientY, dx, dy };
    setPicked(b.id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !scale) return;
    e.preventDefault();
    const block = blocks.find((x) => x.id === d.id);
    if (!block) return;
    // the block stays on the slide, whatever the pointer does
    const { dx, dy } = clampMove(block, linesOf(block), d.dx + (e.clientX - d.x) / scale, d.dy + (e.clientY - d.y) / scale, canvas);
    setEdits((prev) => ({ ...prev, [d.id]: { ...prev[d.id], dx, dy } }));
  };
  const onUp = () => { drag.current = null; };

  // arrow keys nudge the picked block: a pointer is coarse and the last few
  // pixels of a placement are exactly what someone is here to fix
  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 20 : 4;
      const by = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (!by || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      e.preventDefault();
      const block = blocks.find((x) => x.id === picked);
      if (!block) return;
      setEdits((prev) => {
        const c = clampMove(block, prev[picked]?.lines ?? block.lines, (prev[picked]?.dx ?? 0) + by[0], (prev[picked]?.dy ?? 0) + by[1], canvas);
        return { ...prev, [picked]: { ...prev[picked], dx: c.dx, dy: c.dy } };
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, blocks, canvas]);

  /* ── saving ───────────────────────────────────────────────────────────── */
  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/sets/${setId}/slides/${slide}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.error ?? "the slide could not be saved"); return; }
      onSaved({ url: j.url ?? null, edits });
    } catch {
      setErr("the slide could not be saved");
    } finally {
      setBusy(false);
    }
  };

  const pickedBlock = blocks.find((b) => b.id === picked) ?? null;

  return (
    <div className="sed">
      <div className="sed-frame" ref={frame} style={{ aspectRatio: `${canvas.w} / ${canvas.h}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Slide ${slide}`} draggable={false} />
        {scale > 0 && blocks.map((b) => {
          const { dx, dy } = offsetOf(b);
          const on = picked === b.id;
          const moved = !!(dx || dy);
          const retyped = !!edits[b.id]?.lines;
          // the box follows the words: retyping three lines where there was
          // one should cover three lines, without asking the server
          const perLine = b.box.h / Math.max(1, b.lines.length);
          const h = perLine * Math.max(1, linesOf(b).length);
          return (
            <div
              key={b.id}
              className={`sed-box${on ? " on" : ""}${moved || retyped ? " edited" : ""}`}
              style={{
                left: (b.box.x + dx) * scale, top: (b.box.y + dy) * scale,
                width: Math.max(28, b.box.w * scale), height: Math.max(22, h * scale),
              }}
              onPointerDown={(e) => onDown(e, b)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              role="button"
              tabIndex={0}
              aria-label={`${linesOf(b).join(" ")} — drag to move, arrow keys to nudge`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(b.id); } }}
            >
              <span className="sed-grip">{I.move}</span>
            </div>
          );
        })}
      </div>

      <div className="sed-side">
        {pickedBlock ? (
          <>
            <div className="sed-h">
              <span className="label">The words</span>
              <button
                className="btn quiet sm"
                disabled={!edits[pickedBlock.id]}
                onClick={() => setEdits((p) => { const { [pickedBlock.id]: _drop, ...rest } = p; return rest; })}
              >{I.undo} Put it back</button>
            </div>
            <textarea
              className="textarea sed-txt"
              rows={Math.min(MAX_LINES, Math.max(2, linesOf(pickedBlock).length + 1))}
              value={linesOf(pickedBlock).join("\n")}
              onChange={(e) => {
                // never too much text on a slide: four lines, sixty characters each
                const lines = e.target.value.split("\n").slice(0, MAX_LINES).map((l) => l.slice(0, MAX_LINE));
                setEdits((p) => {
                  const next = { ...p[pickedBlock.id], lines };
                  // fewer or more lines change the block's height: keep it on the slide
                  const c = clampMove(pickedBlock, lines, next.dx ?? 0, next.dy ?? 0, canvas);
                  return { ...p, [pickedBlock.id]: { ...next, dx: c.dx, dy: c.dy } };
                });
              }}
              aria-label="The words on this block"
            />
            <p className="sed-note">
              One line each, {MAX_LINES} at most and {MAX_LINE} letters a line — a slide is read at thumbnail size.
              Drag the block on the slide, or nudge it with the arrow keys (shift for bigger steps); it stays on the slide.
              Longer words wrap and the type shrinks to fit rather than running off the edge.
            </p>
          </>
        ) : (
          <p className="sed-note sed-empty">
            Pick any piece of text on the slide. The photograph came from the model; the words are drawn on top, so
            they can be moved and rewritten without making the slideshow again.
          </p>
        )}

        {err && <p className="err sed-err">{err}</p>}
        <div className="sed-row">
          <button className="btn quiet" onClick={onClose}>Done</button>
          <span style={{ flex: 1 }} />
          <button className="btn quiet" disabled={!dirty || busy} onClick={() => { setEdits({}); setPicked(null); }}>Reset</button>
          <button className="btn primary" disabled={!dirty || busy} onClick={save}>
            {busy ? <span className="spin" /> : "Save the slide"}
          </button>
        </div>
      </div>
    </div>
  );
}
