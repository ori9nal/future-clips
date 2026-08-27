import type { ReactNode } from "react";

/**
 * Splits a string on numeric tokens and sets every one in JetBrains Mono.
 * "Every number on the page is monospace" is a rule we enforce mechanically
 * rather than by remembering to wrap spans by hand.
 *
 * `String.split` with a capturing group puts the captures at odd indices,
 * so the parity check below is exact — no stateful regex `.test()`.
 */
const NUMERIC = /(\$?\d+(?:[.,]\d+)*(?:%|x)?)/g;

export function Copy({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  const parts = children.split(NUMERIC);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          // JetBrains Mono runs optically large next to Archivo; 0.94em evens it out.
          <span key={i} className="font-mono text-[0.94em] tracking-[-0.01em]">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}

/** Small mono all-caps label. The page's connective tissue. */
export function Label({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`font-mono text-[11px] leading-none font-medium tracking-[0.14em] uppercase ${className}`}
    >
      {children}
    </span>
  );
}

/** Two-digit section/step index. */
export function Index({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[12px] leading-none font-medium tracking-[0.1em] text-muted tabular-nums">
      {children}
    </span>
  );
}
