import { requirePlatformOwner } from "@/lib/auth";
import Link from "next/link";
import { engineAvailable, ENGINE_MISSING } from "@/lib/engine";
import { createClient } from "@/lib/supabase/server";
import { listSpecs } from "@/lib/db/campaigns";
import { AdminClient } from "./AdminClient";
import "../../studio/studio.css";
import "./admin.css";

export const dynamic = "force-dynamic";

/**
 * Briefs: paste one, the extractor separates the rules that get a post
 * rejected from advice about what performs well, and only the first kind is
 * enforced before a render. Platform owners only — the old shared-secret
 * unlock is gone; the role comes from the database.
 */
export default async function AdminCampaignsPage() {
  await requirePlatformOwner();
  if (!engineAvailable()) {
    return (
      <main className="studio">
        <header>
          <p className="eyebrow">Future Clips</p>
          <h1>Briefs</h1>
          <p className="lede">This surface needs the render engine, and {ENGINE_MISSING}. <Link href="/admin">Back to admin</Link></p>
        </header>
      </main>
    );
  }
  const sb = await createClient();
  const specs = await listSpecs(sb);
  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Admin</p>
        <h1>Briefs</h1>
        <p className="lede">
          Paste a brief once. Clippers then generate against it from the app. <Link href="/admin">Back to admin</Link>
        </p>
      </header>
      <AdminClient campaigns={specs as any[]} />
    </main>
  );
}
