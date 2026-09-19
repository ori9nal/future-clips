import Link from "next/link";
import { headers } from "next/headers";
import { requirePlatformOwnerOnly } from "@/lib/auth";
import { deviceGateOn, MAX_DEVICES } from "@/lib/adminDevice";
import { trustThisDevice } from "../actions";
import "../../studio/studio.css";
import "../new/admin.css";

export const dynamic = "force-dynamic";

/**
 * Trust this device. A platform owner reaches this page from a device the
 * admin area has never seen; typing the passphrase once writes an http-only
 * cookie that is good for three months (migration 0022).
 */
export default async function TrustDevice({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  await requirePlatformOwnerOnly();
  const { e } = await searchParams;
  const ua = (await headers()).get("user-agent") ?? "";
  const guess = /Android/.test(ua) ? "My phone" : /iPhone|iPad/.test(ua) ? "My phone" : "My laptop";

  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Admin</p>
        <h1>Trust this device</h1>
        <p className="lede">
          The admin area only opens on devices you have trusted. Type the admin passphrase once and this
          browser is remembered for three months; you can revoke it from admin at any time.{" "}
          <Link href="/app">Back to the app</Link>
        </p>
      </header>

      {!deviceGateOn() ? (
        <section className="admin-form">
          <fieldset>
            <legend>Not switched on</legend>
            <p className="note">
              <code>FC_ADMIN_SECRET</code> is not set on this host, so admin is open to every platform owner and
              there is nothing to enrol. Set it in the host&rsquo;s environment to switch the second factor on.
            </p>
          </fieldset>
        </section>
      ) : (
        <form className="admin-form" action={trustThisDevice}>
          <fieldset>
            <legend>Admin passphrase</legend>
            <div className="grid">
              <label className="wide">Passphrase
                <input name="secret" type="password" autoComplete="off" autoFocus required placeholder="The FC_ADMIN_SECRET for this host" />
              </label>
              <label>Call this device<input name="label" defaultValue={guess} maxLength={60} /></label>
            </div>
            {e && <p className="note" style={{ color: "#FF5A5A" }}>{e === "bad" ? "That passphrase is not right." : e === "many" ? `You already have ${MAX_DEVICES} trusted devices. Revoke one from admin first.` : e === "rate" ? "Too many attempts. Try again later." : "Could not trust this device."}</p>}
            <p className="note">
              The passphrase is never stored here and never leaves this form; only a random token for this
              browser is kept, and only as a hash.
            </p>
          </fieldset>
          <div className="actions">
            <button className="fc-btn" type="submit">Trust this device</button>
          </div>
        </form>
      )}
    </main>
  );
}
