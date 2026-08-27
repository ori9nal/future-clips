"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import { useInView } from "@/lib/inView";

const DURATION = 1100;
const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Motion 2 — counts once, on first scroll into view.
 *
 * Renders the final value during SSR. We only rewind to zero if the stat is
 * still below the fold at hydration, so an above-the-fold number never pops
 * backwards. If the frame loop never runs, a timeout snaps to the real value
 * rather than leaving a zero on screen.
 */
export function CountUp({
  value,
  decimals = 0,
  prefix = "",
}: {
  value: number;
  decimals?: number;
  prefix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const [armed, setArmed] = useState(false);
  const reduced = useReducedMotion();
  const inView = useInView(ref, armed);

  useEffect(() => {
    if (reduced === null || reduced) return;
    const el = ref.current;
    if (!el) return;
    if (el.getBoundingClientRect().top <= window.innerHeight) return;

    setDisplay(0);
    setArmed(true);
  }, [reduced]);

  useEffect(() => {
    if (!inView) return;

    let raf = 0;
    let start = 0;

    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min((now - start) / DURATION, 1);
      setDisplay(t === 1 ? value : value * easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Backstop for environments where rAF is throttled or never scheduled.
    const settle = setTimeout(() => setDisplay(value), DURATION + 400);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
    };
  }, [inView, value]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {display.toFixed(decimals)}
    </span>
  );
}
