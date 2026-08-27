"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/type";

export function Topbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-line transition-colors duration-200 ${
        scrolled ? "bg-bg/80 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="shell flex h-14 items-center justify-between">
        <a
          href="#top"
          className="text-[19px] font-extrabold tracking-[-0.045em] text-fg lowercase"
          style={{ fontStretch: "125%" }}
        >
          futureclips
        </a>

        <nav className="flex items-center gap-5">
          <a
            href="#faq"
            className="hidden text-[14px] text-muted transition-colors hover:text-fg sm:inline"
          >
            questions
          </a>
          <a
            href="#pricing"
            className="text-[14px] text-muted transition-colors hover:text-fg"
          >
            log in
          </a>
          <a
            href="#start"
            className="bg-acid px-3.5 py-2 text-bg transition-opacity hover:opacity-85"
          >
            <Label>start free</Label>
          </a>
        </nav>
      </div>
    </header>
  );
}
