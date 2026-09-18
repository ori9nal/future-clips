import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import type { Viewer } from "@/lib/auth";
import { engineAvailable } from "@/lib/engine";
import { LegalFooter } from "@/components/LegalFooter";
import { planLabel } from "@/lib/plans";

/**
 * The product shell: floating pill nav over the warm gradient ground.
 * Admin links render only for platform owners — and the routes behind them
 * check again server-side, so hiding a link is a courtesy, not the gate.
 */
export default function AppShell({
  active,
  viewer,
  children,
}: {
  active: "app" | "usage" | "admin" | "studio";
  viewer: Viewer;
  children: React.ReactNode;
}) {
  return (
    <div className="fc">
      <nav className="fc-nav">
        <Link href="/app" className="fc-brand">
          <BrandMark />
          <span>
            <small>The</small>
            <b>futureclips</b>
          </span>
        </Link>
        <div className="fc-links">
          <Link href="/app" data-on={active === "app" ? "1" : "0"}>App</Link>
          <Link href="/app?page=settings&tab=plan" data-on={active === "usage" ? "1" : "0"}>Usage</Link>
          <Link href="/admin/partners">Partners</Link>
          {viewer.isPlatformOwner && (
            <>
              {engineAvailable() && <Link href="/studio" data-on={active === "studio" ? "1" : "0"}>Studio</Link>}
              <Link href="/admin" data-on={active === "admin" ? "1" : "0"}>Admin</Link>
            </>
          )}
        </div>
        <details className="fc-who">
          <summary>
            <span className="fc-tag">{planLabel({ id: viewer.org.plan })}</span>
            <span className="fc-who-email">{viewer.user.email}</span>
          </summary>
          <div className="fc-who-menu">
            <p className="fc-note">{viewer.org.name} · {viewer.role}{viewer.isPlatformOwner ? " · platform owner" : ""}</p>
            <form action="/auth/signout" method="post">
              <button type="submit" className="fc-btn" data-variant="ghost">Sign out</button>
            </form>
          </div>
        </details>
      </nav>
      <div className="fc-wrap">
        {children}
        <LegalFooter />
      </div>
    </div>
  );
}
