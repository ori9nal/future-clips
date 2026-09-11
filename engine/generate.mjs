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
import { check, constraintsFor, repair, bareNameRx } from './compliance.mjs';

/** Expand a bare product name inside one string, mirroring repair(). */
function expandIn(text, spec) {
  const def = bareNameRx(spec.rules ?? {});
  if (text == null || !def) return text;
  return String(text).replace(def.rx, spec.rules.required_phrase);
}

const SHAPE = `{
  "subject": "one locked sentence describing the person in the set: age, hair, facial hair, one plain outfit. No names, no brands.",
  "hook":   { "lines": ["2-4 short lines, hand-broken"], "sub": ["one supporting line"], "scene": "what the photo shows" },
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
- Write like a person who actually uses this, first person, specific. Not like a brand. That does NOT
  mean a struggle story — "the four apps I open every morning" is first person too. Match the clipper's
  ask; do not turn a list into a confession.
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
- "subject" is written ONCE and describes the only person in the set. Every slide is the same
  person, so it must be plain and specific enough to recognise: no accessories that come and go.
- Every slide has a "scene": where the person is, what they are doing, how they are framed. One
  sentence. Describe a real moment a phone camera would catch, not a stock-photo pose — no
  thumbs up, no arms crossed smiling at the lens, no laptop-and-coffee cliché.
- Scenes must differ from each other in place, time of day and framing. A set where every frame
  is the same room reads as one photo repeated.
- The app slide's scene is ignored (it renders the app screenshot), so keep it short.
- Exactly 5 hashtags.`;

/**
 * @param {object} o
 * @param {string} o.root
 * @param {object} o.spec        the campaign
 * @param {string} o.instruction  the clipper's few words
 * @param {number} o.slideCount
 * @param {number} [o.attempts]
 */
/**
 * Scene direction per format. The reference feed sets are built on aspirational
 * places and objects, not on a person emoting — the generator has to be told
 * that or it writes a sad-man-in-a-room story every time.
 */
const SCENE_DIRECTION = {
  feed: [
    'This is the TikTok slideshow format. Its whole appeal is ASPIRATION: the imagery is the life the',
    'viewer wants, not the viewer\'s current mood. Every scene must be one of these kinds of shot, and no',
    'two scenes the same kind: a dark supercar on a wet street at night; a hotel pool lit from below with',
    'palms; a penthouse window at golden hour over a city; a trading desk with three monitors glowing in a',
    'dim room; a yacht deck at dusk; a first-class window seat; the interior of a luxury car at night from',
    'the driver\'s seat; a rooftop at blue hour; a watch and a phone on a marble table. Warm, rich,',
    'expensive. NEVER: rain on a window, a bus, a train, a bedroom, a café, an office, anything grey or',
    'dreary, any person\'s face, anyone sitting sadly. The set should make someone want the life.',
    'When the ask is about apps or tools, NAME real, well-known ones — TradingView, MetaTrader 5, Forex',
    'Factory, Webull — alongside the campaign product. Vague headings like "the charting one" are a failure.',
    'The HOOK for this format is a count plus a promise, never a confession: "4 trading apps I will never',
    'uninstall", "Top 3 apps I wish I had earlier", "The only 4 I still open". Two short lines. Do not',
    'open with "I blew my account" — that is a story hook, and this is a list post.',
    'The "subject" field is unused for this format; write "none".',
  ].join(' '),
  native: 'Scenes are real gym or lifestyle moments a phone would catch. Vary the place and framing every slide.',
};

export async function generateContent({ root, spec, instruction, slideCount, attempts = 3, model = 'claude-opus-5' }) {
  const constraints = constraintsFor(spec, slideCount);
  const styleId = spec.content?.style ?? 'native';
  const sceneDirection = SCENE_DIRECTION[styleId] ?? SCENE_DIRECTION.native;
  const brief = [
    `Product: ${spec.brand} — ${spec.product}`,
    spec.niche ? `Niche: ${spec.niche}` : null,
    spec.guidance?.hook_style ? `Hook style: ${spec.guidance.hook_style}` : null,
    spec.guidance?.angles?.length ? `Angles that work: ${spec.guidance.angles.join('; ')}` : null,
    '',
    `FORMAT: ${styleId}. ${sceneDirection}`,
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
    // repair the mechanical violations first, then judge what is left — a
    // whole regeneration is too expensive to spend on a missing string
    const { copy: repaired, notes } = repair(spec, { slides, caption: data.caption, bio: data.bio });
    data.caption = repaired.caption;
    data.bio = repaired.bio;
    repaired.slides.forEach((s, n) => {
      if (n === 0) { data.hook.lines = data.hook.lines.map((l) => expandIn(l, spec)); data.hook.sub = (data.hook.sub ?? []).map((l) => expandIn(l, spec)); }
      else if (n <= (data.ranked?.length ?? 0)) {
        const r = data.ranked[n - 1];
        r.name = expandIn(r.name, spec);
        r.lines = (r.lines ?? []).map((l) => expandIn(l, spec));
      } else {
        data.closer.lines = (data.closer.lines ?? []).map((l) => expandIn(l, spec));
        data.closer.cta = expandIn(data.closer.cta, spec);
      }
    });

    const verdict = check(spec, repaired);
    verdict.repairs = notes;
    last = { data, verdict, slides: repaired.slides };

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
export function toRenderable(spec, content, { appScreen, appIcon, photos = [] } = {}) {
  const styleId = spec.content?.style ?? 'native';
  const n = (content.ranked ?? []).length;

  // Photos are dealt BY SLIDE INDEX, never by call order. The generated frames
  // arrive in scene order — hook first, then each ranked item, closer last —
  // and the first version dealt them with a sequential nextPhoto() while
  // mapping `ranked` before `hook`. So the ranked items took frames 0..n-1 and
  // the hook got frame n: the enforced hook scene (a garage supercar) rendered
  // on slide 2 and the hook wore the app slide's throwaway frame. Six gauntlet
  // rounds of "why is the hook still a bus window" came down to this.
  const photoAt = (i) => (photos.length ? photos[i % photos.length] : undefined);
  const hookPhoto = photoAt(0);
  const closerPhoto = photoAt(n + 1);

  // A rank is not a score. The model kept writing "#4" into `score` on a slide
  // already headed "4. Forex Factory", which rendered as a double number. Keep
  // a score only when it reads as a rating or a tag, never as the rank again.
  const cleanScore = (s, rank) => {
    if (s == null) return undefined;
    const t = String(s).trim();
    // "#4", "4", "4.", "No. 4", "No.4", "number 4", "rank 4" — every way the
    // model has found to restate the rank in the score field
    if (!t || /^(#|no\.?|number|rank)?\s*\d+\.?$/i.test(t) || t === String(rank)) return undefined;
    return t;
  };

  const ranked = (content.ranked ?? []).map((r, i, all) => {
    const showsApp = !!r.showsApp;
    const rank = all.length - i;
    // The trading feed shows an app as an icon on a pill over a lifestyle
    // frame — that is the reference format (sets 01, 04, 14). A screenshot is
    // the gym-feed convention. So feed + icon → icon slide; otherwise screen.
    const useIcon = showsApp && styleId === 'feed' && appIcon;
    return {
      name: r.name, score: cleanScore(r.score, rank), lines: r.lines ?? [],
      role: r.role, showsApp,
      icon: useIcon ? appIcon : undefined,
      screen: showsApp && !useIcon && appScreen ? appScreen : undefined,
      photo: showsApp && !useIcon && appScreen ? undefined : photoAt(i + 1),
    };
  });

  // Only fall back to putting the app on the closer when no slide already
  // shows it — otherwise the app appears twice and the placement rule the
  // brief states for slide 4/5 is quietly broken by the last slide.
  const appAlreadyShown = ranked.some((r) => r.screen || r.icon);

  return {
    ...spec,
    content: {
      style: spec.content?.style ?? 'native',
      numbering: content.numbering === 'none' ? 'none' : 'countdown',
      hook: { ...content.hook, photo: hookPhoto },
      ranked,
      closer: appAlreadyShown
        ? { ...content.closer, photo: closerPhoto }
        : { ...content.closer, screen: appScreen ?? undefined, photo: appScreen ? undefined : closerPhoto },
      caption: content.caption, bio: content.bio, hashtags: content.hashtags,
    },
  };
}
