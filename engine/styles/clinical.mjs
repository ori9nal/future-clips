import path from 'node:path';
// CLINICAL — the whitepaper look (library folder 11).
//
// White ground, a reading serif headline, body copy set small and tight, a row
// of labelled diagrams, and a named attribution with a citation footer. The
// whole point is that it does not look like marketing: it borrows the visual
// grammar of a paper so the claim reads as evidence rather than a pitch.
//
// Which is exactly why the citation line is not decorative. A style that looks
// like a paper and cites nothing is worse than one that never pretended.
import { rect, line, text, stack, paragraph, list, plate, image, grain } from './kit.mjs';

import { handle as creatorHandle } from '../creator.mjs';
/** A campaign photo id under ctx.photoDir, or a generated frame's absolute path. */
const src = (ctx, id) => (path.isAbsolute(String(id)) ? String(id) : src(ctx, id));

export default {
  id: 'clinical',
  /** this style prints the creator's handle in its own footer, so the sign-off is the avatar alone */
  printsHandle: true,
  /** the mark sits in the empty band above the call-to-action bar, clear of the footer handle */
  markAt(w, h) { const size = Math.round(w * 0.072); return { x: w - Math.round(w * 0.05) - size, y: Math.round(h * 0.70), size }; },
  label: 'Clinical',
  canvas: { w: 1080, h: 1350 },
  niches: ['health', 'longevity', 'fitness', 'supplements', 'medical'],
  blurb: 'Whitepaper grammar — serif headline, small body, labelled diagrams, a named source. Reads as evidence, not a pitch.',

  async slides(spec, ctx) {
    const { sharp, outDir } = ctx;
    const C = spec.content;
    const ink = '#14171A', muted = '#6B7280', rule = '#D8DCE0';
    const accent = spec.assets.palette?.[1] ?? '#B03A2E';
    const W = 1080, H = 1350;
    const M = 84;                                     // generous margin: air is the signal here
    const out = [];
    const source = spec.content.source ?? `${spec.brand} Research`;

    const chrome = (n, total) => rect(0, 0, W, H, { fill: '#FFFFFF' })
      + grain(W, H, { op: 0.035 })
      + text('mono', M, 74, (spec.assets.photos?.credit ? spec.brand.toLowerCase() : spec.brand.toLowerCase()) + '.research', { size: 20, fill: muted, ls: 1.5 })
      + text('mono', W - M, 74, `${n} / ${total}`, { size: 20, fill: muted, anchor: 'end' })
      + line(M, 96, W - M, 96, { stroke: rule, sw: 1.5 })
      + line(M, H - 118, W - M, H - 118, { stroke: rule, sw: 1.5 })
      + text('serifSemi', M, H - 76, source, { size: 24, fill: ink })
      + text('mono', W - M, H - 76, creatorHandle(spec) ?? '', { size: 20, fill: muted, anchor: 'end' });

    const total = C.ranked.length + 2;

    /* cover — the question, asked plainly */
    {
      const s = [chrome(1, total)];
      const h = stack('serif', C.hook.lines, { x: M, y: 210, w: W - M * 2, h: 420 },
        { max: 108, min: 52, lineHeight: 1.1, fill: ink });
      s.push(h.svg);
      if (C.hook.sub?.length) {
        const p = paragraph('sans', C.hook.sub.join(' '), M, h.bottom + 44, W - M * 2 - 120, { size: 30, fill: muted, lineHeight: 1.5 });
        s.push(p.svg);
      }
      if (C.hook.photo) {
        const p = await plate(sharp, src(ctx, C.hook.photo), W - M * 2, 420, outDir);
        s.push(image(p, M, H - 118 - 460, W - M * 2, 420, { round: 4 }));
      }
      out.push(s.join(''));
    }

    /* findings — numbered, each with a diagram cell */
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const s = [chrome(i + 2, total)];
      s.push(text('mono', M, 190, `${String(i + 1).padStart(2, '0')}`, { size: 26, fill: accent, ls: 2 }));
      const h = stack('serifSemi', [item.name], { x: M, y: 214, w: W - M * 2, h: 190 },
        { max: 74, min: 38, lineHeight: 1.08, fill: ink });
      s.push(h.svg);
      s.push(line(M, h.bottom + 30, M + 96, h.bottom + 30, { stroke: accent, sw: 4 }));

      const p = paragraph('sans', item.lines.join(' '), M, h.bottom + 62, W - M * 2 - 60, { size: 29, fill: '#2B3138', lineHeight: 1.55 });
      s.push(p.svg);

      if (item.photo) {
        const iw = W - M * 2, ih = 470;
        const pl = await plate(sharp, src(ctx, item.photo), iw, ih, outDir);
        s.push(image(pl, M, H - 118 - ih - 46, iw, ih, { round: 4 }));
        if (item.score) {
          // the verdict, set as a measurement rather than a rating chip
          s.push(rect(M, H - 118 - ih - 46, 150, 62, { fill: '#FFFFFF' }));
          s.push(text('monoBold', M + 20, H - 118 - ih - 46 + 42, item.score, { size: 30, fill: accent }));
        }
      }
      out.push(s.join(''));
    }

    /* close — the practical takeaway */
    {
      const s = [chrome(total, total)];
      const h = stack('serif', C.closer.lines, { x: M, y: 230, w: W - M * 2, h: 400 },
        { max: 92, min: 46, lineHeight: 1.12, fill: ink });
      s.push(h.svg);
      s.push(line(M, h.bottom + 40, W - M, h.bottom + 40, { stroke: rule, sw: 1.5 }));
      if (C.closer.points?.length) {
        const l = list('sans', C.closer.points, M, h.bottom + 74, W - M * 2, {
          size: 28, marker: 'number', markerFace: 'monoBold', markerFill: accent, fill: '#2B3138', gap: 22, indent: 54,
        });
        s.push(l.svg);
      }
      s.push(rect(M, H - 250, W - M * 2, 82, { r: 4, fill: ink }));
      s.push(text('sansBold', W / 2, H - 197, C.closer.cta, { size: 30, fill: '#FFFFFF', anchor: 'middle' }));
      out.push(s.join(''));
    }

    return out;
  },
};
