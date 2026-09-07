// Content generation for a campaign.
//
// A clipper types a few words — "blown account story, 8 slides" — and gets a
// set back. Everything else comes from the campaign the admin ingested once.
//
// The compliance check is not a report at the end; it is a loop. A set that
// breaks a hard rule is sent back to the model WITH the specific failures, and
// only a passing set is rendered. Reviewers do not fix a non-compliant post,
// they reject it, so shipping one is worse than spending another call.
import { completeJson } from './providers/claude.mjs';
import { check, constraintsFor } from './compliance.mjs';

const SHAPE = `{
  "hook":   { "lines": ["2-4 short lines, hand-broken"], "sub": ["one supporting line"] },
  "ranked": [ { "name": "slide heading", "score": "optional short tag", "lines": ["1-3 short lines"],
                "role": "body | app | proof", "showsApp": false } ],
  "numbering": "countdown | none",
  "closer": { "lines": ["1-2 short lines"], "cta": "the call to action" },
  "caption": "one short line for the post caption",
  "bio": "the profile bio line",
  "hashtags": ["#five", "#of", "#them", "#exactly", "#five"]
}`;

const SYSTEM = `You write carousel copy for a paid creator campaign.

Return ONE JSON object in exactly this shape, no prose and no code fence:

${SHAPE}

How to write it:
- Slide 1 is the hook. It has to stop a scroll on its own, at thumbnail size, with no context.
- Lines are hand-broken for a slide, not sentences. Short. No line longer than about six words
  unless it is body copy.
- Write like a person who did the thing, first person, specific. Not like a brand.
- The "ranked" array is the middle of the set. hook + ranked + closer must total the slide count
  you are given, so ranked has (count - 2) entries.
- Exactly one ranked entry has "role": "app" and "showsApp": true, at the position you are told.
  Its copy describes what the app actually did, concretely — and it is the SHORTEST entry in the
  set, at most two short lines, because that slide is a screenshot and the copy sits over it.
- Never invent a feature the campaign description does not mention.
- The CTA is a fragment, not a sentence: at most six words, no trailing full stop.
- The hook's lines plus its sub must total under 12 words. It is read at thumbnail size.
- "numbering": use "countdown" only when the middle slides are a genuine ranked list that pays
  off at the end. A story told in order gets "none" — numbering a narrative backwards reads as
  a mistake.
- Exactly 5 hashtags.`;

/**
 * @param {object} o
 * @param {string} o.root
 * @param {object} o.spec        the campaign
 * @param {string} o.instruction  the clipper's few words
 * @param {number} o.slideCount
 * @param {number} [o.attempts]
 */
export async function generateContent({ root, spec, instruction, slideCount, attempts = 3, model = 'claude-opus-5' }) {
  const constraints = constraintsFor(spec, slideCount);
  const brief = [
    `Product: ${spec.brand} — ${spec.product}`,
    spec.niche ? `Niche: ${spec.niche}` : null,
    spec.guidance?.hook_style ? `Hook style: ${spec.guidance.hook_style}` : null,
    spec.guidance?.angles?.length ? `Angles that work: ${spec.guidance.angles.join('; ')}` : null,
    '',
    'HARD RULES — a set that breaks any of these is rejected outright:',
    ...constraints.map((c) => `- ${c}`),
  ].filter(Boolean).join('\n');

  let feedback = '';
  let last = null;
  let spent = 0;

  for (let i = 0; i < attempts; i++) {
    const { data, usd } = await completeJson({
      root, model, label: `generate:${spec.id}${i ? `:retry${i}` : ''}`, maxTokens: 8000,
      system: SYSTEM,
      user: `${brief}\n\nWhat the clipper asked for: ${instruction}\nSlide count: ${slideCount}\n${feedback}`,
    });
    spent += usd;

    // fold the generated content into the shape compliance expects
    const slides = [
      { index: 1, role: 'hook', text: [...(data.hook?.lines ?? []), ...(data.hook?.sub ?? [])].join(' '), showsApp: false },
      ...(data.ranked ?? []).map((r, n) => ({
        index: n + 2, role: r.role ?? 'body',
        text: [r.name, r.score, ...(r.lines ?? [])].filter(Boolean).join(' '),
        showsApp: !!r.showsApp,
      })),
      { index: (data.ranked?.length ?? 0) + 2, role: 'close', text: [...(data.closer?.lines ?? []), data.closer?.cta].filter(Boolean).join(' '), showsApp: false },
    ];
    const verdict = check(spec, { slides, caption: data.caption, bio: data.bio });
    last = { data, verdict, slides };

    if (verdict.pass) return { content: data, verdict, usd: spent, attempts: i + 1 };

    // hand the model its own failures verbatim; a general "try again" produces
    // a different set with the same violation
    feedback = `\nYour previous attempt was REJECTED for these reasons. Fix every one:\n` +
      verdict.failures.map((f) => `- ${f}`).join('\n');
  }

  return { content: last.data, verdict: last.verdict, usd: spent, attempts, failed: true };
}

/**
 * Map generated content onto the shape the style renderers consume.
 *
 * The model writes copy; it does not pick photography. Stills are dealt out
 * from the campaign's folder here, one per slide with no repeats, because a set
 * that reuses a frame reads as padding.
 */
export function toRenderable(spec, content, { appScreen, photos = [] } = {}) {
  const pool = [...photos];
  let p = 0;
  const nextPhoto = () => (pool.length ? pool[p++ % pool.length] : undefined);

  const ranked = (content.ranked ?? []).map((r) => {
    const showsApp = !!r.showsApp;
    return {
      name: r.name, score: r.score, lines: r.lines ?? [],
      role: r.role, showsApp,
      // the app slide renders the real screen; everything else takes a still
      screen: showsApp && appScreen ? appScreen : undefined,
      photo: showsApp && appScreen ? undefined : nextPhoto(),
    };
  });

  // Only fall back to putting the app on the closer when no slide already
  // shows it — otherwise the app appears twice and the placement rule the
  // brief states for slide 4/5 is quietly broken by the last slide.
  const appAlreadyShown = ranked.some((r) => r.screen);

  return {
    ...spec,
    content: {
      style: spec.content?.style ?? 'native',
      numbering: content.numbering === 'none' ? 'none' : 'countdown',
      hook: { ...content.hook, photo: nextPhoto() },
      ranked,
      closer: appAlreadyShown
        ? { ...content.closer, photo: nextPhoto() }
        : { ...content.closer, screen: appScreen ?? undefined, photo: appScreen ? undefined : nextPhoto() },
      caption: content.caption, bio: content.bio, hashtags: content.hashtags,
    },
  };
}
