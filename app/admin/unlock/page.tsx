import Link from "next/link";
import { requirePlatformOwnerOnly } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { totpState, UNLOCK_HOURS } from "@/lib/adminGate";
import { newSecret, otpauthUri, qrSvg, readableSecret } from "@/lib/totp";
import { unlockAdmin } from "../actions";
import "../../studio/studio.css";
import "../new/admin.css";

export const dynamic = "force-dynamic";

/**
 * The admin gate: a six-digit code from an authenticator, every time.
 *
 * First visit shows a QR to scan; after that it is just the code box. The same
 * form handles both — the first correct code for a new secret confirms it.
 */
export default async function Unlock({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const viewer = await requirePlatformOwnerOnly();
  const { e } = await searchParams;
  const sb = await createClient();
  const state = await totpState(sb);

  // an account with no authenticator gets one now; the secret is stored
  // unconfirmed and only becomes real when a code from it checks out
  let qr: string | null = null;
  let secret: string | null = null;
  if (!state.confirmed) {
    secret = newSecret();
    const { error } = await sb.rpc("fc_totp_begin", { p_secret: secret });
    if (!error) qr = await qrSvg(otpauthUri(secret, viewer.user.email));
  }

  const message = e === "bad" ? "That code is not right. Wait for the next one and try again."
    : e === "used" ? "That code has already been used. Wait for the next one."
    : e === "rate" ? "Too many attempts. Try again in a few minutes."
    : e === "none" ? "No authenticator is set up for this account yet."
    : e ? "Could not unlock admin." : null;

  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Admin</p>
        <h1>{state.confirmed ? "Enter your code" : "Set up your authenticator"}</h1>
        <p className="lede">
          {state.confirmed
            ? `Admin asks for a code every time. One code opens it for ${UNLOCK_HOURS} hours on this browser.`
            : "Scan this once with an authenticator app, then type the code it shows. Nothing is sent by email — the code is generated on your phone."}{" "}
          <Link href="/app">Back to the app</Link>
        </p>
      </header>

      <form className="admin-form" action={unlockAdmin}>
        <fieldset>
          <legend>{state.confirmed ? "Six digits" : "Step 1 — scan"}</legend>

          {!state.confirmed && qr && secret && (
            <div className="totp">
              <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="totp-help">
                <p>Google Authenticator, 1Password, Authy, Apple Passwords — any of them.</p>
                <p className="note">Cannot scan? Add it by hand with this key:</p>
                <code className="setupkey">{readableSecret(secret)}</code>
                <p className="note">Time-based, 6 digits, 30 seconds.</p>
              </div>
            </div>
          )}

          <div className="grid">
            <label className="wide">{state.confirmed ? "Code" : "Step 2 — the code it shows"}
              <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
                maxLength={6} required autoFocus placeholder="123456" className="codebox" />
            </label>
          </div>
          {message && <p className="note" style={{ color: "#FF5A5A" }}>{message}</p>}
          <p className="note">
            A code is good for about ninety seconds and only once. Lose the phone and you are locked out of
            admin — keep the setup key in your password manager, or add it to a second device now.
          </p>
        </fieldset>
        <div className="actions">
          <button className="fc-btn" type="submit">{state.confirmed ? "Unlock admin" : "Confirm and unlock"}</button>
        </div>
      </form>
    </main>
  );
}
