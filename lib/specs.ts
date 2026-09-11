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
