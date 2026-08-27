import { Copy, Index } from "@/components/type";
import { Rule } from "@/components/Rule";

const ITEMS = [
  {
    q: "Is this AI slop?",
    a: "We assemble. Layout, typography and your real footage are deterministic — the same inputs produce the same structure, every time. AI touches at most one element, and you can turn it off entirely.",
  },
  {
    q: "Will campaigns reject AI content?",
    a: "Zero-Gen mode uses only your source frames and brand assets. Nothing generated, nothing synthetic. Toggle it per campaign, before you render.",
  },
  {
    q: "Do slideshows even pay?",
    a: "TikTok's own Creator Rewards doesn't pay for photo mode. Brand campaigns do — they pay per verified view on whatever format the campaign allows. Check the campaign rules; we surface them for you before you start.",
  },
  {
    q: "What if my carousel looks like everyone else's?",
    a: "It can't. Every carousel is seeded to your account — different template, crop, palette, hook structure and slide count. Sixty clippers on one campaign get sixty different posts.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="shell mt-24 lg:mt-40">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-4">
          <h2 className="text-[clamp(2rem,4.4vw,3.25rem)]">
            Questions you were about to ask.
          </h2>
        </div>

        <div className="lg:col-span-7 lg:col-start-6">
          <Rule />
          {ITEMS.map((item, i) => (
            <div key={item.q}>
              <details className="group">
              <summary className="flex items-start gap-4 py-6 text-fg">
                <span className="mt-1.5 shrink-0">
                  <Index>{String(i + 1).padStart(2, "0")}</Index>
                </span>
                <span
                  className="flex-1 text-[18px] font-bold lg:text-[20px]"
                  style={{ fontStretch: "110%", letterSpacing: "-0.02em" }}
                >
                  {item.q}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1 shrink-0 font-mono text-[16px] leading-none text-acid transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
                <p className="max-w-[62ch] pb-7 pl-10 text-[16px] text-muted">
                  <Copy>{item.a}</Copy>
                </p>
              </details>
              <Rule />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
