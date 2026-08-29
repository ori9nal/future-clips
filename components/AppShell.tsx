import Link from "next/link";
import "../app/app.css";

/** The product shell: floating pill nav over the warm gradient ground. */
export default function AppShell({
  active,
  children,
}: {
  active: "studio" | "admin";
  children: React.ReactNode;
}) {
  return (
    <div className="fc">
      <nav className="fc-nav">
        <Link href="/" className="fc-brand">
          <span className="fc-mark" aria-hidden />
          <span>
            <small>The</small>
            <b>futureclips</b>
          </span>
        </Link>
        <div className="fc-links">
          <Link href="/studio" data-on={active === "studio" ? "1" : "0"}>Studio</Link>
          <Link href="/admin" data-on={active === "admin" ? "1" : "0"}>Campaigns</Link>
        </div>
      </nav>
      <div className="fc-wrap">{children}</div>
    </div>
  );
}
