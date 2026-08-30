/**
 * Campaign spec store.
 *
 * A spec is the single representation: the render engine consumes it directly
 * (engine/render-native.mjs `renderCampaign({ spec })`), the studio lists from
 * it, and the admin form writes it. There is no second shape to keep in sync.
 * Swapping the file store for Postgres is a change to the four functions at the
 * bottom, not to the type.
 */
import fs from "node:fs";
import path from "node:path";

export type Ranked = { photo: number | string; name: string; score?: string; lines: string[] };

export type Spec = {
  id: string;
  brand: string;
  product: string;
  niche: string;
  advertiser?: string;
  agency?: string;
  status?: string;
  payout: {
    rate_usd: number;
    min_payout_usd: number;
    max_payout_usd: number;
    budget_total_usd: number;
    budget_remaining_usd: number;
    review_days: number;
    platforms: string[];
  };
  requirements: {
    min_slides: number;
    max_slides: number;
    aspect: string;
    required_mention: string;
    must_show_app?: boolean;
  };
  rules: { banned_claims: string[]; banned_topics?: string[]; tone?: string; disclosure?: string };
  assets: {
    palette: string[];
    mascot: string | null;
    photos: { dir: string; credit?: string };
    app_screen?: string | null;
  };
  content: {
    style: "native" | "mascot";
    hook: { photo: number | string; lines: string[]; sub?: string[] };
    ranked: Ranked[];
    closer: { photo?: number | string; screen?: string; lines: string[]; cta: string };
  };
};

const DIR = path.join(process.cwd(), "campaigns");

/** Only files that carry the new spec shape — the folder also holds legacy briefs. */
function isSpec(o: any): o is Spec {
  return !!o && typeof o === "object" && o.content?.hook && Array.isArray(o.content?.ranked) && o.assets?.photos?.dir;
}

export function listSpecs(): Spec[] {
  if (!fs.existsSync(DIR)) return [];
  const out: Spec[] = [];
  for (const f of fs.readdirSync(DIR)) {
    if (!f.endsWith(".json")) continue;
    try {
      const o = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
      if (isSpec(o)) out.push({ ...o, id: f.replace(/\.json$/, "") });
    } catch {
      /* a malformed file must not take the whole list down */
    }
  }
  return out.sort((a, b) => a.brand.localeCompare(b.brand));
}

export function getSpec(id: string): Spec | null {
  const f = path.join(DIR, `${path.basename(id)}.json`);
  if (!fs.existsSync(f)) return null;
  try {
    const o = JSON.parse(fs.readFileSync(f, "utf8"));
    return isSpec(o) ? { ...o, id } : null;
  } catch {
    return null;
  }
}

export function saveSpec(spec: Spec): Spec {
  const id = spec.id.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  if (!id) throw new Error("campaign id is required");
  fs.mkdirSync(DIR, { recursive: true });
  const out = { ...spec, id };
  fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(out, null, 2));
  return out;
}

/** Photos available to a campaign, so the studio can offer real choices. */
export function photosFor(spec: Spec): string[] {
  const dir = path.join(process.cwd(), spec.assets.photos.dir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png)$/i.test(f) && !f.startsWith("_"))
    .map((f) => f.replace(/\.\w+$/, ""));
}
