// Campaign rules as an executable validator. These are product requirements,
// so a violation is a hard reject, not a warning printed at the end.
import { BANNED, CTA_VERBS } from './copy.mjs';
import { BRAND } from './palette.mjs';

const norm = (s) => String(s ?? '').toLowerCase();

/** Every text field of a slide, flattened. */
function textOf(slide) {
  return ['eyebrow', 'headline', 'kicker', 'claim', 'body', 'stat', 'cta']
    .map((k) => slide[k]).filter(Boolean).join(' \n ');
}

export function validateCarousel(carousel) {
  const errors = [];
  const { slides, tpl, canvas, furnitureByRole } = carousel;

  // 6-10 slides
  if (slides.length < 6 || slides.length > 10) {
    errors.push({ rule: 'slide-count', detail: `${slides.length} slides (must be 6-10)` });
  }

  // 1080 x 1440
  if (canvas.w !== 1080 || canvas.h !== 1440) {
    errors.push({ rule: 'canvas', detail: `${canvas.w}x${canvas.h} (must be 1080x1440)` });
  }

  // banned claims, anywhere
  const all = norm(slides.map(textOf).join(' '));
  for (const b of BANNED) {
    const re = new RegExp(`\\b${b.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(all)) errors.push({ rule: 'banned-claim', detail: `"${b}" appears in the copy` });
  }

  // @drift.sleep on every slide (rendered furniture, not just intent)
  slides.forEach((s, i) => {
    const items = furnitureByRole[s.role] || [];
    if (!items.some((f) => f.type === 'handle')) {
      errors.push({ rule: 'handle-missing', detail: `slide ${i + 1} (${s.role}) has no ${BRAND.handle}` });
    }
  });

  // wordmark on slide 1 and the final slide
  for (const [idx, label] of [[0, 'first'], [slides.length - 1, 'final']]) {
    const s = slides[idx];
    const items = furnitureByRole[s.role] || [];
    const hasMark = items.some((f) => f.type === 'wordmark')
      || norm(textOf(s)).includes(norm(BRAND.wordmark));
    if (!hasMark) errors.push({ rule: 'wordmark-missing', detail: `${label} slide carries no ${BRAND.wordmark} wordmark` });
  }

  // final slide must contain a CTA verb
  const last = slides[slides.length - 1];
  const lastText = norm(textOf(last));
  if (!CTA_VERBS.some((v) => new RegExp(`\\b${v}\\b`).test(lastText))) {
    errors.push({ rule: 'cta-missing', detail: `final slide has no CTA verb (${CTA_VERBS.join('/')})` });
  }

  // exactly one accent declared
  if (!carousel.accentKey) errors.push({ rule: 'accent', detail: 'no accent selected' });

  return { ok: errors.length === 0, errors };
}
