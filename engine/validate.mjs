// Campaign rules as an executable validator. These are product requirements,
// so a violation is a hard reject, not a warning printed at the end.
//
// Rules come from the CAMPAIGN, not from a constant: a partner agency declares
// its own handle, slide bounds, banned claims and canvas when it is onboarded,
// and this runs them. The built-in brand is only the fallback for the legacy
// path. Anything hardcoded here would be a rule we silently apply to a client
// who never agreed to it — the wordmark requirement was exactly that, and the
// top-performing reference format carries no wordmark at all.
import { BANNED, CTA_VERBS } from './copy.mjs';
import { BRAND } from './palette.mjs';

const norm = (s) => String(s ?? '').toLowerCase();

/** Every text field of a slide, flattened. */
function textOf(slide) {
  return ['eyebrow', 'headline', 'kicker', 'claim', 'body', 'stat', 'cta']
    .map((k) => slide[k]).filter(Boolean).join(' \n ');
}

const DEFAULT_RULES = {
  min_slides: 6,
  max_slides: 10,
  canvas: '1080x1440',
  banned_claims: BANNED,
  banned_phrases: [],
  cta_required_on_last: true,
  wordmark_slides: [0, -1],
  require_handle_every_slide: true,
};

export function validateCarousel(carousel) {
  const errors = [];
  const { slides, canvas, furnitureByRole } = carousel;
  const brand = carousel.brand ?? BRAND;
  const rules = { ...DEFAULT_RULES, ...(carousel.rules || {}) };
  // A campaign that declares its own rules opts out of the legacy wordmark
  // requirement unless it asks for one explicitly.
  if (carousel.rules && carousel.rules.wordmark_slides === undefined) rules.wordmark_slides = [];

  if (slides.length < rules.min_slides || slides.length > rules.max_slides) {
    errors.push({ rule: 'slide-count', detail: `${slides.length} slides (must be ${rules.min_slides}-${rules.max_slides})` });
  }

  // `canvas` may be one size or a list. A campaign that ships both 4:5 and 4:3
  // template families needs to declare both; a single string would silently
  // fail every carousel from the other family.
  const allowed = (Array.isArray(rules.canvas) ? rules.canvas : [rules.canvas]).map(String);
  if (!allowed.some((a) => { const [w, h] = a.split('x').map(Number); return canvas.w === w && canvas.h === h; })) {
    errors.push({ rule: 'canvas', detail: `${canvas.w}x${canvas.h} (must be one of ${allowed.join(', ')})` });
  }

  const all = norm(slides.map(textOf).join(' '));
  for (const b of [...(rules.banned_claims || []), ...(rules.banned_phrases || [])]) {
    const re = new RegExp(`\\b${String(b).replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(all)) errors.push({ rule: 'banned-claim', detail: `"${b}" appears in the copy` });
  }

  // the campaign's handle, on every slide, as RENDERED furniture — not merely
  // as an intention recorded in the content object
  if (rules.require_handle_every_slide) {
    const handle = rules.required_mention ?? brand.handle;
    slides.forEach((s, i) => {
      const items = furnitureByRole[s.role] || [];
      if (!items.some((f) => f.type === 'handle')) {
        errors.push({ rule: 'handle-missing', detail: `slide ${i + 1} (${s.role}) has no ${handle}` });
      }
    });
  }

  for (const idx of rules.wordmark_slides || []) {
    const at = idx < 0 ? slides.length + idx : idx;
    const s = slides[at];
    if (!s) continue;
    const items = furnitureByRole[s.role] || [];
    const hasMark = items.some((f) => f.type === 'wordmark')
      || norm(textOf(s)).includes(norm(brand.wordmark));
    if (!hasMark) errors.push({ rule: 'wordmark-missing', detail: `slide ${at + 1} carries no ${brand.wordmark} wordmark` });
  }

  if (rules.cta_required_on_last) {
    const last = slides[slides.length - 1];
    const lastText = norm(textOf(last));
    if (!CTA_VERBS.some((v) => new RegExp(`\\b${v}\\b`).test(lastText))) {
      errors.push({ rule: 'cta-missing', detail: `final slide has no CTA verb (${CTA_VERBS.join('/')})` });
    }
  }

  if (!carousel.accentKey) errors.push({ rule: 'accent', detail: 'no accent selected' });

  return { ok: errors.length === 0, errors };
}
