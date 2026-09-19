import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LegalFooter } from "@/components/LegalFooter";

/** The app's 404: the same card as the sign-in page, one way back. */
export default function NotFound() {
  return (
    <main className="fc fc-login">
      <div className="fc-login-card">
        <a href="https://www.thefutureclips.com" className="fc-brand" style={{ marginBottom: 26 }}>
          <BrandMark />
          <span><small>The</small><b>futureclips</b></span>
        </a>
        <h1>That page is not here.</h1>
        <p className="fc-sub">The link may be old, or the address has a typo.</p>
        <Link href="/app" className="fc-btn" style={{ display: "inline-block", marginTop: 8 }}>Open the app</Link>
        <LegalFooter />
      </div>
    </main>
  );
}
