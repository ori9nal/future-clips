"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** The error Supabase returns when the invite-gate trigger refuses an insert. */
const INVITE_REFUSED = /database error saving new user|FC_INVITE_ONLY/i;

export function LoginForm({ next, initialError, googleEnabled }: { next: string; initialError: string | null; googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const callback = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next.startsWith("/") ? next : "/app")}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: callback() },
    });
    setBusy(false);
    if (error) {
      setError(INVITE_REFUSED.test(error.message)
        ? "That email is not on the invite list. Ask whoever runs your workspace to add it."
        : error.message);
      return;
    }
    setSent(true);
  }

  async function google() {
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
    if (error) { setBusy(false); setError(error.message); }
  }

  if (sent) {
    return (
      <div className="fc-card" role="status">
        <h2>Check your inbox</h2>
        <p className="fc-sub">We sent a sign-in link to <b>{email}</b>. It works once and expires in an hour.</p>
        <p className="fc-note" style={{ marginTop: 12 }}>No email? Check spam, then <button type="button" className="fc-link" onClick={() => setSent(false)}>try again</button>.</p>
      </div>
    );
  }

  return (
    <form onSubmit={sendLink} className="fc-form">
      <label>
        <span>Email</span>
        <input type="email" name="email" autoComplete="email" inputMode="email" required
          placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {error && <p className="fc-err-line" role="alert">{error}</p>}
      <button type="submit" className="fc-btn" disabled={busy || !email} style={{ justifySelf: "stretch" }}>
        {busy ? "Sending…" : "Email me a sign-in link"}
      </button>
      {googleEnabled && (
        <button type="button" className="fc-btn" data-variant="ghost" onClick={google} disabled={busy} style={{ justifySelf: "stretch" }}>
          Continue with Google
        </button>
      )}
    </form>
  );
}
