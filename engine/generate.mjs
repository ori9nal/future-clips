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
  "hook":   { "lines": ["2-3 short lines, hand-broken"], "sub": [], "scene": "shot type then one clause: mirror | pov | crop | friend | object | outdoors — e.g. \"mirror, locker room, phone at chest\"" },
  "ranked": [ { "name": "slide heading", "score": "an x/10 rating ONLY when the ask rates or ranks things (\"8/10\", \"-2/10\", \"1000/10\"); otherwise \"\". Never a tag line", "lines": ["1-4 short lines"],
                "role": "body | app | proof", "showsApp": false, "scene": "shot type then one clause" } ],
  "numbering": "countdown | up | none",
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
- SPECIFIC means a number a real post would have: "3 x 10", "4x60 seconds planks", "8-10 reps",
  "32.5kg", "6am", "twice a week", "$25-$50", "1% risk per trade", "2-4 pairs", "40 min". At least half
  of the ranked items carry one. A noun without a number ("progressive overload", "consistency") is
  what a brand writes.
- "score" is an x/10 rating when the ask rates or ranks things, otherwise "". No real post puts a tag
  line ("news first", "the gamechanger") under a heading; say it in "lines" or not at all.
- The voice is a person typing on their phone: sentence case, a lowercase "i" is fine, "lol", "fr",
  "lowkey", ".." and "..." as trailing punctuation, ONE word in CAPS for emphasis ("ACTUALLY", "ONLY",
  "PEAK", "FAVVV"). No em dashes (use a comma or ".."), no semicolons, no hashtags on slides, at most
  one emoji on a slide and most slides none.
- NEVER these words, they are not in any real post: elevate, unlock, level up, transform, empower,
  seamless, effortless, supercharge, next level, unleash, harness, dominate, crush it, the secret to,
  here's the thing, let's dive, "it's not about X, it's about Y", game-changing, revolutionary,
  "trust me", "you got this", "pro tip:" more than once.
- The "ranked" array is the middle of the set. hook + ranked + closer must total the slide count
  you are given, so ranked has (count - 2) entries.
- Exactly one ranked entry has "role": "app" and "showsApp": true, at the position you are told.
  Its copy describes what the app actually did, concretely — and it is the SHORTEST entry in the
  set, at most two short lines, because that slide is a screenshot and the copy sits over it.
- Never invent a feature the campaign description does not mention.
- The CTA is a fragment, not a sentence: at most six words, no trailing full stop.
- The hook's lines plus its sub must total under 12 words. It is read at thumbnail size.
- "numbering": "up" for a numbered list that counts 1 → N (tips, rules, muscles, months, days:
  9 of the 12 numbered reference sets count up). "countdown" ONLY when the items carry x/10 scores
  or the ask is a ranking that pays off at #1. "none" for a story told in order. Never count a set
  of habits, lessons or rules backwards — no real post does.
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
    'This is the TikTok slideshow format for trading. The imagery is one person\'s LIFE seen on their',
    'phone — their car, their desk, a pool, a plane tray — and the person is never a face: from behind,',
    'hooded, a hand on a wheel, feet up. Real posts to match, copied exactly:',
    'hooks — "4 trading apps I\'ll never uninstall" · "Traders don\'t sleep on this:" · "How I became a',
    'profitable trader" · „Bro I don\'t know how to start trading..." 🗣️ · "How I would structure the first',
    'year in trading, starting as a complete beginner..." · "TJR will not make you profitable.." · "Top 3',
    'trading apps I wish I had earlier..".',
    'items — "4. Forex Factory / Every red folder news event, before it moves the market" · "3. Meta',
    'Trader 5 / Where the orders actually get placed, no fluff" · "1. TradingView / the only chart app',
    'i\'ll ever trust. smooth, customizable, just elite." · "Best pairs to trade on forex: / XAUUSD /',
    'USDCAD / EURUSD / GBPUSD / GBPJPY" · "Month 3: / Backtest a full year of data on 2-4 pairs, then',
    'choose the pair that delivers the strongest results." · "Month 7-9: / Open a small funded account',
    '($5k-$10k), costing roughly $25-$50 to purchase." · "I stopped chasing my losses. / When I lost a',
    'trade, I stopped for the entire day and learned from it".',
    'app lines — "saved me so much time on charting, the gamechanger fr 💯" · "this app is the secret',
    'sauce fr" · "I check it before every session for the market read, then log my trades after. Keeps',
    'me consistent".',
    'closers — "Your own rules: / 1. Keep your journey private, don\'t tell a soul. / 2. Stay',
    'disciplined and stick to your strategy." · "the only one who can make you profitable is you.".',
    'No x/10 ratings in this format: "score" is always "" (sets 01, 02, 14 never rate).',
    'When the ask is about apps or tools, NAME real ones — TradingView, MetaTrader 5, Forex Factory,',
    'Webull, Stocktwits — alongside the campaign product. The hook is a count plus a promise or a quoted',
    'DM, two short lines, never a confession. Numbers on at least half the items: pairs, months, $,',
    '%, a time of day. The "subject" field is unused for this format; write "none".',
    '"scene" is a hint only: one of car | interior | desk | feetup | pool | penthouse | plane | boat |',
    'street | garage | watch | rooftop | behind, then a clause.',
  ].join(' '),
  // The gym feed IS one person across many days, shot on a phone: mirror
  // selfies, close crops with the head out of frame, looking down at his own
  // arm, a friend shooting from across the gym. Measured off sets 05, 08, 09,
  // 10, 13, 15 and the GYM-niche examples.
  'feed:fitness': [
    'This is the TikTok gym slideshow format: one lifter\'s camera roll over many days. Real posts to',
    'match, copied exactly:',
    'hooks — "Top 5 PEAK exercises for BICEPS" · "7 muscles I regret skipping when I started lifting..."',
    '· "6 things I wish I new before I started lifting" · "If i could ONLY pick 4 exercises for glute',
    'growth.." · "5 tips on how to ACTUALLY get v shape body" · "hot girls don\'t gate keep / ab guide➡"',
    '· "I want to go to gym 4x a week" (a quoted DM) · "Maturing is realising...".',
    'rated items — "5. Dumbbell curls / -8/10 / Only good for beginners, but it will make your bicep',
    'grow slower long term" · "4. Preacher curls / 3/10 / Pretty dangerous exercise, not really worth',
    'the risk lol" · "2. Spider curls / 8/10 / Good tension, ROM, and form is lowkey hard to mess up" ·',
    '"1. Snake curls / 1000/10 / No explanation needed..." · "1. Kitty curls / 10/10 / Popularized by',
    'Sam Sulek. / It speaks for itself.".',
    'programme items — "RDLS / my FAVVV exercise for glute growth / - 1 warmup set / - 3 working sets /',
    '- 8 reps" · "Hipthrusts / pause at the top. if you\'re not squeezing, it\'s useless" · "Day 1: Back',
    'Workout / - Lat Pulldown 3 x 10 / - Rear Delt Fly 3 x 10 / - Face Pull 3x 12" · "1. Shoulders /',
    '-lateral raises to failure / -heavy on shoulder press / - control the weight and form" · "2.',
    'abs/chest / -Only two exercises / - russian twist to failure / -4x60 seconds planks / -never take',
    'chest to failure, the fatigue will haunt you".',
    'lesson items — "6. Forearms / Well developed forearms just make you look jacked regardless of what',
    'you wear. A few hard sets at the end of your bicep workouts is all you need" · "3. Control Your Ab',
    'Work: / Focus on slow, weighted core exercises instead of spamming high-rep crunches that widen',
    'your waist.".',
    'app slide — "PRO TIP / Track your lifts and meals in HealthMeter for MAXIMUM BICEP GROWTH / stop',
    'guessing and start tracking" · "QUICK TIP / You don\'t know what you lifted last week ? you\'re',
    'basically guessing your progression 💀 / I use the app : Liftly / It keeps my exercises, weights,',
    'reps & PRs saved." · "bonus tip: / remember to track your lifts and also your meals, it\'s a MUST',
    'for progressive overload / (I use HealthMeter)".',
    'Every ranked item is a specific EXERCISE or MUSCLE named plainly, or when the ask is mistakes,',
    'habits, lessons or myths, that mistake or lesson named plainly. "score" is "x/10" (negative and',
    'over-ten allowed, "-1/10", "1000/10") ONLY when the ask asks for ratings or a ranking of',
    'exercises; otherwise "". Lines are a dash list ("- 3 working sets", "- 8-10 reps") or one or two',
    'blunt lifter-to-lifter sentences. Numbers on at least half the items: sets x reps, seconds, kg, a',
    'day of the week, "twice a week". Lowercase "lol" energy is fine; exclamation marks are not.',
    'The "subject" field IS used: one lifter, described once — age, build, hair, skin tone, facial hair.',
    'NO clothing: he wears something different in every frame. Just the person.',
    '"scene" per slide: one of mirror | pov | crop | friend | object | outdoors, then a clause.',
  ].join(' '),
  native: [
    'This is a phone-photo slideshow: 9:16 frames off someone\'s camera roll with a small caption on',
    'each. Scenes are real moments a phone would catch — a mirror, looking down at your own hands, a',
    'friend shooting from across the room, an object on a counter. Vary the shot every slide.',
    'Numbers on at least half the items. "scene": one of mirror | pov | crop | friend | object |',
    'outdoors, then a clause.',
  ].join(' '),
  // Food and meal prep: mostly objects (containers, the pan, the plate) and
  // two frames with the cook in them from behind. Measured off set-15 (the
  // supplement row, the cucumber hot dog) and set-07 (the Notes food guide).
  'native:food': [
    'This is a phone-photo slideshow about food someone actually cooks: 9:16 frames off their camera',
    'roll — the containers on the table, the pan on the hob, a plate on a cluttered counter with the',
    'flash on, the fridge shelf, a kitchen scale — and at most two frames with the cook in them from',
    'behind. Real lines to match: "3. Eat healthy" over a plate · "2. Take supplements" over a row of',
    'tubs · "Pro tip: / Nourishing protein + fibre meals keeps me full & supports my recovery" · a Notes',
    'list "protein / • chicken breast, red meat, salmon / • Greek yogurt, cottage cheese" · "→ Ex: $1,200',
    'iPhone upgrade? Match it with $1,200 into your brokerage account.".',
    'Every ranked item is a specific meal or step with its numbers: minutes, grams, how many containers,',
    'what it costs, which day. "Chicken thighs and potatoes / 30 min / One tray, one oven / I salt them',
    'the night before". Blunt, first person, a lowercase "i" is fine. No recipe-blog voice, no "delicious",',
    'no "nourish", no "fuel your day".',
    'The "subject" is one person described once — age, build, hair, skin tone. No clothing.',
    '"scene": one of plate | containers | pan | fridge | board | scale | cook | hands | car | oven | bag,',
    'then a clause.',
  ].join(' '),
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

const GYM_NICHE = /gym|fitness|calisthenic|physique|supplement|creatine|muscle|lifting/i;
const FOOD_NICHE = /food|meal|nutrition|kitchen|cook|recipe|diet/i;

/**
 * Phrases no real post in the corpus uses and the model reaches for. A slide
 * carrying one is rejected and the set regenerated with the failure named —
 * the copy is the cheapest line, and "elevate your training" on slide 3 is
 * the whole set read as an ad.
 */
export const BRAND_SPEAK = /\b(elevate|unlock(?:ing|ed)?|level up|transform(?:ative|ed|ing)?|empower(?:ing|ed)?|seamless(?:ly)?|effortless(?:ly)?|supercharge|next level|unleash|harness|dominate|crush it|the secret to|here's the thing|let's dive|game-changing|revolutionary|trust me|you got this|fuel your|nourish(?:ing)?)\b|it's not (?:about|just) [^.]{1,40}, it's (?:about )?/i;


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
  const niche = spec.niche ?? '';
  const sceneDirection = (styleId === 'feed' && GYM_NICHE.test(niche) && SCENE_DIRECTION['feed:fitness'])
    || (styleId === 'native' && GYM_NICHE.test(niche) && SCENE_DIRECTION['feed:fitness'])
    || (styleId === 'native' && FOOD_NICHE.test(niche) && SCENE_DIRECTION['native:food'])
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
export function judgeCopy({ spec, data, range, styleId }) {
  // The phone formats never carry an em dash on a slide (none in 237
  // reference slides); the model writes one on most. Repair, don't reject.
  const phone = styleId ? /^(feed|native)$/.test(styleId) : !/^bedrock$/.test(spec.content?.style ?? '');
  if (phone) {
    const fix = (t) => (t == null ? t : String(t).replace(/\s*[—–]\s*/g, ', ').replace(/;\s*/g, ', '));
    if (data.hook) { data.hook.lines = (data.hook.lines ?? []).map(fix); data.hook.sub = (data.hook.sub ?? []).map(fix); }
    for (const r of data.ranked ?? []) { r.name = fix(r.name); r.lines = (r.lines ?? []).map(fix); }
    if (data.closer) { data.closer.lines = (data.closer.lines ?? []).map(fix); data.closer.cta = fix(data.closer.cta); }
  }
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
  // a "score" that is not a rating is a tag line the reference never carries
  // (round 2, 2026-09-18: "news first" under "4. Forex Factory"); blanked, not rejected
  if (phone) for (const r of data.ranked ?? []) {
    if (r.score && !/-?\d+\s*\/\s*\d+/.test(String(r.score))) { notes.push(`score "${r.score}" on "${r.name}" is not a rating; removed`); r.score = ''; }
    // x/10 is a gym-family device (sets 08, 15 rate exercises); the trading
    // and wealth references never rate an app or a habit (sets 01, 02, 11, 14)
    if (r.score && !GYM_NICHE.test(spec.niche ?? '')) { notes.push(`rating "${r.score}" on "${r.name}" dropped: the ${spec.niche ?? 'trading'} family never rates`); r.score = ''; }
  }
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
  if (phone) {
    // brand-speak on any slide
    for (const sl of slides) {
      const m = BRAND_SPEAK.exec(sl.text ?? '');
      if (m) verdict.failures.push(`slide ${sl.index} says "${m[0]}" — a brand word no real post uses; rewrite it plainly`);
    }
    // numbering direction (docs/QUALITY.md §4, DECISIONS D-103): of the 12
    // numbered reference sets, 9 count up and the 3 countdowns are rated
    // rankings. A countdown with nothing rated and no ranking in the hook is
    // the model numbering a list of habits backwards.
    const hookText = [...(data.hook?.lines ?? []), ...(data.hook?.sub ?? [])].join(' ');
    const scored = (data.ranked ?? []).some((r) => /-?\d+\s*\/\s*10/.test(String(r.score ?? '')));
    const ranking = /\b(top|rank|ranked|ranking|best|worst|peak|tier|tiers)\b/i.test(hookText);
    const nums = (data.ranked ?? []).filter((r) => !r.showsApp).map((r) => { const m = /^\s*(?:no\.?|#)?\s*(\d+)\s*[.:\-\u2013\u2014]/i.exec(String(r.name ?? '')); return m ? +m[1] : null; });
    const handDown = nums.length >= 2 && nums.every((n) => n != null) && nums.every((n, i) => i === 0 || n < nums[i - 1]);
    if ((data.numbering === 'countdown' || handDown) && !scored && !ranking) {
      verdict.failures.push('the list counts down but nothing is rated or ranked; number it 1 \u2192 N ("numbering": "up") or leave it unnumbered');
    }
    // specificity: at least half of the body items carry a number
    const body = (data.ranked ?? []).filter((r) => !r.showsApp);
    const withNum = body.filter((r) => /\d/.test([r.score, ...(r.lines ?? [])].filter(Boolean).join(' ')));
    if (body.length >= 2 && withNum.length * 2 < body.length) {
      verdict.failures.push(`only ${withNum.length} of ${body.length} items carry a number (sets x reps, kg, minutes, $, %, a time); at least half must`);
    }
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
    const judged = judgeCopy({ spec, data, range: req.range, styleId: req.styleId });
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
      // the app slide keeps its frame too: for the phone formats that frame
      // is the app photographed on a phone, and the renderer prefers it
      photo: photoAt(i + 1),
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
      // "up" and "none" pass through; a hand-numbered set renders its own numbers (feed, native)
      numbering: handNumbered ? 'countdown' : (content.numbering === 'none' || content.numbering === 'up') ? content.numbering : 'countdown',
      hook: { ...content.hook, lines: content.hook?.headline?.length ? content.hook.headline : content.hook?.lines, photo: hookPhoto },
      ranked,
      closerRank,
      // the closer keeps its frame either way: when it carries the screen the
      // renderer prefers a generated phone-on-a-bench frame over the UI mock
      closer: appAlreadyShown
        ? { ...closer, photo: closerPhoto }
        : { ...closer, screen: appScreen ?? undefined, photo: closerPhoto },
      caption: content.caption, bio: content.bio, hashtags: content.hashtags,
    },
  };
}
