"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import { HERO_SLIDES, SLIDE_COUNT, STEP_MS, HOLD_MS } from "@/lib/slides";
import { Copy, Label } from "@/components/type";

/** Diagonal deck spread per card of depth. 7 × 3px = 21px, inside the 24px frame pad. */
const OFFSET = 3;

/**
 * Motion 1 — the pitch itself. Eight slides deal in 200ms apart while a mono
 * timer counts to 1.6s, then an acid receipt snaps in, holds 2s, and it loops.
 *
 * SSR renders the *completed* state, so no-JS and reduced-motion visitors get
 * a finished carousel rather than an empty frame.
 */
export function HeroCarousel() {
  const [count, setCount] = useState(SLIDE_COUNT);
  const [done, setDone] = useState(true);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced === null || reduced) return;

    let timer: ReturnType<typeof setTimeout>;
    let k = 0;

    const step = () => {
      k += 1;
      setCount(k);

      if (k >= SLIDE_COUNT) {
        setDone(true);
        timer = setTimeout(() => {
          k = 0;
          setCount(0);
          setDone(false);
          timer = setTimeout(step, STEP_MS);
        }, HOLD_MS);
      } else {
        timer = setTimeout(step, STEP_MS);
      }
    };

    setCount(0);
    setDone(false);
    timer = setTimeout(step, STEP_MS);

    // Only ever one timer pending, so a single clear is sufficient.
    return () => clearTimeout(timer);
  }, [reduced]);

  const elapsed = (count * (STEP_MS / 1000)).toFixed(1);

  return (
    <div className="w-full max-w-[430px] lg:ml-auto lg:max-w-none">
      {/* Render HUD */}
      <div
        aria-hidden="true"
        className="flex items-center justify-between border border-line bg-surface px-3 py-2.5"
      >
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 bg-acid"
            aria-hidden="true"
          />
          <Label className="text-muted">Render · carousel</Label>
        </span>
        <span className="font-mono text-[12px] leading-none font-medium tracking-[0.02em] text-fg tabular-nums">
          {elapsed}s
        </span>
      </div>

      {/* Deck frame */}
      <div
        aria-hidden="true"
        className="relative border border-line border-t-0 bg-bg p-6"
      >
        <div className="relative aspect-[1080/1350] w-full">
          {HERO_SLIDES.map((slide, i) => {
            const depth = SLIDE_COUNT - 1 - i;
            const visible = i < count;
            return (
              <article
                key={slide.kicker}
                className="absolute inset-0 overflow-hidden border border-line bg-bg"
                style={{
                  zIndex: i + 1,
                  transform: `translate3d(${-depth * OFFSET}px, ${depth * OFFSET}px, 0)`,
                  opacity: visible ? 1 : 0,
                  visibility: visible ? "visible" : "hidden",
                  animation: visible
                    ? `slide-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both`
                    : undefined,
                }}
              >
                <div className="flex h-full flex-col justify-between p-4 sm:p-5">
                  <Label className="text-acid">{slide.kicker}</Label>

                  <div>
                    <p
                      className="text-[clamp(1.35rem,4.4vw,2.05rem)] leading-[0.95] font-extrabold tracking-[-0.03em] text-fg"
                      style={{ fontStretch: "125%" }}
                    >
                      <Copy>{slide.headline}</Copy>
                    </p>
                    <p className="mt-2.5 text-[13px] leading-[1.45] text-muted">
                      <Copy>{slide.body}</Copy>
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-line pt-3">
                    <Label className="text-muted">Campaign asset</Label>
                    <Label className="text-muted">
                      {String(i + 1).padStart(2, "0")}/{SLIDE_COUNT}
                    </Label>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* Completion receipt */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 z-20 translate-y-1/2 bg-acid px-3 py-2"
          style={{
            opacity: done ? 1 : 0,
            visibility: done ? "visible" : "hidden",
            animation: done
              ? "snap-in 140ms cubic-bezier(0.22, 1, 0.36, 1) both"
              : undefined,
          }}
        >
          <Label className="text-bg">
            {SLIDE_COUNT} slides · 1.6s · ready to post
          </Label>
        </div>
      </div>

      {/* Screen readers get the outcome, not the ticking. */}
      <p className="sr-only">
        A demonstration of the product generating an eight slide carousel in one
        point six seconds.
      </p>
    </div>
  );
}
