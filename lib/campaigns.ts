/**
 * Campaign store — server side only.
 *
 * A partner campaign is everything an agency hands over once: brand kit,
 * handle, rules, and source visuals. Clippers never author any of it; they open
 * a campaign and generate. So every mutation here lives behind /admin.
 *
 * Backed by JSON files under campaigns/ because that is exactly what the render
 * engine consumes (engine/index.mjs `renderCarousel({ campaign })`) — one
 * representation, no sync step. Moving this to Postgres is a swap of the four
 * functions at the bottom, not a change to the shape.
 */
import fs from "node:fs";
import path from "node:path";

export type BrandKit = {
  name: string;
  handle: string;
  wordmark: string;
  colors: {
    ink: string;
    paper: string;
    accents: Record<string, string>;
  };
  logo: string | null;
};

export type CampaignRules = {
  required_mention: string;
  min_slides: number;
  max_slides: number;
  canvas: string;
  banned_phrases: string[];
  banned_claims: string[];
  cta_required_on_last: boolean;
  zero_gen_mode: boolean;
};

export type Campaign = {
  id: string;
  name: string;
  niche: string;
  agency?: { code: string; name: string; contact: string } | null;
  brand: BrandKit;
  rules: CampaignRules;
  source: {
    video: string | null;
    libraries: { niche: string; kind: string }[];
    uploads?: string[];
  };
  updatedAt?: string;
};

const DIR = path.join(process.cwd(), "campaigns");

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

export function emptyCampaign(): Campaign {
  return {
    id: "",
    name: "",
    niche: "fitness",
    agency: null,
    brand: {
      name: "",
      handle: "",
      wordmark: "",
      // Defaults encode the measured direction: white ground, no accent colour.
      // An accent identical to ink satisfies the one-chromatic-cluster gate by
      // construction rather than by luck.
      colors: { ink: "#111111", paper: "#FFFFFF", accents: { mono: "#111111" } },
      logo: null,
    },
    rules: {
      required_mention: "",
      min_slides: 6,
      max_slides: 11,
      canvas: "1080x1440",
      banned_phrases: [],
      banned_claims: [],
      cta_required_on_last: true,
      zero_gen_mode: false,
    },
    source: { video: null, libraries: [{ niche: "fitness", kind: "people" }], uploads: [] },
  };
}

/**
 * campaigns/ holds two shapes. This one (brand kit object, admin-authored) and
 * the engine's spec (brand as a string, authored content — see lib/specs.ts
 * `isSpec`). The admin form rebuilds the whole object on save, so letting a
 * spec through here would let /admin silently overwrite its brief and content.
 * Mirror of `isSpec`: each loader only returns its own shape.
 */
function isCampaign(o: any): o is Campaign {
  return !!(o && typeof o === "object" && o.brand && typeof o.brand === "object" && o.brand.colors);
}

export function listCampaigns(): Campaign[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")))
    .filter(isCampaign)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

export function getCampaign(id: string): Campaign | null {
  const f = path.join(DIR, `${path.basename(id)}.json`);
  if (!fs.existsSync(f)) return null;
  const o = JSON.parse(fs.readFileSync(f, "utf8"));
  return isCampaign(o) ? o : null;
}

export function saveCampaign(c: Campaign): Campaign {
  if (!c.id) throw new Error("campaign needs an id");
  fs.mkdirSync(DIR, { recursive: true });
  const next = { ...c, updatedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(DIR, `${c.id}.json`), JSON.stringify(next, null, 2) + "\n");
  return next;
}

export function deleteCampaign(id: string) {
  const f = path.join(DIR, `${id}.json`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

/** Cutouts currently available to a campaign, with attribution. */
export function libraryFor(niche: string, kind = "people") {
  const f = path.join(process.cwd(), "assets/library", niche, `${kind}.json`);
  if (!fs.existsSync(f)) return { items: [] as any[] };
  return JSON.parse(fs.readFileSync(f, "utf8")) as { items: any[] };
}
