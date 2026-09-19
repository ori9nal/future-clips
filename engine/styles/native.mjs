// NATIVE — the phone-photo caption look (library folders 15, GYM niche).
//
// The renderer already lives in engine/render-native.mjs, which predates the
// style registry. This adapter registers it rather than reimplementing it —
// two copies of a format is how they drift apart.
import { nativeSlides } from '../render-native.mjs';

export default {
  id: 'native',
  /** this style prints the creator's handle in its own footer, so the sign-off is the avatar alone */
  printsHandle: true,
  label: 'Native',
  canvas: { w: 1080, h: 1920 },
  niches: ['fitness', 'gym', 'lifestyle', 'nutrition', 'supplements', 'creator'],
  blurb: 'Full-bleed phone photography with a heavy stroked caption. Looks like a post, not an ad — the format the gym niche actually runs.',
  async slides(spec, ctx) { return nativeSlides(spec, ctx.root, ctx.outDir); },
};
