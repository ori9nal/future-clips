"use client";

import { useEffect } from "react";

/**
 * The app's error boundary: something threw while rendering a page. The
 * message stays generic (a stack trace is not for the customer); the digest
 * is what to quote to support, and the console carries the rest in dev.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="fc fc-login">
      <div className="fc-login-card" role="alert">
        <h1>Something went wrong.</h1>
        <p className="fc-sub">Nothing you did caused it, and nothing was charged. Try again; if it keeps happening, email team@thefutureclips.com{error.digest ? ` and mention ${error.digest}` : ""}.</p>
        <button type="button" className="fc-btn" onClick={reset} style={{ marginTop: 8 }}>Try again</button>
      </div>
    </main>
  );
}
