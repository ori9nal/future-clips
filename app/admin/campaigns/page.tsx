import { listSpecs } from "@/lib/specs";
import { isAdmin, adminSecret, ADMIN_COOKIE } from "@/lib/admin";
import { AdminClient } from "./AdminClient";
import { redirect } from "next/navigation";
import "../../studio/studio.css";
import "./admin.css";

export const dynamic = "force-dynamic";

/**
 * Unlock form. A shared secret, not authentication — see lib/admin.ts. It is a
 * server action so the secret is compared server-side and never reaches the
 * client bundle.
 */
async function unlock(formData: FormData) {
  "use server";
  const { cookies } = await import("next/headers");
  const secret = adminSecret();
  const given = String(formData.get("secret") ?? "");
  if (secret && given === secret) {
    (await cookies()).set(ADMIN_COOKIE, secret, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect("/admin/campaigns");
  }
  redirect("/admin/campaigns?bad=1");
}

export default async function AdminCampaignsPage({
  searchParams,
}: { searchParams: Promise<{ bad?: string }> }) {
  const { bad } = await searchParams;
  const ok = await isAdmin();
  const configured = !!adminSecret();

  if (!ok) {
    return (
      <main className="studio">
        <header>
          <p className="eyebrow">Future Clips — Admin</p>
          <h1>Campaigns</h1>
          <p className="lede">
            {configured
              ? "Admin only. Enter the admin secret to continue."
              : "FC_ADMIN_SECRET is not set on the server, so this page cannot be unlocked. Set it in .env.local and restart."}
          </p>
        </header>
        {configured && (
          <form action={unlock} className="panel">
            <div className="field">
              <label htmlFor="secret">Admin secret</label>
              <input id="secret" name="secret" type="password" autoComplete="off" />
            </div>
            <button className="primary" type="submit">Unlock</button>
            {bad && <p className="error" role="alert">That secret is not right.</p>}
          </form>
        )}
      </main>
    );
  }

  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Admin</p>
        <h1>Campaigns</h1>
        <p className="lede">
          Paste a brief once. The extractor separates the rules that get a post <em>rejected</em>
          {" "}from advice about what performs well, and only the first kind is enforced before a
          render. Clippers then generate against it from the <a href="/studio">studio</a>.
        </p>
      </header>
      <AdminClient campaigns={listSpecs() as any[]} gateOn={configured} />
    </main>
  );
}
