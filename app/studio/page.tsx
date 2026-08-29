import fs from "node:fs";
import path from "node:path";
import { listCampaigns } from "@/lib/campaigns";
import StudioClient from "./StudioClient";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default function StudioPage() {
  const campaigns = listCampaigns().map((c) => {
    const cf = path.join(process.cwd(), "concepts", `${c.id}.json`);
    const concepts = fs.existsSync(cf)
      ? JSON.parse(fs.readFileSync(cf, "utf8")).concepts.map((x: any, i: number) => ({
          i,
          hook: x.hook,
          structure: x.structure_type,
          slides: x.slides.length + 2,
        }))
      : [];
    return {
      id: c.id,
      name: c.name,
      niche: c.niche,
      handle: c.brand.handle,
      ink: c.brand.colors.ink,
      paper: c.brand.colors.paper,
      accent: Object.values(c.brand.colors.accents)[0] as string,
      concepts,
    };
  });

  const families = fs
    .readdirSync(path.join(process.cwd(), "templates"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const t = JSON.parse(fs.readFileSync(path.join(process.cwd(), "templates", f), "utf8"));
      return { id: t.id, name: t.name, canvas: `${t.canvas.w}x${t.canvas.h}` };
    });

  return (
    <AppShell active="studio">
      <StudioClient campaigns={campaigns} families={families} />
    </AppShell>
  );
}
