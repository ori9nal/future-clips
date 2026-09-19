"use client";

import { useState } from "react";

/** Laptops only (FC_DEV_LOGIN=1): one click into a test account, no email. Rendered by app/login/page.tsx in development. */
export function DevLogin({ next }: { next: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function go(who: "demo" | "tester") {
    setBusy(who); setError(null);
    try {
      const r = await fetch("/api/auth/dev", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ who, next }) });
      const j = (await r.json()) as { ok?: boolean; next?: string; error?: string };
      if (j.ok) { window.location.assign(j.next ?? next); return; }
      setError(j.error ?? "could not sign in");
    } catch { setError("could not reach the dev sign-in route"); }
    setBusy(null);
  }
  return (
    <div className="fc-card" style={{ marginTop: 18 }} data-dev-login="1">
      <p className="fc-note" style={{ marginBottom: 10 }}><b>Local test accounts</b> · this box exists only on this machine</p>
      <div className="fc-form" style={{ gridAutoFlow: "column", justifyContent: "start", gap: 10 }}>
        <button type="button" className="fc-btn" data-variant="ghost" data-size="sm" disabled={!!busy} onClick={() => go("tester")}>{busy === "tester" ? "Signing in…" : "Tester · Pro workspace"}</button>
        <button type="button" className="fc-btn" data-variant="ghost" data-size="sm" disabled={!!busy} onClick={() => go("demo")}>{busy === "demo" ? "Signing in…" : "Demo viewer"}</button>
      </div>
      {error && <p className="fc-err-line" role="alert" style={{ marginTop: 10 }}>{error}</p>}
    </div>
  );
}
