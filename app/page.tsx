import Image from "next/image";
import { Reel } from "@/components/Reel";
import { SignupForm } from "@/components/SignupForm";
import { SHOTS, CAMPAIGNS, byId, src } from "@/lib/carousels";

const STEPS = [
  {
    n: "01",
    title: "Pick a campaign",
    body: "Browse live campaigns with the real pay rate and remaining budget. We flag which ones allow carousels.",
  },
  {
    n: "02",
    title: "Drop your assets",
    body: "Add your clip and the brand kit. We read the fonts, colours and campaign rules, then lock them in.",
  },
  {
    n: "03",
    title: "Post and cash out",
    body: "Export thirty unique carousels and post them across the week. Get paid per verified view, same as video.",
  },
];

const FEATURES = [
  { title: "Hook library", body: "Proven opening lines by niche, so slide one stops the scroll." },
  { title: "Rules engine", body: "Every campaign's banned claims and safe areas, checked before export." },
  { title: "Zero-Gen mode", body: "Uses only your source frames. Nothing generated, for campaigns that ban AI." },
  { title: "Unique every time", body: "Layout, crop and palette are seeded to your account, so no two clippers collide." },
];

const STATUS = [
  { ok: false, title: "No brand partners signed yet", body: "Campaign niches above are market rates, not deals we hold." },
  { ok: false, title: "Nothing is being charged", body: "There's no checkout here. You're joining a list." },
  { ok: false, title: "The examples aren't ours", body: "They're real creator posts, used with permission, to show the format we build." },
  { ok: true, title: "Two free, no card", body: "You'll know if it's worth $20 before we ask for $20." },
];

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "",
    was: "",
    best: false,
    features: ["2 carousels total", "All templates", "No card required"],
    cta: "Start free",
    note: "",
  },
  {
    name: "Clipper",
    price: "$20",
    period: "/mo",
    was: "$29",
    best: true,
    features: ["40 carousels a month", "Hook library", "Campaign rules engine", "Zero-Gen mode"],
    cta: "Claim founding price",
    note: "Locked for as long as you stay subscribed. Goes to $29 at launch.",
  },
  {
    name: "Pro",
    price: "$39",
    period: "/mo",
    was: "",
    best: false,
    features: ["150 carousels a month", "AI imagery", "Priority render", "Brand kits"],
    cta: "Get Pro",
    note: "",
  },
];

const FAQ = [
  {
    q: "Do carousels actually pay?",
    a: "TikTok's Creator Rewards doesn't pay for photo mode, but brand campaigns do — per verified view, on whatever format the campaign allows. We show you which campaigns allow carousels before you start.",
  },
  {
    q: "Are the examples on this page your output?",
    a: "No. Those are real posts by creators in each niche, shown with their permission, so you can see the format that's already earning. Our own output goes up the moment the first campaigns run.",
  },
  {
    q: "Where do the hooks come from?",
    a: "A library of opening lines grouped by niche, built from what's already working in clip campaigns. Edit any of them, or write your own and we'll lay it out.",
  },
  {
    q: "Is this AI slop?",
    a: "We assemble. Layout, typography and your footage are deterministic. AI touches at most one element, and you can switch it off entirely.",
  },
  {
    q: "What does the founding price mean?",
    a: "$20/mo instead of $29, and it doesn't rise while you stay subscribed. No card now, nothing charged until launch.",
  },
];

const FOOTER = [
  { heading: "Product", links: [["How it works", "#how"], ["Format", "#work"], ["Pricing", "#pricing"], ["Zero-Gen mode", "#faq"]] },
  { heading: "Clippers", links: [["Rates", "#campaigns"], ["Campaign rules", "#faq"], ["Status", "#status"], ["Discord", "#start"]] },
  { heading: "Agencies", links: [["Revenue share", "#pricing"], ["Contact", "#start"]] },
];

export default function Home() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          {/* LOGO SLOT */}
          <a href="#top" className="mark">
            <i>F</i>Future Clips
          </a>
          <nav className="nav-mid">
            <a href="#how">How it works</a>
            <a href="#campaigns">Campaigns</a>
            <a href="#work">Format</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="nav-end">
            <a href="#start" className="lg">Log in</a>
            <a href="#start" className="btn btn-dark btn-sm">Start free</a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="wrap">
            <span className="chip">
              <b>Pre-launch</b> Founding price locked at $20/mo
            </span>
            <h1 className="h1">Turn one clip into thirty posts.</h1>
            <p className="lede">
              Future Clips builds campaign-ready carousels in about two minutes.
              Same campaigns, same pay rate, ten times the output.
            </p>
            <div className="hero-btns">
              <a href="#start" className="btn btn-ac">Start clipping free</a>
              <a href="#how" className="btn btn-soft">See how it works</a>
            </div>
            <p className="tiny">No card required · 2 free carousels</p>
          </div>
          <div className="wrap showcase">
            <Reel />
          </div>
        </section>

        <section className="sec" id="how">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">How it works</span>
              <h2 className="h2">Post more. Get paid more.</h2>
              <p>The easiest way to fill a campaign without touching a timeline.</p>
            </div>
            <div className="grid3">
              {STEPS.map((s) => (
                <div className="card" key={s.n}>
                  <span className="step-n">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec sec-tight">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Features</span>
              <h2 className="h2">From campaign to cash out.</h2>
            </div>
            <div className="grid4">
              {FEATURES.map((f) => (
                <div className="card card-flat" key={f.title}>
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec sec-tight" id="campaigns">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Campaign types</span>
              <h2 className="h2">Where carousels already pay.</h2>
              <p>Typical rates in the niches running clip campaigns right now.</p>
            </div>
            <div className="camps">
              {CAMPAIGNS.map((c) => {
                const cover = byId(c.cover);
                const dot = byId(c.dot);
                return (
                  <div className="camp" key={c.name}>
                    <figure className="shot">
                      <Image
                        src={src(cover)}
                        alt={cover.alt}
                        width={cover.w}
                        height={cover.h}
                        sizes="(max-width: 700px) 90vw, (max-width: 1020px) 45vw, 400px"
                      />
                    </figure>
                    <div className="camp-top">
                      <span className="camp-dot">
                        <Image src={src(dot)} alt="" width={68} height={68} />
                      </span>
                      <span className="camp-meta">
                        <b>{c.name}</b>Typical rate · Per view
                      </span>
                    </div>
                    <div className="camp-tags">
                      <span className="tag tag-ok">Carousels allowed</span>
                      <span className="tag">Per view</span>
                    </div>
                    <div className="camp-pay">
                      <b>{c.rate}</b>
                      <span>Per 1M views</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="tiny" style={{ textAlign: "center", marginTop: 22 }}>
              Niche categories and typical market rates, not signed partners. See{" "}
              <a href="#status" style={{ color: "var(--ac-ink)", fontWeight: 500 }}>
                where we are
              </a>
              .
            </p>
          </div>
        </section>

        <section className="sec sec-tight" id="work">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">The format</span>
              <h2 className="h2">This is what already works.</h2>
              <p>
                Real carousels pulling real views in the niches running clip
                campaigns. This is the format Future Clips builds, at thirty a
                day instead of one.
              </p>
            </div>
            <div className="gal">
              {SHOTS.map((s) => (
                <figure key={s.id}>
                  <span className="shot" style={{ display: "block" }}>
                    <Image
                      src={src(s)}
                      alt={s.alt}
                      width={s.w}
                      height={s.h}
                      sizes="(max-width: 620px) 47vw, (max-width: 1000px) 31vw, 230px"
                    />
                  </span>
                  <figcaption>{s.niche ?? " "}</figcaption>
                </figure>
              ))}
            </div>
            <p className="credit">
              Posts by their respective creators, shown with permission. Not
              produced by Future Clips.
            </p>
          </div>
        </section>

        <section className="sec sec-tight" id="status">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">No pitch here</span>
              <h2 className="h2">Exactly where we are.</h2>
            </div>
            <div className="status">
              {STATUS.map((s) => (
                <div className="srow" key={s.title}>
                  <i className={s.ok ? "y" : "n"}>{s.ok ? "✓" : "✕"}</i>
                  <div>
                    <b>{s.title}</b>
                    <p>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec sec-tight" id="pricing">
          <div className="wrap">
            <div className="head">
              <span className="eyebrow">Pricing</span>
              <h2 className="h2">Two free. Then pick a lane.</h2>
            </div>
            <div className="tiers">
              {TIERS.map((t) => (
                <div className={t.best ? "tier tier-best" : "tier"} key={t.name}>
                  <div className="tier-h">
                    <h3>{t.name}</h3>
                    {t.best && <span className="tag tag-ok">Founding price</span>}
                  </div>
                  <p className="cost">
                    <b>{t.price}</b>
                    {t.period && <s>{t.period}</s>}
                    {t.was && <del>{t.was}</del>}
                  </p>
                  <ul>
                    {t.features.map((f) => (
                      <li key={f}>
                        <i>✓</i>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#start"
                    className={t.best ? "btn btn-ac" : "btn btn-soft"}
                  >
                    {t.cta}
                  </a>
                  {t.note && <p className="note">{t.note}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec sec-tight">
          <div className="wrap">
            <div className="brands">
              <div>
                <h2>Running an agency?</h2>
                <p>
                  Put us in your campaign brief. Your roster ships ten times the
                  content and you take up to half of every subscription it
                  brings in.
                </p>
              </div>
              <div className="brands-cta">
                <span className="big">50%</span>
                <a href="#start" className="btn btn-ac">Partner with us</a>
              </div>
            </div>
          </div>
        </section>

        <section className="sec sec-tight" id="faq">
          <div className="wrap">
            <div className="head">
              <h2 className="h2">Frequently asked</h2>
            </div>
            <div className="faq">
              {FAQ.map((f) => (
                <details key={f.q}>
                  <summary>
                    {f.q}
                    <span className="pm">+</span>
                  </summary>
                  <p className="ans">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="sec sec-tight final" id="start">
          <div className="wrap">
            <div className="head">
              <h2 className="h2">Make two, then decide.</h2>
              <p>Two carousels, no card, no call.</p>
            </div>
            <SignupForm />
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="foot">
            <div className="foot-b">
              <span className="mark">
                <i>F</i>Future Clips
              </span>
              <p
                style={{
                  marginTop: 12,
                  fontSize: 14,
                  color: "var(--muted)",
                  maxWidth: "28ch",
                }}
              >
                Campaign-ready carousels for paid clippers.
              </p>
            </div>
            {FOOTER.map((col) => (
              <nav key={col.heading} aria-label={col.heading}>
                <h5>{col.heading}</h5>
                <ul>
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <a href={href}>{label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="foot-bot">
            <span>© 2026 Future Clips</span>
            <span>Built for people who get paid per view</span>
          </div>
        </div>
      </footer>
    </>
  );
}
