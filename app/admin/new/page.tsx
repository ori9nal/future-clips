import fs from "node:fs";
import path from "node:path";
import { NewCampaignClient } from "./NewCampaignClient";
import "../../studio/studio.css";
import "./admin.css";

export const dynamic = "force-dynamic";

/** Folders under output/ that actually contain usable stills. */
function photoDirs(): string[] {
  const root = path.join(process.cwd(), "output");
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 2 || !fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith("_")) continue;
      const full = path.join(dir, e.name);
      const n = fs.readdirSync(full).filter((f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith("_")).length;
      if (n >= 4) out.push(path.relative(process.cwd(), full).split(path.sep).join("/"));
      walk(full, depth + 1);
    }
  };
  walk(root, 0);
  return out.sort();
}

export default function NewCampaignPage() {
  return (
    <main className="studio">
      <header>
        <p className="eyebrow">Future Clips — Admin</p>
        <h1>Onboard a campaign</h1>
        <p className="lede">
          Everything an agency hands over once: terms, rules, assets and the ranked payload. Saved as
          the same JSON the render engine reads — there is no second copy. <a href="/studio">Back to studio</a>
        </p>
      </header>
      <NewCampaignClient photoDirs={photoDirs()} />
    </main>
  );
}
