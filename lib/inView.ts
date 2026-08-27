"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Fires once, when `ref` first enters the viewport.
 *
 * IntersectionObserver is the primary trigger, but its callbacks are delivered
 * on the rendering lifecycle — a tab that isn't compositing frames never gets
 * them. A stat frozen at zero or a divider stuck at scaleX(0) is a worse
 * outcome than an un-animated one, so a passive scroll listener and a deferred
 * measurement back it up. Whichever path wins tears the others down.
 */
export function useInView<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    let fired = false;
    let io: IntersectionObserver | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const teardown = () => {
      io?.disconnect();
      io = null;
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
      if (timer !== undefined) clearTimeout(timer);
    };

    const trigger = () => {
      if (fired) return;
      fired = true;
      teardown();
      setInView(true);
    };

    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.88 && r.bottom > 0) trigger();
    };

    function onMove() {
      measure();
    }

    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) trigger();
        },
        { rootMargin: "0px 0px -12% 0px" },
      );
      io.observe(el);
    }

    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove, { passive: true });
    timer = setTimeout(measure, 300);
    measure();

    return teardown;
  }, [ref, enabled]);

  return inView;
}
