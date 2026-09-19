"use client";

import { useState } from "react";

/**
 * The sign-in form. The email goes to /api/auth/otp, which asks Supabase for
 * the magic link from the server, so this page ships no Supabase client to
 * the browser. Whether an email may sign up at all is decided in the
 * database (allowed_emails + the invite gate), not here.
 */
type Reply = { ok?: boolean; url?: string; next?: string; error?: string };

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
  const [code, setCode] = useState("");

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

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await post("/api/auth/verify", { email: email.trim().toLowerCase(), token: code, next });
    if (r.ok) { window.location.assign(r.next ?? next); return; }
    setBusy(false); setError(r.error ?? "That code did not work.");
  }

  if (sent) {
    return (
      <div className="fc-card" role="status">
        <h2>Check your inbox</h2>
        <p className="fc-sub">We sent a sign-in link to <b>{email}</b>. Tap it, or type the code from the email here. Both work once and expire in an hour.</p>
        <form onSubmit={verify} className="fc-form" style={{ marginTop: 14 }}>
          <label>
            <span>Code</span>
            <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required
              placeholder="the code from the email" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))} />
          </label>
          {error && <p className="fc-err-line" role="alert">{error}</p>}
          <button type="submit" className="fc-btn" disabled={busy || code.length < 6} style={{ justifySelf: "stretch" }}>
            {busy ? "Checking…" : "Sign in with the code"}
          </button>
        </form>
        <p className="fc-note" style={{ marginTop: 12 }}>No email? Check spam, then <button type="button" className="fc-link" onClick={() => { setSent(false); setCode(""); setError(null); }}>try again</button>.</p>
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
        <button type="button" className="fc-btn fc-google" data-variant="ghost" onClick={google} disabled={busy} style={{ justifySelf: "stretch" }}>
          <GoogleMark />Continue with Google
        </button>
      )}
    </form>
  );
}

/**
 * Google's own mark, drawn to their sign-in branding guidelines: the four
 * colours as published, never recoloured, never smaller than the label.
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18A13.2 13.2 0 0 1 11 24c0-1.45.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  );
}
