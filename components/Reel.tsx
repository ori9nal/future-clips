"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { byId, src, REEL_SETS } from "@/lib/carousels";

/**
 * The hero reel. Each column cycles through its own set of covers so the
 * strip is never showing the same three shots for long.
 *
 * Honours prefers-reduced-motion by simply never advancing.
 */
export function Reel() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setStep((n) => n + 1), 3200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="reel">
      {REEL_SETS.map((set, i) => {
        const shot = byId(set[(step + i) % set.length]);
        return (
          <figure className="shot" key={i}>
            <Image
              src={src(shot)}
              alt={shot.alt}
              width={shot.w}
              height={shot.h}
              priority={i < 3}
              sizes="(max-width: 640px) 47vw, (max-width: 1000px) 31vw, 228px"
            />
          </figure>
        );
      })}
    </div>
  );
}
