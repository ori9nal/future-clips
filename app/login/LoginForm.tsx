"use client";

import { useState } from "react";

/**
 * The sign-in form. The email goes to /api/auth/otp, which asks Supabase for
 * the magic link from the server, so this page ships no Supabase client to
 * the browser. Whether an email may sign up at all is decided in the
 * database (allowed_emails + the invite gate), not here.
 */
type Reply = { ok?: boolean; url?: string; error?: string };

async function post(path: string, body: Record<string, string>): Promise<Reply> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return (await res.json()) as Reply;
  } catch {
    return { error: "We could not reach the sign-in service. Check your connection and try again." };
  }
}

export function LoginForm({ next, initialError, googleEnabled }: { next: string; initialError: string | null; googleEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await post("/api/auth/otp", { email: email.trim().toLowerCase(), next });
    setBusy(false);
    if (r.error) { setError(r.error); return; }
    setSent(true);
  }

  async function google() {
    setBusy(true); setError(null);
    const r = await post("/api/auth/google", { next });
    if (r.url) { window.location.assign(r.url); return; }
    setBusy(false); setError(r.error ?? "Google sign-in is not available right now.");
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
