// MASCOT — brand grounds and a supplied character asset.
//
// One asset reused on every frame, so the character-consistency problem that
// breaks generated people does not arise. Registered from the existing
// renderer for the same reason as native.
import { mascotSlides } from '../render-native.mjs';

export default {
  id: 'mascot',
  label: 'Mascot',
  canvas: { w: 1080, h: 1920 },
  niches: ['fitness', 'supplements', 'gaming', 'creator', 'food'],
  blurb: 'Brand-colour grounds with a supplied mascot and speech bubbles. Needs one mascot asset; reuses it across every slide.',
  requires: ['assets.mascot'],
  async slides(spec, ctx) { return mascotSlides(spec, ctx.root); },
};
