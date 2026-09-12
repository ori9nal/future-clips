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
  "caption": "the post caption: one short natural line in the same voice as the slides, with 2-3 emojis that fit the topic woven in, never a row of emojis at the end",
  "bio": "the profile bio line",
  "hashtags": ["#five", "#of", "#them", "#exactly", "#five"]
}`;

/**
 * The BEDROCK shape. The format direction in the user turn described these
 * fields and the model ignored every one of them, because the system prompt
 * said "exactly this shape" and meant it. A format that needs fields puts
 * them in the shape, not in an aside.
 */
const SHAPE_BEDROCK = `{
  "subject": "none",
  "hook":   { "headline": ["TWO OR THREE", "SHORT CAPS LINES"], "lines": [], "sub": ["one short line, e.g. zero equipment needed"],
              "pose": "what the character is doing, one clause", "muscles": "working muscles, e.g. chest and triceps", "scene": "none" },
  "ranked": [ { "name": "headline joined with a space", "headline": ["MONDAY", "PUSH DAY"], "score": "",
                "layout": "list | grid",
                "lines": ["Push Ups — 4x15-20", "Pike Push Ups — 3x10", "Diamond Push Ups — 3x max reps"],
                "levels": [ { "name": "Incline Push Ups", "reps": "3x15", "pose": "push-up with hands on a box" } ],
                "pose": "mid push-up, arms bent, chest near the floor", "muscles": "chest and triceps",
                "role": "body | app", "showsApp": false, "scene": "none" } ],
  "numbering": "none",
  "closer": { "headline": ["FOLLOW", "FOR MORE"], "lines": [], "pose": "standing, flexing both arms", "muscles": "biceps and shoulders", "cta": "the call to action" },
  "caption": "the post caption: one short natural line in the same voice as the slides, with 2-3 emojis that fit the topic woven in, never a row of emojis at the end",
  "bio": "the profile bio line",
  "hashtags": ["#five", "#of", "#them", "#exactly", "#five"]
}`;

const SHAPES = { bedrock: SHAPE_BEDROCK };

const RULES_NATIVE = `How to write it:
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
- The caption is under 20 words, first person, and carries 2-3 fitting emojis placed naturally.
- Slide count: if you are given a RANGE, choose the count the topic genuinely needs inside it -
  never pad with filler slides and never exceed it. If you are given ONE number, return exactly that.
- Exactly 5 hashtags./^How to write it:`;

const RULES_BEDROCK = `How to write it (BEDROCK format — an illustrated character teaches a programme):
- INSTRUCTIONAL, not first person. No story, no "I". The character does the work; the copy states it.
- "headline": two short CAPS lines that stack, at most 14 characters each: ["MONDAY","PUSH DAY"],
  ["CHEST","PROGRESSION"], ["HIT EVERY","MUSCLE"]. The second line is the punch. A hook may have three.
- "lines" on a "list" slide are the actual work, one exercise per line, EXACTLY like
  "Push Ups — 4x15-20" or "Superman Hold — 3x20 sec". Three to five lines. No sentences.
- "layout": "grid" on at most two slides — a progression of ONE movement through four "levels"
  from easiest to hardest, each {"name","reps","pose"}; a grid slide has empty "lines".
- "pose" is physical and specific: "mid push-up, arms bent, chest near the floor", "hanging from a bar
  at the top of a pull-up", "bottom of a squat, arms out front". "muscles" names what that works.
- Exactly one ranked entry has "role": "app" and "showsApp": true at the position you are told; its
  "pose" is "standing, holding a phone up and looking at it" and its lines are two short statements.
- The set is ONE programme: a weekly split, a muscle progression, a plan. Every slide is a day or a
  movement. hook + ranked + closer must total the slide count, so ranked has (count - 2) entries.
- "name" is the headline joined with a space. "score" is "". No emoji on the slides themselves.
- The caption is under 20 words and carries 2-3 fitting emojis placed naturally - the caption is the
  one place emoji belong in this format.
- Slide count: if you are given a RANGE, choose the count the programme genuinely needs inside it -
  never pad and never exceed it. If you are given ONE number, return exactly that.
- Exactly 5 hashtags.`;

const systemFor = (styleId) => `You write carousel copy for a paid creator campaign.

Return ONE JSON object in exactly this shape, no prose and no code fence:

${SHAPES[styleId] ?? SHAPE}

${styleId === 'bedrock' ? RULES_BEDROCK : RULES_NATIVE}`;

/** Kept for callers that import it; the real prompt is built per style. */
const SYSTEM = systemFor('native');

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
  // The gym feed is a different animal from the trading feed: it IS one
  // person — one lifter, one gym, one session — shot as anatomy close-ups, and
  // every item carries a rating out of ten. Measured off reference sets 08 and
  // 13: "Top 5 PEAK exercises for BICEPS", "7 muscles I regret skipping".
  'feed:fitness': [
    'This is the TikTok gym slideshow format. One lifter, one gym, one session. The frames are',
    'ANATOMY close-ups of that lifter — a bicep mid-curl, a back at the cable station, quads at the',
    'bottom of a squat, a shoulder at the top of a raise — shot on a phone in the gym mirror or by a',
    'training partner. Never a face straight to camera; a mirror selfie with the phone in front of the',
    'face is the only full-body frame allowed. NEVER: a bedroom, a kitchen, a café, a street, a sad',
    'mood, a stock pose, a thumbs up.',
    'Every ranked item is a specific EXERCISE or a specific MUSCLE, named plainly ("Incline dumbbell',
    'curl", "Rear delts"), with "score" as a rating out of ten like "8/10", and one or two lines of',
    'blunt lifter-to-lifter verdict — why it is rated that, what it does, what it does not. Not a',
    'brand voice. Lowercase "lol" energy is fine; exclamation marks are not.',
    'The HOOK is a count plus a promise: "Top 5 PEAK exercises for BICEPS", "7 muscles I regret',
    'skipping", "4 things that actually moved my lifts". Two short lines.',
    'The "subject" field IS used: one lifter, described once — age, build, hair, skin tone, facial',
    'hair. NO clothing: he is photographed across many different days and wears something different',
    'in every frame. Just the person.',
  ].join(' '),
  native: 'Scenes are real gym or lifestyle moments a phone would catch. Vary the place and framing every slide.',
  // The @bedrock.form format: an illustrated character teaches a programme.
  // No photography, no person, no story — a headline, a figure doing the
  // movement, and the sets x reps. Extra fields ride along on each item.
  bedrock: [
    'This is the BEDROCK format: an illustrated cel-shaded character on a cream page teaches a',
    'programme. There is NO photograph and NO real person, so "scene" and "subject" are unused —',
    'write "none". Instead every slide carries these EXTRA fields:',
    '"headline": two very short lines in CAPS that stack, e.g. ["MONDAY","PUSH DAY"], ["CHEST","PROGRESSION"],',
    '["HIT EVERY","MUSCLE"] — at most 14 characters per line, the second line is the punch.',
    '"pose": what the character is physically doing in one clause, e.g. "mid push-up, arms bent, chest',
    'near the floor" or "hanging from a pull-up bar at the top of a pull-up" or "standing, arms crossed".',
    '"muscles": the working muscles as a short list, e.g. "chest and triceps", "lats and biceps".',
    '"layout": "list" for a headline + character + bullet list, or "grid" for a 2x2 progression of four',
    'levels of one movement (use "grid" for at most two slides).',
    'For "list" slides, "lines" are the actual work, one exercise per line in this exact form:',
    '"Push Ups — 4x15-20", "Pull Ups — 4x max reps", "Superman Hold — 3x20 sec". Three to five lines.',
    'For "grid" slides, "levels" is an array of four {"name","reps","pose"} from easiest to hardest, e.g.',
    '{"name":"Incline Push Ups","reps":"3x15","pose":"push-up with hands on a box"}, and "lines" is empty.',
    'The hook has "headline" (two lines, e.g. ["THE 7-DAY","CALISTHENICS"] then a third short line is',
    'allowed), "sub" one short line like "zero equipment needed", "pose" and "muscles" as well.',
    'The closer has "headline" ["FOLLOW","FOR MORE"] or similar, "pose" (a flex) and the CTA.',
    '"name" on each item is the headline joined with a space. Ratings/"score" are unused; write "".',
    'The whole set is ONE programme or ONE lesson: a weekly split, a muscle progression, a plan.',
    'Bold, instructional, no first-person story. No emoji.',
  ].join(' '),
};

const GYM_NICHE = /gym|fitness|calisthenic|physique|supplement|nutrition|health|muscle/i;

/** Any emoji (pictographs, symbols, flags, keycaps); the caption must carry some. */
export const EMOJI_RX = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/**
 * Normalise the slide ask. A number means exactly that many; {min,max} is a
 * range the model picks inside. Either way it is intersected with what the
 * brief allows, so a 5-10 ask on a brief that caps at 8 becomes 5-8.
 */
export function slideRange(spec, slides) {
  const Q = spec.requirements ?? {};
  let min = typeof slides === 'number' ? slides : Number(slides?.min ?? 5);
  let max = typeof slides === 'number' ? slides : Number(slides?.max ?? min);
  if (Q.min_slides) min = Math.max(min, Q.min_slides);
  if (Q.max_slides) max = Math.min(max, Q.max_slides);
  if (min > max) max = min;
  return { min, max, exact: min === max };
}

/**
 * The copy request for one attempt - pure, so the same text goes to the
 * realtime API and into a Message Batch. `feedback` is the previous
 * attempt's failures, verbatim.
 */
export function buildCopyRequest({ spec, instruction, slides, styleId: wanted, feedback = '' }) {
  const range = slideRange(spec, slides);
  const constraints = constraintsFor(spec, range.max);
  // The style the CALLER is rendering, not the one the campaign file happens
  // to default to. Every gym feed round wrote its copy under the "native"
  // direction because the APEX file says native and make-set said feed.
  const styleId = wanted ?? spec.content?.style ?? 'native';
  const sceneDirection = (styleId === 'feed' && GYM_NICHE.test(spec.niche ?? '') && SCENE_DIRECTION['feed:fitness'])
    || SCENE_DIRECTION[styleId] || SCENE_DIRECTION.native;
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
    range.exact
      ? `- The set is EXACTLY ${range.min} slides (hook + ranked + closer).`
      : `- The set is between ${range.min} and ${range.max} slides (hook + ranked + closer). Pick the count the topic needs.`,
    '- The caption contains 2-3 emojis that fit the topic.',
  ].filter(Boolean).join('\n');
  const count = range.exact ? String(range.min) : `${range.min} to ${range.max} (choose)`;
  return {
    styleId, range,
    system: systemFor(styleId),
    user: `${brief}\n\nWhat the clipper asked for: ${instruction}\nSlide count: ${count}\n${feedback}`,
    maxTokens: 8000,
  };
}

/**
 * Judge one attempt's JSON: mechanical repairs first, then the brief's
 * rules, then the ask's own rules (count in range, emoji in the caption).
 * Pure: returns the repaired content and a verdict, spends nothing.
 */
export function judgeCopy({ spec, data, range }) {
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
    if (n === 0) { data.hook.lines = (data.hook.lines ?? []).map((l) => expandIn(l, spec)); data.hook.sub = (data.hook.sub ?? []).map((l) => expandIn(l, spec)); }
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
  // The ask's slide count is a hard rule, not advice: the model returned 8
  // for slides=7 twice in the bedrock rounds and it was only ever logged.
  const n = slides.length;
  if (range && (n < range.min || n > range.max)) {
    verdict.failures.push(range.exact
      ? `${n} slides returned; the ask is exactly ${range.min} (hook + ${range.min - 2} ranked + closer)`
      : `${n} slides returned; the ask is between ${range.min} and ${range.max}`);
  }
  if (!EMOJI_RX.test(String(data.caption ?? ''))) {
    verdict.failures.push('the caption has no emoji; it must carry 2-3 that fit the topic');
  }
  verdict.pass = verdict.failures.length === 0;
  return { data, verdict, slides: repaired.slides, count: n };
}

/** Failures handed back verbatim - a general "try again" repeats the violation. */
export const feedbackFor = (verdict) =>
  `\nYour previous attempt was REJECTED for these reasons. Fix every one:\n` + verdict.failures.map((f) => `- ${f}`).join('\n');

/**
 * Realtime copy: the compliance loop against the Messages API.
 * `slides` is a number or {min,max}. Returns the passing content, or the
 * last attempt with `failed: true`.
 */
export async function generateContent({ root, spec, instruction, slideCount, slides, attempts = 3, model = 'claude-opus-5', styleId: wanted }) {
  let feedback = '';
  let last = null;
  let spent = 0;
  const ask = slides ?? slideCount ?? 8;

  for (let i = 0; i < attempts; i++) {
    const req = buildCopyRequest({ spec, instruction, slides: ask, styleId: wanted, feedback });
    const { data, usd } = await completeJson({
      root, model, label: `generate:${spec.id}${i ? `:retry${i}` : ''}`, maxTokens: req.maxTokens,
      system: req.system, user: req.user,
    });
    spent += usd;
    const judged = judgeCopy({ spec, data, range: req.range });
    last = judged;
    if (judged.verdict.pass) return { content: judged.data, verdict: judged.verdict, usd: spent, attempts: i + 1, count: judged.count };
    feedback = feedbackFor(judged.verdict);
  }

  return { content: last.data, verdict: last.verdict, usd: spent, attempts, failed: true, count: last.count };
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

  // "No.5 — Barbell curl" as a heading with numbering "none" is the model
  // numbering by hand. Strip the prefix and let the renderer number, so the
  // style is consistent and there is never a "5. No.5 —" double.
  // When the model numbers by hand, its numbers WIN. Round six of the gym
  // gauntlet had myths 5, 4, 3, 2, an unnumbered "what I actually take", then
  // myth 1 — a mechanical 6→1 countdown over that produced "6. … myth 5".
  // So a hand rank is lifted off the name or the score and rendered as-is,
  // and an item the model left unnumbered stays unnumbered.
  const NUM = /^\s*(no\.?|#|number)?\s*(\d+)\s*[—–:.\-]\s*/i;
  const SCORE_RANK = /^\s*#?(\d+)\s*[·•\-–—:|]\s*(?=\S)/;
  const SCORE_ONLY = /^\s*(myth|reason|thing|tip|rule|mistake|lesson|step|no\.?|#|number|rank)?\s*(\d+)\s*$/i;
  let handNumbered = false;
  const ranked = (content.ranked ?? []).map((r, i, all) => {
    const showsApp = !!r.showsApp;
    const rank = all.length - i;
    let hand;
    let m;
    if ((m = NUM.exec(r.name ?? ''))) { hand = +m[2]; r = { ...r, name: String(r.name).replace(NUM, '') }; }
    if ((m = SCORE_RANK.exec(r.score ?? ''))) { hand = hand ?? +m[1]; r = { ...r, score: String(r.score).replace(SCORE_RANK, '') }; }
    else if ((m = SCORE_ONLY.exec(r.score ?? ''))) { hand = hand ?? +m[2]; r = { ...r, score: undefined }; }
    if (hand != null) handNumbered = true;
    // The trading feed shows an app as an icon on a pill over a lifestyle
    // frame — that is the reference format (sets 01, 04, 14). A screenshot is
    // the gym-feed convention. So feed + icon → icon slide; otherwise screen.
    const useIcon = showsApp && styleId === 'feed' && appIcon;
    return {
      // format-specific fields (bedrock: headline, pose, muscles, layout, levels) ride along
      ...r,
      name: r.name, score: cleanScore(r.score, rank), lines: r.lines ?? [],
      rank: hand, role: r.role, showsApp,
      icon: useIcon ? appIcon : undefined,
      screen: showsApp && !useIcon && appScreen ? appScreen : undefined,
      photo: showsApp && !useIcon && appScreen ? undefined : photoAt(i + 1),
    };
  });

  // Only fall back to putting the app on the closer when no slide already
  // shows it — otherwise the app appears twice and the placement rule the
  // brief states for slide 4/5 is quietly broken by the last slide.
  const appAlreadyShown = ranked.some((r) => r.screen || r.icon);

  // The reference countdown pays off ON the last slide: "1. Snake curls
  // 1000/10" is set 08's closer. The model writes it the same way — "1 —
  // Weighted chin-up" as the closer's first line — so when the closer is the
  // number one, say so structurally: the closer takes rank 1 and the ranked
  // items above it count down from n+1, never reaching 1 themselves.
  const ONE = /^\s*(#|no\.?|number)?\s*(1|one)\s*[—–:.\-]\s*/i;
  const closer = { ...content.closer, lines: [...((content.closer?.headline?.length ? content.closer.headline : content.closer?.lines) ?? [])] };
  let closerRank = 0;
  if (closer.lines[0] && ONE.test(closer.lines[0])) {
    closer.lines[0] = closer.lines[0].replace(ONE, '');
    closerRank = 1;
    handNumbered = true;
  }

  return {
    ...spec,
    content: {
      style: spec.content?.style ?? 'native',
      numbering: content.numbering === 'none' && !handNumbered ? 'none' : 'countdown',
      hook: { ...content.hook, lines: content.hook?.headline?.length ? content.hook.headline : content.hook?.lines, photo: hookPhoto },
      ranked,
      closerRank,
      closer: appAlreadyShown
        ? { ...closer, photo: closerPhoto }
        : { ...closer, screen: appScreen ?? undefined, photo: appScreen ? undefined : closerPhoto },
      caption: content.caption, bio: content.bio, hashtags: content.hashtags,
    },
  };
}
