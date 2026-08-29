// THE JUDGE — a deliberately harsh vision review of a finished set.
//
// The brief is "judged by AI for a million views, very harshly". Two things make
// a judge harsh rather than agreeable:
//
//  1. It is shown the REFERENCE and asked to COMPARE, not to rate in a vacuum.
//     A model asked "score this out of 100" converges on 70 for everything.
//     Asked "would this outperform the reference post that did 193k", it has a
//     bar to fail against.
//  2. It must justify every score with something it can point at on the slide,
//     and the scoring rubric is calibrated with an explicit anchor at each end.
//
// It also runs the LOGIC checks — which are deterministic and free, and which
// catch the class of nonsense a vision model happily approves: a CTA that
// promises something the campaign does not offer, a number in slide 3 that
// contradicts slide 5, a hook that closes its own gap.
import fs from 'node:fs';

/* ── deterministic checks: no key, no cost, run first ──────────────────── */

const VERB = /\b(save|follow|steal|try|start|download|comment|share|tap|swipe|get|grab|join|dm|click)\b/i;
const GAP_CLOSERS = /^(here (is|are)|these are|the \d+|\d+ (ways|things|tips|reasons)\b)/i;
const NUMERIC = /\b\d/;

/**
 * @returns {{pass:boolean, failures:string[], warnings:string[]}}
 */
export function logicCheck(carousel) {
  const failures = [], warnings = [];
  const slides = carousel.slides || [];
  const text = (s) => [s.headline, s.lead, s.tail, s.body, s.label].filter(Boolean).join(' ');
  const all = slides.map(text);

  if (slides.length < 5) failures.push(`only ${slides.length} slides — under the 5-slide floor for swipe-through`);
  if (slides.length > 10) failures.push(`${slides.length} slides — past the 10-slide drop-off cliff`);

  const hook = all[0] || '';
  if (!hook) failures.push('no hook on slide 1');
  if (GAP_CLOSERS.test(hook.trim())) failures.push(`hook closes its own gap: "${hook.slice(0, 60)}"`);
  if (hook.split(/\s+/).length > 9) warnings.push(`hook is ${hook.split(/\s+/).length} words — reference median is 5`);
  if (!NUMERIC.test(all.join(' '))) warnings.push('no number anywhere in the set — the reference hooks all carry one');

  const last = all[all.length - 1] || '';
  if (!VERB.test(last)) failures.push('final slide has no CTA verb');

  // A promise the campaign cannot keep is worse than a weak hook: it gets the
  // clipper's submission rejected in review, which costs them 9 days.
  const offers = carousel.campaign?.offers || [];
  const claimed = all.join(' ').toLowerCase();
  for (const banned of carousel.campaign?.rules?.banned_claims || []) {
    if (claimed.includes(String(banned).toLowerCase())) failures.push(`banned claim present: "${banned}"`);
  }
  if (carousel.campaign?.rules?.required_mention) {
    const h = carousel.campaign.rules.required_mention.toLowerCase();
    if (!slides.some((s) => JSON.stringify(s).toLowerCase().includes(h))) {
      failures.push(`required mention "${carousel.campaign.rules.required_mention}" missing`);
    }
  }

  // numeric contradiction: the same unit claimed with two different values
  const nums = {};
  for (const [i, t] of all.entries()) {
    for (const m of t.matchAll(/(\d[\d,.]*)\s*(slides?|minutes?|carousels?|platforms?)/gi)) {
      const unit = m[2].toLowerCase().replace(/s$/, '');
      const val = m[1].replace(/,/g, '');
      if (nums[unit] && nums[unit].val !== val) {
        failures.push(`contradiction: "${nums[unit].val} ${unit}" on slide ${nums[unit].i + 1} vs "${val} ${unit}" on slide ${i + 1}`);
      } else nums[unit] = { val, i };
    }
  }

  const dupes = all.filter((t, i) => t && all.indexOf(t) !== i);
  if (dupes.length) warnings.push(`${dupes.length} duplicated slide text`);

  return { pass: failures.length === 0, failures, warnings };
}

/* ── the vision judge ──────────────────────────────────────────────────── */

export const RUBRIC = [
  ['hook', 25, 'Would a 22-year-old clipper stop scrolling and swipe? An OFFER with a number beats a claim. 25 = "steal my carousel system / 35 slides in 2 minutes". 0 = a statement of opinion.'],
  ['craft', 20, 'Does it look commissioned or generated? 20 = indistinguishable from a $2,000 design. 0 = a Canva default with the type parked at the bottom.'],
  ['density', 15, 'Is the frame doing work? 15 = the reference collage, ~14 meaningful elements. 0 = one photo and one line of type.'],
  ['cohesion', 15, 'Does the SET read as one thing? 15 = one shoot, one grade, one voice. 0 = seven unrelated posters.'],
  ['brand', 15, 'Would you know the account without the handle? 15 = unmistakable. 0 = generic.'],
  ['payload', 10, 'Is there a reason to SAVE it? 10 = concrete, reusable, specific. 0 = motivational filler.'],
];

export const JUDGE_SYSTEM = `You are the harshest carousel critic on the internet, reviewing for one question only: would this set plausibly pass ONE MILLION views?

You are shown REFERENCE slides that verifiably did those numbers, then the CANDIDATE. Score the candidate ONLY relative to the reference.

Calibration, and you must hold this line:
- 90-100 is reserved for work that would BEAT the reference. Almost nothing earns this.
- 70-89 means it would plausibly do comparable numbers.
- 50-69 means competent but forgettable — it dies at slide one.
- Below 50 means visibly generated.
A default score of 70 for mediocre work is a FAILURE OF YOUR JOB. Most submissions are 30-55. Say so.

For every axis you must quote the specific thing on the specific slide that cost the points. "Feels generic" is not a finding; "slide 3 sets 62px type at the bottom exactly like slides 1, 2, 4 and 5" is.

Finish with the single highest-leverage change. One. Not a list.`;

export function judgeUserPrompt(rubric = RUBRIC) {
  return `Score the CANDIDATE on each axis. Max points in brackets.

${rubric.map(([k, max, desc]) => `- ${k} [${max}]: ${desc}`).join('\n')}

Return JSON only:
{"scores":{"hook":n,...},"total":n,"verdict":"beat|comparable|forgettable|generated",
 "findings":[{"axis":"hook","slide":1,"quote":"what you see","cost":-8}],
 "highestLeverageChange":"one sentence"}`;
}

/**
 * Runs the judge. Deterministic logic first — if the set is nonsense there is no
 * point paying a vision model to tell you it is pretty.
 *
 * @param {object} o
 * @param {object} o.carousel   slide copy + campaign
 * @param {string[]} o.slideFiles rendered slide paths
 * @param {string[]} o.referenceFiles reference slides that hit the numbers
 * @param {object} o.budget     BudgetLedger
 * @param {function} o.callVision  ({system,user,images}) => text   (key-gated)
 */
export async function judge({ carousel, slideFiles, referenceFiles, budget, callVision }) {
  const logic = logicCheck(carousel);
  if (!logic.pass) {
    return { blocked: true, stage: 'logic', logic,
      note: 'Logic failed; vision judging skipped. Fix these first — they are free to detect and fatal in review.' };
  }
  if (!callVision) {
    return { blocked: true, stage: 'no-key', logic,
      note: 'Logic passed. Vision judging needs an Anthropic key.' };
  }

  const images = [...referenceFiles.slice(0, 3), ...slideFiles.slice(0, 7)];
  // ~1.6k tokens an image on Sonnet 5 plus the prompt; priced before the call
  const estimate = images.length * 0.0032 + 0.004;

  const raw = await budget.spend(estimate, { note: 'judge', slides: slideFiles.length }, async () => {
    const text = await callVision({
      system: JUDGE_SYSTEM,
      user: judgeUserPrompt(),
      images,
      referenceCount: Math.min(3, referenceFiles.length),
    });
    return { result: text, actualUsd: estimate };
  });

  let parsed = null;
  try { parsed = JSON.parse(String(raw).replace(/^```json\s*|\s*```$/g, '')); }
  catch { return { blocked: true, stage: 'parse', logic, raw }; }

  return { blocked: false, logic, ...parsed, images: images.length };
}
