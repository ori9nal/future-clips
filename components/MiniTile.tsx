type Accent = "acid" | "fg" | "red";

// Static map — Tailwind's scanner needs to see these class strings literally.
const ACCENT_BG: Record<Accent, string> = {
  acid: "bg-acid",
  fg: "bg-fg",
  red: "bg-red",
};

function Bar({
  w,
  h = 3,
  className = "bg-fg",
}: {
  w: string;
  h?: number;
  className?: string;
}) {
  return (
    <span
      className={`block ${className}`}
      style={{ width: w, height: `${h}px` }}
    />
  );
}

/**
 * A wireframe of one generated carousel slide. Eight structural layouts ×
 * three accent roles = 24 combinations, which is exactly what the collision
 * readout in the uniqueness section claims. The claim is arithmetic, not decor.
 */
export function MiniTile({
  layout,
  accent,
}: {
  layout: number;
  accent: Accent;
}) {
  const a = ACCENT_BG[accent];
  const surface = layout % 2 === 0 ? "bg-bg" : "bg-surface";
  const frame = `flex h-full w-full flex-col border border-line p-1.5 ${surface}`;

  switch (layout % 8) {
    case 0: // kicker top-left, headline anchored bottom
      return (
        <div className={frame}>
          <Bar w="42%" h={2} className={a} />
          <div className="mt-auto flex flex-col gap-[3px]">
            <Bar w="88%" h={5} />
            <Bar w="62%" h={5} />
            <Bar w="70%" h={2} className="bg-muted" />
          </div>
        </div>
      );

    case 1: // centred stack
      return (
        <div className={`${frame} items-center justify-center gap-[3px]`}>
          <Bar w="34%" h={2} className={a} />
          <Bar w="80%" h={5} />
          <Bar w="56%" h={5} />
          <Bar w="66%" h={2} className="bg-muted" />
        </div>
      );

    case 2: // inverted — headline top, kicker at the foot
      return (
        <div className={frame}>
          <div className="flex flex-col gap-[3px]">
            <Bar w="92%" h={5} />
            <Bar w="54%" h={5} />
          </div>
          <div className="mt-auto flex flex-col gap-[3px]">
            <Bar w="76%" h={2} className="bg-muted" />
            <Bar w="38%" h={2} className={a} />
          </div>
        </div>
      );

    case 3: // solid accent panel over the top half
      return (
        <div className={`${frame} p-0`}>
          <span className={`block h-[46%] w-full ${a}`} />
          <div className="mt-auto flex flex-col gap-[3px] p-1.5">
            <Bar w="84%" h={5} />
            <Bar w="48%" h={5} />
          </div>
        </div>
      );

    case 4: // vertical accent rail, content to the right
      return (
        <div className={`${frame} flex-row gap-1.5`}>
          <span className={`block h-full w-[4px] shrink-0 ${a}`} />
          <div className="flex flex-1 flex-col justify-center gap-[3px]">
            <Bar w="90%" h={4} />
            <Bar w="70%" h={4} />
            <Bar w="84%" h={2} className="bg-muted" />
            <Bar w="52%" h={2} className="bg-muted" />
          </div>
        </div>
      );

    case 5: // headline top, accent block bottom-right
      return (
        <div className={frame}>
          <div className="flex flex-col gap-[3px]">
            <Bar w="72%" h={5} />
            <Bar w="90%" h={5} />
          </div>
          <div className="mt-auto flex items-end justify-end">
            <span className={`block h-[22px] w-[36%] ${a}`} />
          </div>
        </div>
      );

    case 6: // accent band splitting the slide
      return (
        <div className={frame}>
          <Bar w="66%" h={5} />
          <span className={`my-1.5 block h-[6px] w-full ${a}`} />
          <div className="flex flex-col gap-[3px]">
            <Bar w="86%" h={2} className="bg-muted" />
            <Bar w="72%" h={2} className="bg-muted" />
            <Bar w="80%" h={2} className="bg-muted" />
          </div>
        </div>
      );

    default: // dense body copy, headline right-aligned at the foot
      return (
        <div className={frame}>
          <Bar w="30%" h={2} className={a} />
          <div className="mt-1 flex flex-col gap-[2px]">
            <Bar w="92%" h={2} className="bg-muted" />
            <Bar w="86%" h={2} className="bg-muted" />
            <Bar w="90%" h={2} className="bg-muted" />
            <Bar w="64%" h={2} className="bg-muted" />
          </div>
          <div className="mt-auto flex flex-col items-end gap-[3px]">
            <Bar w="70%" h={5} />
            <Bar w="44%" h={5} />
          </div>
        </div>
      );
  }
}

export const ACCENTS: Accent[] = ["acid", "fg", "red"];
