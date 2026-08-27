"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/lib/motion";
import { useInView } from "@/lib/inView";

/**
 * Motion 3 — a hairline that draws itself in (scaleX 0→1, 400ms) once,
 * when it first enters the viewport.
 */
export function Rule({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [forced, setForced] = useState(false);
  const inView = useInView(ref, reduced === false);

  // Reduced motion (or a pre-hydration render) shows the divider outright.
  useEffect(() => {
    if (reduced) setForced(true);
  }, [reduced]);

  const shown = forced || inView;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      data-shown={shown}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`rule h-px w-full bg-line ${className}`}
    />
  );
}
