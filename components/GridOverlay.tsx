/**
 * The persistent 12-column rule grid. Shares `.shell`'s max-width and
 * padding so the lines sit on genuine column boundaries. Desktop only.
 */
export function GridOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 hidden lg:block"
    >
      <div className="shell grid h-full grid-cols-12">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="border-l border-line last:border-r last:border-r-line"
          />
        ))}
      </div>
    </div>
  );
}
