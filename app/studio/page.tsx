import { requirePlatformOwner } from "@/lib/auth";
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
