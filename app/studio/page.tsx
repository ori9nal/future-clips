import { requirePlatformOwner } from "@/lib/auth";
import { engineAvailable, ENGINE_MISSING } from "@/lib/engine";
import { createClient } from "@/lib/supabase/server";
import { listSpecs } from "@/lib/db/campaigns";
import { StudioClient } from "./StudioClient";
import "./studio.css";

export const dynamic = "force-dynamic";

/**
 * The internal studio: render a campaign's authored content in any style.
 * Platform owners only — the bedrock style generates figures, which costs
 * money, and the customer flow lives under /app.
 */
export default async function StudioPage() {
  await requirePlatformOwner();
  if (!engineAvailable()) {
    return (
      <main className="studio">
        <header>
          <p className="eyebrow">Future Clips</p>
          <h1>Studio</h1>
          <p className="lede">This surface needs the render engine, and {ENGINE_MISSING}. <a href="/admin">Back to admin</a></p>
        </header>
      </main>
    );
  }
  const sb = await createClient();
  const campaigns = await listSpecs(sb);
  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Studio</p>
        <h1>Pick a campaign. Render the set.</h1>
        <p className="lede">
          The brief decides the format, the mention and the banned claims. You pick the style and
          hit render. <a href="/admin/new">Add a campaign</a> · <a href="/app">Back to the app</a>
        </p>
      </header>
      <StudioClient campaigns={campaigns as any} />
    </main>
  );
}
