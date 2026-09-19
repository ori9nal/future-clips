import type { Metadata } from "next";
import { BrandMark } from "@/components/BrandMark";
import { LoginForm } from "./LoginForm";
import { DevLogin } from "./DevLogin";
import { LegalFooter } from "@/components/LegalFooter";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

/**
 * The only door. Magic-link email (and Google when the OAuth client exists).
 * There is no password to store, guess or leak. Whether an email may sign up
 * at all is decided in the database (allowed_emails + the invite gate), not
 * here — this page just asks Supabase and reports what it said.
 */
export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="fc fc-login">
      <div className="fc-login-card">
        <a href="https://www.thefutureclips.com" className="fc-brand" style={{ marginBottom: 26 }}>
          <BrandMark />
          <span><small>The</small><b>futureclips</b></span>
        </a>
        <h1>Sign in</h1>
        <p className="fc-sub">
          We email you a link. No password. Access is by invite while we are in private beta.
        </p>
        <LoginForm next={next ?? "/app"} initialError={error ?? null} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_AUTH === "1"} />
        {process.env.NODE_ENV !== "production" && process.env.FC_DEV_LOGIN === "1" && <DevLogin next={next ?? "/app"} />}
        <LegalFooter />
      </div>
    </main>
  );
}
