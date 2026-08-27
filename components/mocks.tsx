import { Label } from "@/components/type";
import { MiniTile, ACCENTS } from "@/components/MiniTile";

/* ── 01 · Pick a campaign ─────────────────────────────────────────── */

/**
 * Generic campaign categories, not named brands. We have no signed partners
 * to display yet and inventing them would be the same lie as a fake logo strip.
 */
const CAMPAIGNS = [
  { name: "Finance podcast · S2", cpm: "1.10", spent: 68 },
  { name: "Fitness app — launch", cpm: "0.95", spent: 41 },
  { name: "Creator course · evergreen", cpm: "1.40", spent: 87 },
  { name: "Gaming SaaS · Q3", cpm: "0.80", spent: 12 },
];

export function CampaignPicker() {
  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <Label className="text-muted">Live campaigns</Label>
        <Label className="text-muted">4 open</Label>
      </div>

      <ul className="px-3">
        {CAMPAIGNS.map((c, i) => (
          <li
            key={c.name}
            className={`py-3 ${i < CAMPAIGNS.length - 1 ? "border-b border-line" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate font-mono text-[12px] text-fg">
                {c.name}
              </span>
              <span className="shrink-0 font-mono text-[12px] font-medium text-acid tabular-nums">
                ${c.cpm}
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-3">
              <span className="h-[3px] flex-1 bg-line" aria-hidden="true">
                <span
                  className="block h-full bg-muted"
                  style={{ width: `${c.spent}%` }}
                />
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted tabular-nums">
                {c.spent}%
              </span>
              <span className="shrink-0 bg-acid px-2 py-1 text-bg">
                <Label>Open</Label>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── 02 · Drop your assets ────────────────────────────────────────── */

const FILES = [
  { name: "source-cut-04.mp4", size: "48.2 MB" },
  { name: "logo-white.svg", size: "12 KB" },
  { name: "brand-kit.pdf", size: "1.1 MB" },
];

// Swatches read from the palette so the page holds to its seven tokens.
const SWATCHES = [
  { hex: "#D6FF3F", className: "bg-acid" },
  { hex: "#FFFFFF", className: "bg-fg" },
  { hex: "#FF3B30", className: "bg-red" },
];

export function AssetDrop() {
  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <Label className="text-muted">Assets</Label>
        <Label className="text-acid">Parsed</Label>
      </div>

      <div className="p-3">
        <div className="border border-dashed border-line px-3 py-5 text-center">
          <Label className="text-muted">Drop files or paste a link</Label>
        </div>

        <ul className="mt-3 flex flex-col gap-2">
          {FILES.map((f) => (
            <li
              key={f.name}
              className="flex items-center justify-between gap-3 border border-line px-2.5 py-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 shrink-0 bg-acid"
                  aria-hidden="true"
                />
                <span className="truncate font-mono text-[11px] text-fg">
                  {f.name}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[10px] text-muted tabular-nums">
                {f.size}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 border-t border-line pt-3">
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <dt>
              <Label className="text-muted">Fonts</Label>
            </dt>
            <dd className="truncate font-mono text-[11px] text-fg">
              Grotesk 800 / 400
            </dd>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line py-1.5">
            <dt>
              <Label className="text-muted">Palette</Label>
            </dt>
            <dd className="flex items-center gap-1.5">
              {SWATCHES.map((s) => (
                <span key={s.hex} className="flex items-center gap-1">
                  <span
                    className={`inline-block h-3 w-3 border border-line ${s.className}`}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[9px] text-muted">
                    {s.hex}
                  </span>
                </span>
              ))}
            </dd>
          </div>

          <div className="flex items-baseline justify-between gap-3 border-t border-line py-1.5">
            <dt>
              <Label className="text-muted">Safe areas</Label>
            </dt>
            <dd className="font-mono text-[11px] text-fg tabular-nums">
              T 220 · B 320
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

/* ── 03 · Ship 30 today ───────────────────────────────────────────── */

export function ThumbGrid() {
  return (
    <div className="border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <Label className="text-muted">Output queue</Label>
        <Label className="text-acid">12 ready</Label>
      </div>

      <div className="grid grid-cols-4 gap-2 p-3">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] w-full">
              <MiniTile layout={i % 8} accent={ACCENTS[Math.floor(i / 8) % 3]} />
            </div>
            <span className="mt-1 block font-mono text-[8px] leading-none tracking-[0.06em] text-acid uppercase">
              Unique ✓
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
