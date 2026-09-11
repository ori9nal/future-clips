/**
 * The brand-kit campaign — the shape `campaigns.data` holds when
 * `kind = 'campaign'`. Admin-authored; clippers never author any of it.
 *
 * The store is lib/db/campaigns.ts (Supabase); the two kinds are kept apart
 * by `kind` there and by isCampaign / isSpec here, so the admin form can
 * never rebuild a spec from its own fields and erase the brief.
 */
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
export function isCampaign(o: any): o is Campaign {
  return !!(o && typeof o === "object" && o.brand && typeof o.brand === "object" && o.brand.colors);
}
