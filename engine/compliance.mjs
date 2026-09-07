// Campaign compliance.
//
// A brief has two kinds of rule and they are not equally important. Taste rules
// ("emotional angle performs best") are advice. Compliance rules are the ones
// where breaking them means the post is rejected outright and the clipper is
// not paid — TradeLens rejects a post that says "TradeLens" without "App"
// after it, no matter how good the set is.
//
// So those are checked in code, before render, and a failure is an error rather
// than a warning. Reviewers do not edit a non-compliant set, they bin it.
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const RX = (s) => new RegExp(esc(s), 'gi');

/**
 * The bare product name where it is NOT followed by its completing word.
 *
 * One definition, used by both the checker and the repairer — two copies of
 * this regex is two chances to disagree about what counts as a violation.
 */
export function bareNameRx(rules) {
  if (!rules?.required_phrase || !rules?.never_bare) return null;
  const tail = rules.required_phrase.slice(rules.never_bare.length).trim();
  if (!tail) return null;
  return { rx: new RegExp(`${esc(rules.never_bare)}(?!\\s*${esc(tail)})`, 'gi'), tail };
}

/**
 * Where the app has to appear, given how many slides the set has.
 *
 * The brief states this as a table keyed on slide count, so it is stored that
 * way rather than flattened to one number — the rule genuinely differs between
 * a 4-slide and an 8-slide set.
 */
function requiredAppSlides(placement, slideCount) {
  if (!Array.isArray(placement)) return null;
  for (const row of placement) {
    const [lo, hi] = row.when_slides;
    if (slideCount >= lo && slideCount <= (hi ?? lo)) return row.on_slides;
  }
  return null;
}

/**
 * Check a set's copy against the campaign's hard rules.
 *
 * @param {object} spec   the campaign
 * @param {object} copy   {slides: [{index, role, text, showsApp}], caption, bio}
 * @returns {{pass:boolean, failures:string[], warnings:string[]}}
 */
export function check(spec, copy) {
  const failures = [], warnings = [];
  const R = spec.rules ?? {}, Q = spec.requirements ?? {};
  const slides = copy.slides ?? [];
  const allText = [...slides.map((s) => s.text ?? ''), copy.caption ?? '', copy.bio ?? ''].join('\n');

  /* slide count */
  if (Q.min_slides && slides.length < Q.min_slides) failures.push(`${slides.length} slides, brief requires at least ${Q.min_slides}`);
  if (Q.max_slides && slides.length > Q.max_slides) failures.push(`${slides.length} slides, brief allows at most ${Q.max_slides}`);

  /* the naming rule — the one that gets posts binned */
  if (R.required_phrase) {
    const hits = (allText.match(RX(R.required_phrase)) ?? []).length;
    if (!hits) failures.push(`required phrase "${R.required_phrase}" appears nowhere in the copy`);
    // Every slide that names the product must name it in full
    const bareDef = bareNameRx(R);
    if (bareDef) {
      const { rx: bare, tail } = bareDef;
      const found = [];
      slides.forEach((s) => { if (bare.test(s.text ?? '')) found.push(`slide ${s.index}`); bare.lastIndex = 0; });
      if (bare.test(copy.caption ?? '')) found.push('caption');
      bare.lastIndex = 0;
      if (copy.bio != null && bare.test(copy.bio)) found.push('bio');
      if (found.length) failures.push(`"${R.never_bare}" written without "${tail}" in ${found.join(', ')} — the brief forbids the bare name`);
    }
    if (copy.bio != null && !RX(R.required_phrase).test(copy.bio)) {
      failures.push(`bio must contain "${R.required_phrase}"`);
    }
  }

  /* the app has to be shown, and in the right place */
  if (Q.must_show_app) {
    const shown = slides.filter((s) => s.showsApp).map((s) => s.index);
    if (!shown.length) failures.push('brief requires the app to be featured; no slide is marked as showing it');
    const want = requiredAppSlides(Q.app_placement, slides.length);
    if (want && shown.length && !shown.some((i) => want.includes(i))) {
      failures.push(`at ${slides.length} slides the app must appear on slide ${want.join(' or ')}; it appears on ${shown.join(', ')}`);
    }
  }

  /* banned claims */
  for (const claim of R.banned_claims ?? []) {
    if (RX(claim).test(allText)) failures.push(`banned claim present: "${claim}"`);
  }
  for (const topic of R.banned_topics ?? []) {
    if (RX(topic).test(allText)) warnings.push(`copy mentions a banned topic: "${topic}"`);
  }

  /* structure */
  if (Q.first_slide_must_be_hook && slides[0] && slides[0].role && slides[0].role !== 'hook') {
    failures.push(`slide 1 is "${slides[0].role}", the brief requires it to be the hook`);
  }

  /* taste rules, reported but not blocking */
  if (R.no_exclamation && /!/.test(allText)) warnings.push('exclamation marks present; the brief asks for none');
  const hook = slides[0]?.text ?? '';
  const words = hook.trim().split(/\s+/).filter(Boolean).length;
  if (words > 12) warnings.push(`hook is ${words} words — short hooks read at thumbnail size`);

  return { pass: failures.length === 0, failures, warnings };
}

/**
 * Repair the violations that are mechanical rather than creative.
 *
 * "The bio must contain the product name" is not a judgement call — it is a
 * string that is present or absent. Sending that back to the model costs a
 * whole generation and often fails again on the same field, which is exactly
 * what happened: three attempts, ten cents, same missing bio.
 *
 * Only rules with one correct answer are repaired here. A banned claim is NOT
 * repaired, because removing it changes what the copy says and that is the
 * writer's job.
 */
export function repair(spec, copy) {
  const R = spec.rules ?? {};
  const fixed = { ...copy, slides: copy.slides.map((s) => ({ ...s })) };
  const notes = [];
  if (!R.required_phrase) return { copy: fixed, notes };

  const phrase = R.required_phrase;

  // the bare name expanded wherever it appears without its completing word
  const bareDef = bareNameRx(R);
  if (bareDef) {
    const expand = (t) => (t == null ? t : String(t).replace(bareDef.rx, phrase));
    fixed.slides.forEach((s) => {
      const before = s.text;
      s.text = expand(s.text);
      if (s.text !== before) notes.push(`expanded bare name on slide ${s.index}`);
    });
    for (const k of ['caption', 'bio']) {
      const before = fixed[k];
      fixed[k] = expand(fixed[k]);
      if (fixed[k] !== before) notes.push(`expanded bare name in ${k}`);
    }
  }

  // a bio that never names the product gets it appended rather than regenerated
  if (fixed.bio != null && !RX(phrase).test(fixed.bio)) {
    const sep = /[|·—-]\s*$/.test(fixed.bio.trim()) ? ' ' : ' | ';
    fixed.bio = `${fixed.bio.trim()}${sep}${phrase}`;
    notes.push('appended the required phrase to the bio');
  }

  return { copy: fixed, notes };
}

/** What the generator must satisfy, rendered as instructions for the model. */
export function constraintsFor(spec, slideCount) {
  const R = spec.rules ?? {}, Q = spec.requirements ?? {};
  const lines = [];
  if (R.required_phrase) {
    lines.push(`The product is called "${R.required_phrase}". Write it in full every single time.`);
    if (R.never_bare) lines.push(`NEVER write "${R.never_bare}" on its own — it is always "${R.required_phrase}".`);
  }
  if (Q.must_show_app) {
    const want = requiredAppSlides(Q.app_placement, slideCount);
    lines.push(want
      ? `Exactly one slide must show the app itself, and at ${slideCount} slides it must be slide ${want.join(' or ')}. Mark it with "showsApp": true.`
      : 'At least one slide must show the app itself. Mark it with "showsApp": true.');
  }
  if (Q.min_slides || Q.max_slides) lines.push(`The set is ${slideCount} slides (brief allows ${Q.min_slides}-${Q.max_slides}).`);
  if (Q.first_slide_must_be_hook) lines.push('Slide 1 is the hook and nothing else.');
  if ((R.banned_claims ?? []).length) lines.push(`Never write any of these, in any form: ${R.banned_claims.join('; ')}.`);
  if (R.tone) lines.push(`Tone: ${R.tone}`);
  return lines;
}

export { requiredAppSlides };
