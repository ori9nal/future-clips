// Copy generation for the DRIFT campaign.
//
// Deterministic assembly from authored banks, seeded by the divergence hash.
// The hook typologies are the seven measured in the corpus (ANALYSIS.md §6);
// the insight bank is written to DRIFT's positioning — it names the *why*, not
// the *what* — and is scrubbed of every banned claim by construction.
//
// Volume shape follows the corpus: cover shortest, interiors substantial and
// decaying, closer quiet. Slide 1 is always the lowest word count of the set.

export const BANNED = ['cure', 'cures', 'cured', 'treats', 'treat', 'clinically proven', 'insomnia cure', 'medically approved', 'diagnose', 'diagnosis'];

export const HOOK_TYPES = [
  'side-effect', 'lazy-effortless', 'numbered-authority',
  'contrarian-negation', 'confession-receipt', 'hypothetical', 'status-threat',
];

// --------------------------------------------------------------------- hooks
// Each returns { headline, kicker, accentWord, hookType }. Headlines are held
// to 4-8 words; kickers carry the twist tail the corpus always appends.
const HOOKS = {
  'side-effect': [
    { headline: 'side effects of six hours', kicker: 'nobody warned you about', accent: 'six' },
    { headline: 'what six hours quietly costs you', kicker: 'the part no tracker shows', accent: 'quietly' },
    { headline: 'the hidden tax of short sleep', kicker: 'you are already paying it', accent: 'hidden' },
  ],
  'lazy-effortless': [
    { headline: 'lazy habits that wreck your sleep', kicker: 'and the lazy fixes that undo them', accent: 'lazy' },
    { headline: 'four lazy nights, one broken week', kicker: 'the maths is uglier than you think', accent: 'broken' },
    { headline: 'the laziest way to sleep deeper', kicker: 'no routine, no supplements', accent: 'laziest' },
  ],
  'numbered-authority': [
    { headline: 'i tracked ninety nights', kicker: 'only four things moved the score', accent: 'ninety' },
    { headline: 'five habits that quietly cost points', kicker: 'ranked by how much they take', accent: 'five' },
    { headline: 'ninety nights, four real levers', kicker: 'everything else was noise', accent: 'four' },
  ],
  'contrarian-negation': [
    { headline: 'you are not tired', kicker: 'you are under-slept in a way you cannot feel', accent: 'not' },
    { headline: 'it is not your mattress', kicker: 'and it was never the melatonin', accent: 'never' },
    { headline: 'not a discipline problem', kicker: 'a signal problem', accent: 'signal' },
  ],
  'confession-receipt': [
    { headline: 'six things i wish i knew sooner', kicker: 'before ninety nights of data', accent: 'sooner' },
    { headline: 'my score said seventy-one', kicker: 'here is what it was actually telling me', accent: 'seventy-one' },
    { headline: 'i blamed everything except this', kicker: 'ninety nights later, it was obvious', accent: 'everything' },
  ],
  'hypothetical': [
    { headline: 'if your sleep sent you an invoice', kicker: 'here is what last week cost', accent: 'invoice' },
    { headline: 'if three a.m. could talk', kicker: 'this is what it would say', accent: 'talk' },
  ],
  'status-threat': [
    { headline: 'what your three a.m. wakeup means', kicker: 'it is rarely the thing you blame', accent: 'means' },
    { headline: 'everyone tracks sleep, nobody reads it', kicker: 'the number is not the point', accent: 'nobody' },
    { headline: 'your tracker is grading, not explaining', kicker: 'those are different jobs', accent: 'explaining' },
  ],
};

// ------------------------------------------------------------------ insights
// title (2-4 words) / claim (one line) / detail (1-2 lines) / stat.
// Behaviour and measurement only — no clinical language anywhere.
const INSIGHTS = [
  { title: 'the late coffee', claim: 'Caffeine at 3pm is still in you at 11pm.',
    detail: 'It clears slowly. You still fall asleep — you just spend the night in lighter stages.\n\nDRIFT flags it because your deep-sleep block shrinks on those nights, not because you tossed and turned.', stat: '-11 pts', tag: 'stimulant' },
  { title: 'the last hour', claim: 'The hour before bed decides more than the eight after it.',
    detail: 'A bright, loud, scrolling hour keeps your system in daytime mode.\n\nDRIFT looks at how long it took you to actually fall asleep, then points at the hour that caused it.', stat: '-9 pts', tag: 'wind-down' },
  { title: 'the weekend drift', claim: 'Two late nights reset your clock backwards.',
    detail: 'Sleeping in on Saturday feels like repayment. Your body reads it as a time-zone change.\n\nMonday is not laziness. It is jet lag you booked yourself.', stat: '-14 pts', tag: 'timing' },
  { title: 'the warm room', claim: 'Your body has to cool down to go deep.',
    detail: 'A room a couple of degrees too warm blocks the drop your system is trying to make.\n\nDRIFT sees it as a flat first cycle — the deep block that never arrives.', stat: '-8 pts', tag: 'environment' },
  { title: 'the nightcap', claim: 'A drink gets you to sleep and then takes it back.',
    detail: 'The first half of the night looks fine. The second half fragments.\n\nThat is the 3am wake-up you keep blaming on stress.', stat: '-13 pts', tag: 'stimulant' },
  { title: 'the moving alarm', claim: 'A wake time that shifts by an hour costs more than a late night.',
    detail: 'Your clock anchors to when you get up, not when you lie down.\n\nHold the alarm still for a week and watch the rest settle around it.', stat: '-10 pts', tag: 'timing' },
  { title: 'the late meal', claim: 'Digesting and going deep are competing jobs.',
    detail: 'Eat close to bed and the first cycle gets spent on the wrong task.\n\nDRIFT reads it as a delayed deep block, not as restlessness.', stat: '-7 pts', tag: 'intake' },
  { title: 'the phone in bed', claim: 'It is not the blue light. It is the arousal.',
    detail: 'Fifteen minutes of scrolling is fifteen minutes of decisions, notifications and small alarms.\n\nYour system does not power down mid-argument.', stat: '-9 pts', tag: 'wind-down' },
  { title: 'the long lie-in', claim: 'More time in bed is not more sleep.',
    detail: 'Stretch the window and the sleep inside it thins out.\n\nDRIFT tracks the ratio, so a nine-hour night that scored badly finally makes sense.', stat: '-6 pts', tag: 'timing' },
  { title: 'the dark morning', claim: 'Tonight is set by this morning.',
    detail: 'Light in the first hour after waking is the strongest signal your clock gets all day.\n\nMiss it and bedtime slides later without you choosing it.', stat: '+12 pts', tag: 'light' },
  { title: 'the 3am wakeup', claim: 'Waking at 3am is normal. Staying awake is the signal.',
    detail: 'Everyone surfaces between cycles. The question is whether you go back under in four minutes or forty.\n\nDRIFT times the gap and tells you which of yesterday made it long.', stat: 'watch this', tag: 'pattern' },
  { title: 'the hard workout', claim: 'A late session borrows from the first cycle.',
    detail: 'Training raises your core temperature for hours.\n\nSame workout at 6pm instead of 9pm, and the deep block comes back.', stat: '-5 pts', tag: 'activity' },
  { title: 'the snooze button', claim: 'Nine more minutes buys you the worst nine minutes.',
    detail: 'You restart a cycle you cannot finish, then break it again.\n\nThe grogginess is the interruption, not the shortage.', stat: '-4 pts', tag: 'pattern' },
  { title: 'the quiet room', claim: 'Steady noise beats silence.',
    detail: 'A silent room makes every small sound an event.\n\nDRIFT counts the micro-wakes you never remember and shows them next to the noise floor.', stat: '+5 pts', tag: 'environment' },
  { title: 'the sunday reset', claim: 'You cannot bank sleep in advance.',
    detail: 'An early Sunday night before a hard week does almost nothing.\n\nConsistency compounds. Deposits do not.', stat: '-3 pts', tag: 'timing' },
  { title: 'the second wind', claim: 'Push past the window and it closes.',
    detail: 'Your body opens a door around the same time every night. Miss it and you get a second wind that costs ninety minutes.\n\nDRIFT learns where your door is.', stat: '-8 pts', tag: 'wind-down' },
];

// ------------------------------------------------------------------- closers
const CLOSERS = [
  { line: 'follow for the why', sub: 'not just the number', verb: 'follow', accent: 'why' },
  { line: 'save this for tonight', sub: 'read it before you set the alarm', verb: 'save', accent: 'tonight' },
  { line: 'download DRIFT', sub: 'it scores the night, then names the habit', verb: 'download', accent: 'DRIFT' },
  { line: 'try one night', sub: 'you will know by breakfast', verb: 'try', accent: 'one' },
  { line: 'follow DRIFT', sub: 'the tracker that explains itself', verb: 'follow', accent: 'DRIFT' },
  { line: 'save it, then sleep on it', sub: 'tomorrow you will want the list', verb: 'save', accent: 'sleep' },
];

export const CTA_VERBS = ['follow', 'save', 'download', 'try', 'subscribe', 'comment'];

// --------------------------------------------------------------------- build
const wc = (s) => String(s || '').split(/\s+/).filter(Boolean).length;

/**
 * Break a headline into n lines with the accent word alone on the last one —
 * the stacked-caps poster idiom (Bedrock, Obsidian, pro.fit). Balances the
 * remaining words by character count so no line is a runt.
 */
export function stackLines(text, n, accentWord) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  n = Math.max(2, Math.min(n, words.length));

  let head = words, tail = [];
  if (accentWord) {
    const i = words.findIndex((w) => w.replace(/[^\p{L}\p{N}'-]/gu, '').toLowerCase() === String(accentWord).toLowerCase());
    if (i >= 0 && i === words.length - 1) { head = words.slice(0, -1); tail = [words[words.length - 1]]; }
  }
  const lines = [];
  const slots = n - tail.length;
  if (slots <= 0) return [...head.join(' ') ? [head.join(' ')] : [], ...tail].filter(Boolean);

  const total = head.join('').length;
  const target = total / slots;
  let cur = [], curLen = 0;
  for (const w of head) {
    cur.push(w); curLen += w.length;
    if (lines.length < slots - 1 && curLen >= target - w.length / 2) { lines.push(cur.join(' ')); cur = []; curLen = 0; }
  }
  if (cur.length) lines.push(cur.join(' '));
  while (lines.length < slots) lines.push('');
  return [...lines.filter(Boolean), ...tail];
}

/**
 * @returns {{slides: Array, hookType: string, meta: object}}
 * slides[i] = { role, ...contentFields, wordCount }
 */
export function buildCopy(rng, { slideCount, hookType, tone = 'default', shorten = 0 }) {
  const pool = HOOKS[hookType] || HOOKS['side-effect'];
  const hook = pool[rng.int(pool.length)];

  const bodyCount = slideCount - 2; // cover + closer
  const picked = rng.sample(INSIGHTS, Math.min(bodyCount, INSIGHTS.length));
  while (picked.length < bodyCount) picked.push(INSIGHTS[rng.int(INSIGHTS.length)]);

  const closer = CLOSERS[rng.int(CLOSERS.length)];

  // "shorten" is the regeneration lever: each retry trims copy one notch further.
  const trimDetail = (d, notch) => {
    if (notch <= 0) return d;
    const stanzas = d.split('\n\n');
    if (notch === 1 && stanzas.length > 1) return stanzas[0];
    const first = stanzas[0].split(/(?<=\.)\s+/);
    return first.slice(0, Math.max(1, first.length - (notch - 1))).join(' ');
  };
  const trimLine = (s, notch) => {
    if (notch < 3) return s;
    const w = s.split(/\s+/);
    return w.slice(0, Math.max(3, w.length - (notch - 2))).join(' ');
  };

  const slides = [];
  slides.push({
    role: 'cover',
    headline: hook.headline,
    kicker: trimLine(hook.kicker, shorten),
    accentWord: hook.accent,
    eyebrow: 'DRIFT · sleep, explained',
  });

  picked.forEach((ins, i) => {
    // volume decays across the interiors
    const notch = shorten + (i >= Math.ceil(bodyCount * 0.6) ? 1 : 0);
    slides.push({
      role: 'body',
      index: String(i + 1).padStart(2, '0'),
      indexPlain: String(i + 1),
      title: ins.title,
      headline: ins.title,
      claim: trimLine(ins.claim, shorten),
      body: trimDetail(ins.detail, notch),
      stat: ins.stat,
      accentWord: ins.title.split(/\s+/).slice(-1)[0],
      eyebrow: `${String(i + 1).padStart(2, '0')} · ${ins.tag}`,
    });
  });

  slides.push({
    role: 'closer',
    headline: closer.line,
    kicker: closer.sub,
    accentWord: closer.accent,
    cta: closer.verb,
    eyebrow: 'DRIFT',
  });

  for (const s of slides) {
    s.wordCount = wc(s.headline) + wc(s.kicker) + wc(s.claim) + wc(s.body) + wc(s.eyebrow) + wc(s.stat);
    // stacked-caps variants for the poster families
    s.stack2 = stackLines(s.headline, 2, s.accentWord).join('\n');
    s.stack3 = stackLines(s.headline, 3, s.accentWord).join('\n');
    s.stackCaps3 = s.stack3.toUpperCase();
    s.stackCaps2 = s.stack2.toUpperCase();
    s.headlineCaps = String(s.headline).toUpperCase();
    s.kickerCaps = String(s.kicker || '').toUpperCase();
    if (s.role === 'body') s.indexDot = `${Number(s.indexPlain)}.`;
  }
  return { slides, hookType, closerVerb: closer.verb };
}
