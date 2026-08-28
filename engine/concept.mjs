// Turn an idea-engine CONCEPT into slide content.
//
// The corrected brief makes the idea the product: Phase 2 emits
//   { angle, hook, structure_type, slides:[{text,imageIntent}], cta }
// and this is the seam between that and the renderer. Keeping it a pure
// transform means the idea engine can be swapped from hand-authored JSON to an
// LLM without the renderer noticing, and means a concept can be rendered,
// inspected and rejected before any model is wired in.
//
// The output shape matches engine/copy.mjs exactly, so templates address the
// same content slots whichever source produced them.

const wc = (s) => (s ? String(s).trim().split(/\s+/).filter(Boolean).length : 0);

/** First sentence, or the whole line if it is one sentence. */
function leadClause(text) {
  const m = String(text).match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : String(text)).trim();
}

/** Everything after the lead clause — the elaboration, if there is one. */
function restClause(text) {
  const lead = leadClause(text);
  const rest = String(text).slice(lead.length).trim();
  return rest || null;
}

/**
 * @param {{hook, slides:Array<{text,imageIntent?}>, cta, structure_type?, angle?}} concept
 * @returns {{slides:Array, hookType:string, closerVerb:string}}
 */
export function conceptToSlides(concept) {
  if (!concept?.hook) throw new Error('concept needs a hook');
  if (!Array.isArray(concept.slides) || !concept.slides.length) throw new Error('concept needs slides');
  if (!concept.cta) throw new Error('concept needs a cta');

  const slides = [];
  slides.push({
    role: 'cover',
    headline: concept.hook,
    kicker: concept.kicker || null,
    accentWord: concept.accentWord || null,
    eyebrow: null,
    imageIntent: concept.coverImageIntent || concept.slides[0]?.imageIntent || null,
  });

  concept.slides.forEach((s, i) => {
    const text = typeof s === 'string' ? s : s.text;
    const title = leadClause(text);
    const body = restClause(text);
    slides.push({
      role: 'body',
      index: String(i + 1).padStart(2, '0'),
      indexPlain: String(i + 1),
      title,
      headline: title,
      claim: title,
      body,
      stat: s.stat || null,
      accentWord: null,
      eyebrow: null,
      imageIntent: s.imageIntent || null,
    });
  });

  slides.push({
    role: 'closer',
    headline: concept.cta,
    kicker: concept.closerKicker || null,
    accentWord: null,
    cta: String(concept.cta).trim().split(/\s+/)[0],
    eyebrow: null,
    imageIntent: concept.closerImageIntent || null,
  });

  for (const s of slides) {
    s.wordCount = wc(s.headline) + wc(s.kicker) + wc(s.claim === s.headline ? '' : s.claim) + wc(s.body);
    s.headlineCaps = String(s.headline).toUpperCase();
    s.kickerCaps = String(s.kicker || '').toUpperCase();
    s.stack2 = s.headline;
    s.stack3 = s.headline;
    s.stackCaps2 = s.headlineCaps;
    s.stackCaps3 = s.headlineCaps;
    if (s.role === 'body') s.indexDot = `${Number(s.indexPlain).toString().padStart(2, '0')}`;
  }

  return {
    slides,
    hookType: concept.structure_type || 'prescription',
    closerVerb: slides[slides.length - 1].cta,
  };
}
