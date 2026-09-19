/**
 * The engine's campaign spec — the shape `campaigns.data` holds when
 * `kind = 'spec'`, and the shape the render engine consumes directly.
 *
 * The store is lib/db/campaigns.ts (Supabase). The files under campaigns/
 * are the seed and the CLI's fixtures; the app never reads them.
 */
export type Ranked = { photo: number | string; name: string; score?: string; lines: string[] };

export type Spec = {
  id: string;
  brand: string;
  /** how the brand writes itself, when it is not just the name */
  wordmark?: string;
  /** the handle a set must mention; the creator's own handle is separate (engine/creator.mjs) */
  handle?: string;
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
  rules: {
    banned_claims: string[]; banned_topics?: string[]; tone?: string; disclosure?: string;
    required_phrase?: string | null; never_bare?: string | null; no_exclamation?: boolean;
  };
  assets: {
    palette: string[];
    mascot: string | null;
    photos: { dir: string; credit?: string };
    app_screen?: string | null;
    /** the brand's own logo, drawn on the deck where a style calls for it */
    logo?: string | null;
    /** the app's icon, for the App Store card the feed style draws (R13) */
    app_icon?: string | null;
    /** the look the frames are drawn in ("cinematic", "clinical", …) */
    look?: string | null;
    /** what the creator uploaded, filled in per set by lib/worker.ts (migration 0020) */
    creator?: { logo?: string; avatar?: string; handle?: string; note?: string };
  };

  /**
   * How to write for this brand. The copy model reads hook_style and angles
   * (engine/generate.mjs); notes are for whoever edits the brief.
   */
  guidance?: { hook_style?: string; angles?: string[]; notes?: string[] };

  /**
   * Everything a brief carries that the renderer does not read but a person
   * needs: who is paying, when it runs, what to imitate, where to send people.
   * Every field is optional — a campaign written before this still loads, and
   * the admin brief editor fills them in.
   */
  client?: {
    /** the agency running the campaign, and how to reach them */
    agency?: { name?: string; contact?: string; code?: string; commission_pct?: number };
    /** the brand paying for it */
    advertiser?: { name?: string; contact?: string; site?: string };
    /** when it runs */
    opens?: string | null;
    closes?: string | null;
    /** the brief as it arrived, for anyone who needs the original words */
    source?: { name?: string; url?: string; received?: string };
  };

  /** What the campaign wants, in the words a person would use. */
  deliverables?: {
    /** how many sets the campaign is asking for, and by when */
    sets_wanted?: number | null;
    due?: string | null;
    /** where the post goes */
    platforms?: string[];
    /** the link a viewer should end up at, and the one to track it with */
    cta_url?: string | null;
    tracking_url?: string | null;
    /** who it is for */
    audience?: string | null;
  };

  /**
   * Posts to imitate: the visual target for this campaign, in the same shape
   * the corpus uses. `path` is a file under the assets bucket or the repo;
   * `url` is where it was found. `note` says what to take from it.
   */
  references?: { path?: string | null; url?: string | null; note?: string | null; kind?: "post" | "screenshot" | "moodboard" | "brand" }[];

  /** The App Store card the feed style draws, when the product is an app (R13). */
  app_store?: {
    title?: string; subtitle?: string; developer?: string;
    rating?: number | null; ratings?: string | null; age?: string | null; category?: string | null;
    theme?: "light" | "dark" | null;
  };
  content: {
    style: "native" | "mascot";
    hook: { photo: number | string; lines: string[]; sub?: string[] };
    ranked: Ranked[];
    closer: { photo?: number | string; screen?: string; lines: string[]; cta: string };
  };
};

/**
 * A campaign is a spec if it carries either authored content or enforceable
 * rules.
 *
 * The original test demanded a written hook and ranked array, which was right
 * when every campaign shipped its copy. Campaigns ingested from a brief have no
 * copy at all — it is generated per request — so requiring it hid exactly the
 * campaigns the admin flow creates.
 */
export function isSpec(o: any): o is Spec {
  if (!o || typeof o !== "object" || !o.brand) return false;
  const authored = !!(o.content?.hook && Array.isArray(o.content?.ranked));
  const enforceable = !!(o.requirements && o.rules);
  return authored || enforceable;
}
