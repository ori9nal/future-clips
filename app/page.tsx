import { Topbar } from "@/components/Topbar";
import { GridOverlay } from "@/components/GridOverlay";
import { HeroCarousel } from "@/components/HeroCarousel";
import { CountUp } from "@/components/CountUp";
import { Rule } from "@/components/Rule";
import { SignupForm } from "@/components/SignupForm";
import { Faq } from "@/components/Faq";
import { Copy, Label, Index } from "@/components/type";
import { CampaignPicker, AssetDrop, ThumbGrid } from "@/components/mocks";
import { MiniTile, ACCENTS } from "@/components/MiniTile";

/* ── Section 3 data ───────────────────────────────────────────────── */

const STATS = [
  {
    value: 0.39,
    decimals: 2,
    prefix: "$",
    unit: "",
    label: "Real blended CPM — not the $1.25 advertised",
    acid: false,
  },
  {
    value: 25,
    decimals: 0,
    prefix: "",
    unit: "min",
    label: "To edit one video clip",
    acid: false,
  },
  {
    value: 2,
    decimals: 0,
    prefix: "",
    unit: "min",
    label: "To ship one carousel",
    acid: true,
  },
  {
    value: 2.9,
    decimals: 1,
    prefix: "",
    unit: "x",
    label: "More comments than video (IG carousels)",
    acid: false,
  },
];

// Static strings so Tailwind's scanner resolves them: 2-up on mobile, 4-up above md.
const STAT_BORDERS = [
  "",
  "border-l border-line",
  "border-t border-line md:border-t-0 md:border-l",
  "border-t border-l border-line md:border-t-0",
];

/* ── Section 4 data ───────────────────────────────────────────────── */

const ARGUMENTS = [
  {
    n: "01",
    title: "Budgets go unspent.",
    body: "Brands are running campaigns nobody can supply. The cash is allocated, the roster is already maxed, and the quarter closes anyway.",
  },
  {
    n: "02",
    title: "Video is the bottleneck.",
    body: "25 minutes an edit caps what one person can post. Every clipper in every campaign hits the same wall in the same place.",
  },
  {
    n: "03",
    title: "Carousels are the arbitrage.",
    body: "Same CPM. Same campaign. Ten times the output, off the same source footage you already downloaded.",
  },
];

/* ── Section 5 data ───────────────────────────────────────────────── */

const STEPS = [
  {
    n: "01",
    title: "Pick a campaign",
    body: "Live campaigns we have partnered with, showing the real rate and what is left of the budget.",
    mock: <CampaignPicker />,
  },
  {
    n: "02",
    title: "Drop your assets",
    body: "We read the brand kit and lock the rules: fonts, colours, safe areas, banned claims.",
    mock: <AssetDrop />,
  },
  {
    n: "03",
    title: "Ship 30 today",
    body: "Every output is structurally different. Space them across the week or dump them all this afternoon.",
    mock: <ThumbGrid />,
  },
];

/* ── Section 7 data ───────────────────────────────────────────────── */

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    features: ["2 carousels total", "All templates", "No card required"],
    featured: false,
    wrap: "py-8 lg:py-10 lg:pr-8",
    cta: "Start free",
  },
  {
    name: "Clipper",
    price: "$20",
    period: "/mo",
    features: [
      "40 carousels a month",
      "All templates",
      "Campaign rules engine",
      "Zero-Gen mode",
    ],
    featured: true,
    wrap: "border-y border-acid py-8 lg:border lg:border-acid lg:p-8",
    cta: "Get Clipper",
  },
  {
    name: "Pro",
    price: "$39",
    period: "/mo",
    features: [
      "150 carousels a month",
      "AI imagery",
      "Priority render",
      "Brand kits",
    ],
    featured: false,
    wrap: "py-8 lg:py-10 lg:pl-8",
    cta: "Get Pro",
  },
];

/* ── Page ─────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <>
      <GridOverlay />
      <Topbar />

      <main id="top" className="relative z-10">
        {/* ── 2 · HERO ───────────────────────────────────────────── */}
        <section className="shell pt-12 pb-16 lg:pt-20 lg:pb-28">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="order-2 lg:order-1 lg:col-span-7 lg:pr-10">
              <Label className="text-acid">
                2,250 carousels/hour · 1.6s each
              </Label>

              <h1 className="mt-6 text-[clamp(3rem,9vw,7.5rem)]">
                Stop editing.
                <br />
                Start shipping volume.
              </h1>

              <p className="mt-7 max-w-[46ch] text-[17px] text-muted">
                <Copy>
                  Campaign-ready carousels in the time it takes to read this
                  sentence. Pick a live campaign, drop your assets, post 30
                  today.
                </Copy>
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href="#start"
                  className="bg-acid px-6 py-3.5 text-bg transition-opacity hover:opacity-85"
                >
                  <Label>Make 2 free</Label>
                </a>
                <a
                  href="#how"
                  className="border border-line px-6 py-3.5 text-fg transition-colors hover:border-acid hover:text-acid"
                >
                  <Label>See it run →</Label>
                </a>
              </div>

              <p className="mt-6 font-mono text-[12px] tracking-[0.04em] text-muted">
                No card. 2 free carousels. Then $20/mo.
              </p>
            </div>

            <div className="order-1 lg:order-2 lg:col-span-5">
              <HeroCarousel />
            </div>
          </div>
        </section>

        {/* ── 3 · NUMBERS BAR ────────────────────────────────────── */}
        <section
          aria-label="Market numbers"
          className="border-y border-line bg-surface"
        >
          <div className="shell grid grid-cols-2 md:grid-cols-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className={`px-4 py-10 md:px-7 lg:py-14 ${STAT_BORDERS[i]}`}
              >
                <p
                  className={`font-mono text-[clamp(2.25rem,7vw,3.5rem)] leading-none font-medium tracking-[-0.03em] tabular-nums ${
                    s.acid ? "text-acid" : "text-fg"
                  }`}
                >
                  <CountUp
                    value={s.value}
                    decimals={s.decimals}
                    prefix={s.prefix}
                  />
                  {s.unit ? (
                    <span className="ml-1.5 text-[0.42em] tracking-normal">
                      {s.unit}
                    </span>
                  ) : null}
                </p>
                <p className="mt-4 max-w-[22ch]">
                  <Label className="text-muted">{s.label}</Label>
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4 · THE MARKET HAS A HOLE IN IT ────────────────────── */}
        <section className="shell mt-24 lg:mt-40">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-28">
                <Label className="text-acid">The market has a hole in it</Label>
                <h2 className="mt-6 text-[clamp(2rem,4.4vw,3.5rem)]">
                  There are more campaigns than there are clippers to fill them.
                </h2>
              </div>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              {ARGUMENTS.map((a, i) => (
                <div key={a.n}>
                  {i > 0 ? <Rule /> : null}
                  <div className={i === 0 ? "pb-9" : "py-9"}>
                    <Index>{a.n}</Index>
                    <p
                      className="mt-4 text-[21px] font-bold text-fg lg:text-[24px]"
                      style={{ fontStretch: "110%", letterSpacing: "-0.025em" }}
                    >
                      {a.title}
                    </p>
                    <p className="mt-3 max-w-[54ch] text-muted">
                      <Copy>{a.body}</Copy>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5 · HOW IT WORKS ───────────────────────────────────── */}
        <section id="how" className="shell mt-24 lg:mt-40">
          <Label className="text-acid">How it works</Label>
          <h2 className="mt-6 max-w-[18ch] text-[clamp(2rem,4.4vw,3.5rem)]">
            Three screens. Two minutes.
          </h2>

          {/* Scroll-snap strip on mobile, 3-up on desktop. The negative gutter
              lets the strip bleed to the screen edge without page overflow. */}
          <div className="-mx-5 mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-8 lg:overflow-visible lg:px-0 lg:pb-0">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="w-[82vw] shrink-0 snap-start sm:w-[400px] lg:w-auto lg:shrink"
              >
                <div className="flex items-baseline gap-3">
                  <Index>{s.n}</Index>
                  <h3 className="text-[22px] lg:text-[24px]">
                    <Copy>{s.title}</Copy>
                  </h3>
                </div>
                <p className="mt-3 min-h-[3.5rem] max-w-[38ch] text-[15px] text-muted">
                  <Copy>{s.body}</Copy>
                </p>
                <div className="mt-5">{s.mock}</div>
              </div>
            ))}
          </div>

          <p className="mt-8 font-mono text-[13px] tracking-[0.02em] text-acid">
            No two clippers get the same layout. Ever.
          </p>
        </section>

        {/* ── 6 · UNIQUENESS ─────────────────────────────────────── */}
        <section className="shell mt-24 lg:mt-40">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <Label className="text-acid">The moat</Label>
              <h2 className="mt-6 text-[clamp(2rem,4.4vw,3.5rem)]">
                Sixty clippers. Sixty different posts.
              </h2>
              <p className="mt-7 max-w-[46ch] text-muted">
                <Copy>
                  Post the same layout as everyone else in your campaign and the
                  algorithm buries all of you. Every carousel we make is seeded
                  to your account — different template, crop, palette, hook
                  structure, slide count.
                </Copy>
              </p>
            </div>

            <div className="lg:col-span-6 lg:col-start-7">
              <div
                role="img"
                aria-label="Twenty-four structurally distinct carousel outputs"
                className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-2.5"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <div key={i} className="aspect-[4/5] w-full">
                    <MiniTile
                      layout={i % 8}
                      accent={ACCENTS[Math.floor(i / 8) % 3]}
                    />
                  </div>
                ))}
              </div>

              <Rule className="mt-8" />
              <p className="mt-4 font-mono text-[11px] leading-relaxed font-medium tracking-[0.14em] text-acid uppercase">
                Collision check: 0 structural matches across 24 outputs
              </p>
            </div>
          </div>
        </section>

        {/* ── 7 · PRICING ────────────────────────────────────────── */}
        <section id="pricing" className="shell mt-24 lg:mt-40">
          <Label className="text-acid">Pricing</Label>
          <h2 className="mt-6 max-w-[16ch] text-[clamp(2rem,4.4vw,3.5rem)]">
            Two free. Then pick a lane.
          </h2>

          <div className="mt-12 grid grid-cols-1 border-y border-line lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={p.wrap}>
                <Label className={p.featured ? "text-acid" : "text-muted"}>
                  {p.name}
                </Label>

                <p className="mt-5 flex items-baseline gap-1">
                  <span className="font-mono text-[44px] leading-none font-medium tracking-[-0.03em] text-fg tabular-nums">
                    {p.price}
                  </span>
                  {p.period ? (
                    <span className="font-mono text-[15px] text-muted">
                      {p.period}
                    </span>
                  ) : null}
                </p>

                <ul className="mt-7">
                  {p.features.map((f, idx) => (
                    <li
                      key={f}
                      className={`py-2.5 text-[14px] text-muted ${
                        idx > 0 ? "border-t border-line" : ""
                      }`}
                    >
                      <Copy>{f}</Copy>
                    </li>
                  ))}
                </ul>

                <a
                  href="#start"
                  className={`mt-7 inline-block px-5 py-3 transition-colors ${
                    p.featured
                      ? "bg-acid text-bg hover:opacity-85"
                      : "border border-line text-fg hover:border-acid hover:text-acid"
                  }`}
                >
                  <Label>{p.cta}</Label>
                </a>
              </div>
            ))}
          </div>

          <p className="mt-6 font-mono text-[13px] tracking-[0.02em] text-muted">
            $149/yr on Clipper. That&rsquo;s 38% off if you&rsquo;re actually
            grinding.
          </p>
        </section>

        {/* ── 8 · AGENCY STRIP ───────────────────────────────────── */}
        <section className="mt-24 border-y border-line bg-surface py-16 lg:mt-40 lg:py-24">
          <div className="shell grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <h2 className="text-[clamp(2rem,4.4vw,3.25rem)]">
                Run an agency?
              </h2>
              <p className="mt-10 font-mono text-[clamp(3.5rem,9vw,5.5rem)] leading-none font-medium tracking-[-0.04em] text-acid tabular-nums">
                50%
              </p>
              <p className="mt-4">
                <Label className="text-muted">Revenue share at scale</Label>
              </p>
            </div>

            <div className="lg:col-span-6 lg:col-start-7 lg:pt-2">
              <p className="max-w-[52ch] text-[17px] text-muted">
                <Copy>
                  Put us in your campaign brief. Your roster ships 10x the
                  content and you take up to 50% of every subscription that
                  comes from it, for as long as they stay.
                </Copy>
              </p>
              <a
                href="#start"
                className="mt-8 inline-block border border-line px-6 py-3.5 text-fg transition-colors hover:border-acid hover:text-acid"
              >
                <Label>Partner with us</Label>
              </a>
            </div>
          </div>
        </section>

        {/* ── 9 · FAQ ────────────────────────────────────────────── */}
        <Faq />

        {/* ── START · waitlist ───────────────────────────────────── */}
        <section id="start" className="shell mt-24 lg:mt-40">
          <Rule />
          <div className="grid grid-cols-1 gap-10 pt-14 lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <h2 className="text-[clamp(2rem,4.4vw,3.5rem)]">
                Make two, then decide.
              </h2>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <SignupForm />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

/* ── 10 · FOOTER ──────────────────────────────────────────────────── */

const FOOTER_LINKS = [
  {
    heading: "Product",
    links: ["How it works", "Pricing", "Zero-Gen mode", "Templates"],
  },
  {
    heading: "Clippers",
    links: ["Live campaigns", "Campaign rules", "Payout tracking", "Discord"],
  },
  {
    heading: "Agencies",
    links: ["Revenue share", "Roster tools", "Brand kits", "Contact"],
  },
];

function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-line lg:mt-40">
      <div className="shell">
        <a
          href="#start"
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-10 text-acid transition-opacity hover:opacity-80"
        >
          <span
            className="text-[clamp(1.75rem,5vw,3rem)] font-extrabold tracking-[-0.03em]"
            style={{ fontStretch: "125%" }}
          >
            <Copy>2 free carousels. No card.</Copy>
          </span>
          <span className="text-[clamp(1.75rem,5vw,3rem)] leading-none font-extrabold">
            →
          </span>
        </a>

        <div className="grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <span
              className="text-[19px] font-extrabold tracking-[-0.045em] text-fg lowercase"
              style={{ fontStretch: "125%" }}
            >
              futureclips
            </span>
            <p className="mt-3 max-w-[24ch] text-[13px] text-muted">
              Carousels for paid clip campaigns.
            </p>
          </div>

          {FOOTER_LINKS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <Label className="text-muted">{col.heading}</Label>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#start"
                      className="text-[14px] text-muted transition-colors hover:text-fg"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-7">
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            © 2026 Future Clips
          </span>
          <span className="font-mono text-[11px] tracking-[0.1em] text-muted uppercase">
            Built for people who get paid per view
          </span>
        </div>
      </div>
    </footer>
  );
}
