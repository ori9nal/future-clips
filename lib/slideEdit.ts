import "server-only";

/**
 * Redrawing one slide after a customer has moved or rewritten its words.
 *
 * The picture came from the image model; the type did not. Every art prompt
 * says "No text, no logos, no watermarks, no captions anywhere in the image",
 * and the words are drawn afterwards by our own renderer as vector type. So a
 * slide is not a flat photograph with the copy burnt in — it is a picture and
 * a short SVG, and the renderer keeps both (migration 0027).
 *
 * An edit therefore costs nothing at a provider and takes about a fifth of a
 * second: pull the SVG and its picture out of Storage, apply the change,
 * rasterise, put the slide back where it was. The file path does not change,
 * so every link to the set keeps working.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ENGINE_ROOT } from "@/lib/engine";

import type { SlideBlock as Block, SlideLayout } from "@/lib/sets";
export type { SlideBlock as Block, SlideLayout } from "@/lib/sets";
/** what a customer changed about one block: new words, and where they dragged it */
export type BlockEdit = { lines?: string[]; dx?: number; dy?: number };
export type SlideEdits = Record<string, BlockEdit>;

// the limits and the clamp live in lib/slideText.ts, which the browser can
// load too, so the editor and this route enforce exactly the same rule
import { clampMove, MAX_LINE, MAX_LINES } from "@/lib/slideText";
export { clampMove, MAX_LINE, MAX_LINES, EDGE } from "@/lib/slideText";

/**
 * Trim an edit to what the renderer will honour.
 *
 * Everything here arrives from a browser, so it is treated as a request
 * rather than as instructions: unknown block ids are dropped, the move is
 * clamped to the canvas, and the words are capped at a length that can still
 * be laid out. Returns null when there is nothing left worth rendering.
 */
export function cleanEdits(raw: unknown, blocks: Block[], canvas: { w: number; h: number }): SlideEdits | null {
  if (!raw || typeof raw !== "object") return null;
  const known = new Map(blocks.map((b) => [b.id, b]));
  const out: SlideEdits = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const block = known.get(id);
    if (!block || !v || typeof v !== "object") continue;
    const e = v as { lines?: unknown; dx?: unknown; dy?: unknown };
    const edit: BlockEdit = {};
    if (Array.isArray(e.lines)) {
      const lines = e.lines.map((l) => String(l ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LINE))
        .filter(Boolean).slice(0, MAX_LINES);
      // the same words in the same order is not an edit
      if (lines.join("\n") !== block.lines.join("\n")) edit.lines = lines;
    }
    // a block may be dragged anywhere on the slide — and stays on it
    const dx = Math.round(Number(e.dx ?? 0)) || 0;
    const dy = Math.round(Number(e.dy ?? 0)) || 0;
    if (dx || dy) {
      const c = clampMove(block, edit.lines ?? block.lines, dx, dy, canvas);
      if (c.dx) edit.dx = c.dx;
      if (c.dy) edit.dy = c.dy;
    }
    if (Object.keys(edit).length) out[id] = edit;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * The set's copy as the compliance checker expects it, with the edited slide's
 * words swapped in.
 *
 * Shaped from the copy the model actually wrote (`content_json`), not from the
 * blocks: the checker asks which slide is the hook and which one shows the
 * app, and only the copy knows. Reading those flags off a layout would fail
 * every brief that requires the app to be featured — which is most of them.
 * Mirrors the fold in engine/generate.mjs.
 */
export type Copy = { slides: { index: number; role: string; text: string; showsApp: boolean }[]; caption: string; bio: string };

export function copyForCheck(
  content: unknown,
  n: number,
  editedText: string | null,
): Copy | null {
  const c = content as {
    hook?: { lines?: string[]; sub?: string[] };
    ranked?: { name?: string; score?: string; lines?: string[]; role?: string; showsApp?: boolean }[];
    closer?: { lines?: string[]; cta?: string };
    caption?: string; bio?: string;
  } | null;
  if (!c?.hook && !c?.ranked?.length) return null;
  const ranked = c.ranked ?? [];
  const slides = [
    { index: 1, role: "hook", text: [...(c.hook?.lines ?? []), ...(c.hook?.sub ?? [])].join(" "), showsApp: false },
    ...ranked.map((r, i) => ({
      index: i + 2, role: r.role ?? "body",
      text: [r.name, r.score, ...(r.lines ?? [])].filter(Boolean).join(" "),
      showsApp: !!r.showsApp,
    })),
    { index: ranked.length + 2, role: "close", text: [...(c.closer?.lines ?? []), c.closer?.cta].filter(Boolean).join(" "), showsApp: false },
  ];
  const hit = slides.find((s) => s.index === n);
  if (hit && editedText != null) hit.text = editedText;
  return { slides, caption: c.caption ?? "", bio: c.bio ?? "" };
}

/** The text of a slide after an edit, for the compliance check it still has to pass. */
export function textAfter(blocks: Block[], edits: SlideEdits | null): string {
  return blocks
    .map((b) => (edits?.[b.id]?.lines ?? b.lines).join(" "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

type Art = { k: number; ext: string; buf: Buffer };

/** The SVG that drew this slide's words, and the picture under them. */
export async function readSlideParts(
  sb: SupabaseClient,
  prefix: string,
  n: number,
  artCount: number,
): Promise<{ body: string; art: Art[] } | null> {
  const { data: svg } = await sb.storage.from("sets").download(`${prefix}/slide-${n}.svg`);
  if (!svg) return null;
  const art: Art[] = [];
  for (let k = 0; k < artCount; k++) {
    for (const ext of ["jpeg", "png", "webp", "jpg"]) {
      const { data } = await sb.storage.from("sets").download(`${prefix}/slide-${n}.art-${k}.${ext}`);
      if (!data) continue;
      art.push({ k, ext, buf: Buffer.from(await data.arrayBuffer()) });
      break;
    }
  }
  return { body: await svg.text(), art };
}

/** Draw the slide again with the edit applied. Throws if a picture is missing. */
export async function drawSlide(o: {
  body: string;
  art: Art[];
  edits: SlideEdits | null;
  canvas: { w: number; h: number };
}): Promise<{ png: Buffer; blocks: Block[] }> {
  // The engine is imported by file URL, so the bundler never sees which
  // packages it needs and this function's bundle ships without them. Naming
  // them in `outputFileTracingIncludes` is not enough either: that copies
  // sharp and resvg but not what *they* import, and production answered
  // "Cannot find package 'detect-libc'" (2026-09-19). Importing them here by
  // name is what makes the tracer follow their whole graph. They are external
  // packages (next.config.ts), so this loads them rather than bundling them —
  // and the render below needs both anyway.
  await Promise.all([import("sharp"), import("@resvg/resvg-js")]);
  const url = pathToFileURL(path.join(ENGINE_ROOT, "styles", "registry.mjs")).href;
  const registry: { rerenderSlide: (a: unknown) => { png: Buffer; blocks: Block[] } } =
    await import(/* webpackIgnore: true */ url);
  const { png, blocks } = registry.rerenderSlide({ ...o, root: process.cwd() });
  return { png, blocks };
}
