import { listSpecs } from "@/lib/specs";
import { StudioClient } from "./StudioClient";
import "./studio.css";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  const campaigns = listSpecs();
  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Studio</p>
        <h1>Pick a campaign. Render the set.</h1>
        <p className="lede">
          The brief decides the format, the mention and the banned claims. You pick the style and
          hit render. <a href="/admin/new">Add a campaign</a>
        </p>
      </header>
      <StudioClient campaigns={campaigns} />
    </main>
  );
}
