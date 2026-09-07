// Brief ingest: raw brief text in, enforceable campaign out.
//
// An agency sends prose. The engine needs rules it can check. The gap between
// those two is the whole job here, and the thing that makes it worth doing is
// that briefs bury the hard rules in among the soft ones — "emotional angle
// performs best" sits in the same bullet list as "a post that says only
// TradeLens does not meet the brief", and only one of those gets you rejected.
//
// So the extraction is told to separate them, and anything it marks as a hard
// rule is enforced in code afterwards by engine/compliance.mjs.
import { completeJson } from './providers/claude.mjs';

const SYSTEM = `You convert a creator-campaign brief into a strict JSON campaign spec.

You are reading a brief written for human clippers. Your job is to separate rules that get a
post REJECTED from advice about what performs well. Only the first kind goes in "rules" and
"requirements"; the second kind goes in "guidance".

Emit ONE JSON object, no prose, no code fence, with exactly this shape:

{
  "id": "kebab-case-slug",
  "brand": "exact product name as it must be written",
  "product": "short description",
  "niche": "one word",
  "advertiser": "string or null",
  "agency": "string or null",
  "platforms": ["tiktok"],
  "payout": {
    "rate_usd": number, "min_payout_usd": number, "max_payout_usd": number,
    "budget_total_usd": number, "budget_remaining_usd": number,
    "review_days": number, "platforms": ["..."]
  },
  "requirements": {
    "min_slides": number, "max_slides": number, "aspect": "9:16",
    "required_mention": "@handle or null",
    "must_show_app": boolean,
    "app_placement": [ { "when_slides": [lo, hi], "on_slides": [n, n] } ],
    "first_slide_must_be_hook": boolean,
    "language": "English",
    "audience_tier1_pct": number or null
  },
  "rules": {
    "required_phrase": "the exact string that must always appear, or null",
    "never_bare": "the truncated form that is forbidden on its own, or null",
    "banned_claims": ["..."],
    "banned_topics": ["..."],
    "tone": "one sentence",
    "no_exclamation": boolean
  },
  "guidance": {
    "hook_style": "...", "angles": ["..."], "notes": ["..."]
  },
  "assets": { "palette": ["#hex","#hex","#hex"], "mascot": null, "photos": { "dir": null } }
}

Rules for the extraction itself:
- "required_phrase" / "never_bare": if the brief says a product must ALWAYS be written a certain
  way and never truncated, set required_phrase to the full form and never_bare to the truncated
  form. Otherwise both null.
- "app_placement": read the brief's slide-count table literally. Each row is a slide-count range
  and the slides the app may appear on. Empty array if the brief does not specify.
- "min_slides"/"max_slides": briefs often state these under a "what works" or "tips" heading
  rather than under "rules" ("5 to 10 slides max"). Take them from wherever they appear — a
  stated slide range is a requirement even when it is phrased as advice.
- "banned_claims": exact phrases a reviewer would search for. Prefer short specific strings over
  long sentences, because they are matched literally.
- Numbers must be numbers, not strings. Use null where the brief is silent — never invent a value.
- Pick a sensible three-colour palette that fits the product if the brief gives none.`;

/**
 * @param {object} o
 * @param {string} o.root
 * @param {string} o.brief   the raw brief text
 * @param {string} [o.model]
 */
export async function ingestBrief({ root, brief, model = 'claude-opus-5' }) {
  const { data, usd } = await completeJson({
    root, model, label: 'ingest', maxTokens: 8000,
    system: SYSTEM,
    user: `Brief:\n\n${brief}`,
  });

  // The model is asked for numbers; a brief that omits one must not become 0,
  // because a 0 budget silently reads as "campaign exhausted".
  const p = data.payout ?? {};
  for (const k of ['rate_usd', 'min_payout_usd', 'max_payout_usd', 'budget_total_usd']) {
    if (p[k] != null && typeof p[k] !== 'number') p[k] = Number(String(p[k]).replace(/[^0-9.]/g, '')) || null;
  }
  if (p.budget_remaining_usd == null) p.budget_remaining_usd = p.budget_total_usd ?? null;
  data.payout = p;
  data.requirements = data.requirements ?? {};
  data.rules = data.rules ?? {};
  data.assets = data.assets ?? { palette: ['#0B0B0C', '#2FD07F', '#F2F0EB'], mascot: null, photos: { dir: null } };

  return { spec: data, usd };
}
