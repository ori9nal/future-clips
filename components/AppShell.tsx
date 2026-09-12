import Link from "next/link";
import type { Viewer } from "@/lib/auth";
import { engineAvailable } from "@/lib/engine";
import { LegalFooter } from "@/components/LegalFooter";

const PLAN_LABEL: Record<string, string> = { free: "Free", solo: "Solo", grind: "Grind", agency: "Agency" };

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
          <span className="fc-mark" aria-hidden />
          <span>
            <small>The</small>
            <b>futureclips</b>
          </span>
        </Link>
        <div className="fc-links">
          <Link href="/app" data-on={active === "app" ? "1" : "0"}>Campaigns</Link>
          <Link href="/app/usage" data-on={active === "usage" ? "1" : "0"}>Usage</Link>
          {viewer.isPlatformOwner && (
            <>
              {engineAvailable() && <Link href="/studio" data-on={active === "studio" ? "1" : "0"}>Studio</Link>}
              <Link href="/admin" data-on={active === "admin" ? "1" : "0"}>Admin</Link>
            </>
          )}
        </div>
        <details className="fc-who">
          <summary>
            <span className="fc-tag">{PLAN_LABEL[viewer.org.plan] ?? viewer.org.plan}</span>
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
