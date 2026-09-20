/**
 * How much text a slide block may carry, and where it may sit.
 *
 * Shared by the editor in the browser and the route on the server, so both
 * enforce the same rule and a drag looks the same as what gets saved. No
 * imports beyond types: this file has to load on both sides.
 *
 * Four lines and sixty characters a line is the most a block takes. A slide
 * is read at thumbnail size in a feed, and the copy rules that wrote it kept
 * every line under about nine words; an edit is held to the same idea, so
 * there is never too much text on the screen (owner, 2026-09-20; D-053).
 */
import type { SlideBlock } from "@/lib/sets";

export const MAX_LINES = 4;
export const MAX_LINE = 60;
/** a block keeps this much of the slide's edge clear, as a share of its width */
export const EDGE = 0.03;

const within = (lo: number, hi: number, v: number) => (lo > hi ? lo : Math.max(lo, Math.min(hi, v)));

/** The move that keeps this block, at this many lines, wholly on the slide. */
export function clampMove(block: SlideBlock, lines: string[], dx: number, dy: number, canvas: { w: number; h: number }) {
  const pad = Math.round(canvas.w * EDGE);
  const perLine = block.box.h / Math.max(1, block.lines.length);
  const h = perLine * Math.max(1, lines.length);
  return {
    dx: Math.round(within(pad - block.box.x, canvas.w - pad - block.box.w - block.box.x, dx)),
    dy: Math.round(within(pad - block.box.y, canvas.h - pad - h - block.box.y, dy)),
  };
}
