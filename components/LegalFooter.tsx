import Link from "next/link";
import { PAGES } from "@/legal/render.mjs";

/**
 * The Trust and Legal strip every page carries (the policies say so, and so
 * does the publishing checklist that came with them). Same five links as the
 * marketing site's footer; here they resolve on this host.
 */
export function LegalFooter() {
  return (
    <footer className="fc-legal-foot" aria-label="Trust and Legal">
      <span className="fc-legal-foot-label">Trust and Legal</span>
      <nav>
        {PAGES.map((p) => (
          <Link key={p.slug} href={`/${p.slug}`}>{p.short}</Link>
        ))}
        <a href="mailto:team@thefutureclips.com">team@thefutureclips.com</a>
      </nav>
      <span className="fc-legal-foot-copy">&copy; 2026 The Future Clips</span>
    </footer>
  );
}
