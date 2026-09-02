// POSTER — the loud one (library folder 5).
//
// Black ground, condensed display type stacked to fill the frame, one word
// carrying the accent, a script aside, and a numbered chip in the corner. This
// is the style for content ABOUT content — hooks, marketing, design education —
// where the slide has to demonstrate the thing it is claiming.
//
// The type fills the width by construction: each line is set at the size that
// makes it span the measure, so the block reads as a poster rather than as
// centred text with air on both sides.
import { rect, text, stack, paragraph, aside, list, grain, FACES } from './kit.mjs';
import { loadFace } from '../fonts.mjs';
import { layoutWidth } from '../fit-text.mjs';

/**
 * Set each line at its own size so every line spans the full measure.
 * A single fitted size leaves short lines floating; per-line sizing is what
 * makes a stack read as a poster.
 */
function justified(faceKey, lines, x, y, w, o = {}) {
  const face = loadFace(FACES[faceKey].file);
  const cap = face.capHeight / face.upm;
  let svg = '', cy = y, rows = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    const unit = layoutWidth(face, t, 100);
    let size = Math.min(o.max ?? 190, (w / unit) * 100);
    if (o.min && size < o.min) size = o.min;
    const fill = typeof o.fill === 'function' ? o.fill(t, i) : (o.fill ?? '#FFFFFF');
    cy += size * cap;
    svg += text(faceKey, x, Math.round(cy), t, { size, fill });
    rows.push({ text: t, size, y: cy });
    cy += size * (o.lineHeight ?? 0.16);
  }
  return { svg, bottom: cy, rows };
}

export default {
  id: 'poster',
  label: 'Poster',
  canvas: { w: 1080, h: 1350 },
  niches: ['marketing', 'design', 'creator', 'social media', 'agency'],
  blurb: 'Black ground, condensed display type set to span the measure, one accent word, a script aside and a numbered chip.',

  async slides(spec, ctx) {
    const C = spec.content;
    const bg = '#0A0A0B', paper = '#FFFFFF', muted = '#8B9099';
    // the campaign's accent, but only if it is a real hex — a poster with a
    // missing accent colour is unreadable, so fall back rather than render blank
    const acc = /^#[0-9a-f]{6}$/i.test(spec.assets.palette?.[1] ?? '') ? spec.assets.palette[1] : '#FFD426';
    const W = 1080, H = 1350, M = 72;
    const out = [];
    const total = C.ranked.length + 2;

    const chip = (n) => rect(W - M - 96, 66, 96, 52, { r: 4, fill: acc })
      + text('monoBold', W - M - 48, 103, String(n).padStart(2, '0'), { size: 28, fill: bg, anchor: 'middle' });

    const chrome = (n) => rect(0, 0, W, H, { fill: bg })
      + grain(W, H, { op: 0.06 })
      + text('monoBold', M, 103, spec.brand.toUpperCase(), { size: 26, fill: paper, ls: 3 })
      + chip(n)
      + text('mono', M, H - 60, spec.requirements.required_mention, { size: 21, fill: muted });

    /* cover — the loudest slide, accent on the last line */
    {
      const s = [chrome(1)];
      const j = justified('displayCond', C.hook.lines, M, 250, W - M * 2, {
        max: 230, lineHeight: 0.14,
        fill: (_, i) => (i === C.hook.lines.length - 1 ? acc : paper),
      });
      s.push(j.svg);
      if (C.hook.sub?.length) {
        // fitted, not set at a fixed size — a longer subline ran straight off
        // the frame, which is the exact failure the fitter exists to prevent
        const sub = aside('playfairItalic', C.hook.sub[0], M, j.bottom + 62, W - M * 2, { fill: paper });
        s.push(sub.svg);
        // the arrow the reference uses to push the swipe
        const ay = Math.round(sub.bottom + 52);
        s.push(`<path d="M ${M} ${ay} L ${M + 210} ${ay} M ${M + 178} ${ay - 18} L ${M + 212} ${ay} L ${M + 178} ${ay + 18}" stroke="${acc}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
      out.push(s.join(''));
    }

    /* body — a claim, then the proof as a list */
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const s = [chrome(i + 2)];
      const words = item.name.toUpperCase().split(' ');
      // break into 2-3 lines so the display type has something to span
      const lines = words.length > 3
        ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
        : words.length > 1 ? [words[0], words.slice(1).join(' ')] : words;
      const j = justified('displayCond', lines, M, 210, W - M * 2, {
        max: 190, lineHeight: 0.14, fill: (_, k) => (k === lines.length - 1 ? acc : paper),
      });
      s.push(j.svg);
      const l = list('sansMed', item.lines, M, j.bottom + 92, W - M * 2, {
        size: 31, fill: '#E4E6EA', marker: '—', markerFace: 'monoBold', markerFill: acc, gap: 26, indent: 52,
      });
      s.push(l.svg);
      if (item.score) {
        s.push(rect(M, H - 190, 190, 66, { r: 4, fill: paper }));
        s.push(text('monoBold', M + 95, H - 145, item.score, { size: 32, fill: bg, anchor: 'middle' }));
      }
      out.push(s.join(''));
    }

    /* close */
    {
      const s = [chrome(total)];
      const j = justified('displayCond', C.closer.lines, M, 300, W - M * 2, {
        max: 220, lineHeight: 0.14, fill: (_, i) => (i % 2 ? acc : paper),
      });
      s.push(j.svg);
      s.push(rect(M, H - 260, W - M * 2, 104, { r: 6, fill: acc }));
      s.push(text('displayCondXB', W / 2, H - 188, C.closer.cta.toUpperCase(), { size: 46, fill: bg, anchor: 'middle' }));
      out.push(s.join(''));
    }

    return out;
  },
};
