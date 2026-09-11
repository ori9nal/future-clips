import { requirePlatformOwner } from "@/lib/auth";
import { NewCampaignClient } from "./NewCampaignClient";
import "../../studio/studio.css";
import "./admin.css";

export const dynamic = "force-dynamic";

/**
 * Hand-author a spec. Photo directories were a local-disk feature (untracked
 * output/ folders); hosted campaigns render with art=ai, so none are offered.
 */
export default async function NewCampaignPage() {
  await requirePlatformOwner();
  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Admin</p>
        <h1>Onboard a campaign</h1>
        <p className="lede">
          Everything an agency hands over once: terms, rules, assets and the ranked payload. Saved to the database
          as the same JSON the render engine reads. <a href="/admin">Back to admin</a>
        </p>
      </header>
      <NewCampaignClient photoDirs={[]} />
    </main>
  );
}
