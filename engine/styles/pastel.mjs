import path from 'node:path';
// PASTEL — the friendly explainer (library folder 6).
//
// Warm cream ground, a serif question as the headline with an italic clause,
// body copy inside a soft tinted panel, numbered takeaways, and a dashed
// "save this" box at the end. The reference runs finance content for an
// audience that has been talked down to by finance content, and the softness
// is doing real work: it signals that the explanation will not assume you
// already know.
import { rect, text, stack, paragraph, aside, grain, plate, image, FACES } from './kit.mjs';
import { loadFace } from '../fonts.mjs';
import { layoutWidth } from '../fit-text.mjs';

import { handle as creatorHandle } from '../creator.mjs';
/** A dashed panel — the reference's "save this slide" device. */
const dashed = (x, y, w, h, { stroke, r = 10 }) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" ` +
  `stroke="${stroke}" stroke-width="3" stroke-dasharray="14 10"/>`;

/** A campaign photo id under ctx.photoDir, or a generated frame's absolute path. */
const src = (ctx, id) => (path.isAbsolute(String(id)) ? String(id) : src(ctx, id));

export default {
  id: 'pastel',
  label: 'Pastel',
  canvas: { w: 1080, h: 1350 },
  niches: ['finance', 'beauty', 'skincare', 'lifestyle', 'wellness', 'personal finance'],
  blurb: 'Warm cream ground, serif question headline, tinted body panels, numbered takeaways and a dashed save-this box.',

  async slides(spec, ctx) {
    const { sharp, outDir } = ctx;
    const C = spec.content;
    const paper = '#FBF3EE', ink = '#241C1E', muted = '#8A7A76';
    const acc = /^#[0-9a-f]{6}$/i.test(spec.assets.palette?.[1] ?? '') ? spec.assets.palette[1] : '#D2436A';
    const panel = '#FBE2E9';                       // tinted content block
    const W = 1080, H = 1350, M = 78;
    const out = [];
    const total = C.ranked.length + 2;
    const chipFace = loadFace(FACES.sansBold.file);

    /** A pill sized to its own label. A fixed width clipped "the usual cause". */
    const pill = (x, y, label, { size = 29, fill = acc, ink = '#FFFFFF' } = {}) => {
      const w = Math.ceil(layoutWidth(chipFace, label, size)) + 56;
      const h = size + 33;
      return { svg: rect(x, y, w, h, { r: h / 2, fill }) +
        text('sansBold', x + w / 2, y + h / 2 + size * 0.35, label, { size, fill: ink, anchor: 'middle' }),
        width: w, height: h };
    };

    const chrome = () => rect(0, 0, W, H, { fill: paper })
      + grain(W, H, { op: 0.04 })
      + text('sansItalic', M, 82, spec.content.kicker ?? spec.brand.toLowerCase(), { size: 24, fill: muted })
      + text('mono', W - M, 82, creatorHandle(spec) ?? '', { size: 22, fill: muted, anchor: 'end' });

    /* cover — a question, because the style is answering one */
    {
      const s = [chrome()];
      const h = stack('playfair', C.hook.lines, { x: M, y: 200, w: W - M * 2, h: 400 },
        { max: 94, min: 44, lineHeight: 1.14, fill: ink });
      s.push(h.svg);
      let sy = h.bottom + 40;
      if (C.hook.sub?.length) {
        // fitted rather than fixed — a long subline was running off the frame
        const sub = aside('playfairItalic', C.hook.sub[0], M, sy, W - M * 2, { big: 42, mid: 32, fill: acc });
        s.push(sub.svg);
        sy = sub.bottom;
      }
      // the panel only earns its space when there is body copy to put in it
      if (C.hook.body) {
        const py = Math.max(sy + 60, 700);
        s.push(rect(M, py, W - M * 2, H - py - 150, { r: 16, fill: panel }));
        s.push(paragraph('sans', C.hook.body, M + 46, py + 46, W - M * 2 - 92,
          { size: 28, fill: '#3E3033', lineHeight: 1.62 }).svg);
      }
      out.push(s.join(''));
    }

    /* body — panel of prose, then the point */
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const s = [chrome()];
      s.push(text('monoBold', M, 168, String(i + 1).padStart(2, '0'), { size: 30, fill: acc, ls: 2 }));
      const h = stack('playfair', [item.name], { x: M, y: 196, w: W - M * 2, h: 230 },
        { max: 76, min: 36, lineHeight: 1.12, fill: ink });
      s.push(h.svg);

      let y = h.bottom + 54;
      const panelH = 40 + item.lines.length * 92;
      s.push(rect(M, y, W - M * 2, panelH, { r: 16, fill: panel }));
      let py = y + 34;
      for (const para of item.lines) {
        const p = paragraph('sans', para, M + 44, py, W - M * 2 - 88, { size: 27, fill: '#3E3033', lineHeight: 1.58 });
        s.push(p.svg);
        py = p.bottom + 16;
      }
      y += panelH + 46;

      if (item.score) {
        const p = pill(M, y, item.score);
        s.push(p.svg);
        y += p.height + 26;
      }
      if (item.note) {
        const n = paragraph('sansItalic', item.note, M, y, W - M * 2 - 60, { size: 26, fill: muted, lineHeight: 1.5 });
        s.push(n.svg);
        y = n.bottom;
      }
      // the spec carries a photo per item; using it fills the lower third that
      // the panel layout leaves empty, and skincare content wants a face
      if (item.photo && (ctx.photoDir || path.isAbsolute(String(item.photo)))) {
        const ph = Math.max(180, H - 96 - (y + 34));
        if (ph >= 220) {
          const pl = await plate(sharp, src(ctx, item.photo), W - M * 2, ph, outDir);
          s.push(image(pl, M, H - 96 - ph, W - M * 2, ph, { round: 18 }));
        }
      }
      out.push(s.join(''));
    }

    /* close — the save-this checklist */
    {
      const s = [chrome()];
      const h = stack('playfair', C.closer.lines, { x: M, y: 190, w: W - M * 2, h: 300 },
        { max: 82, min: 40, lineHeight: 1.14, fill: ink });
      s.push(h.svg);
      let y = h.bottom + 56;
      if (C.closer.points?.length) {
        C.closer.points.forEach((pt, i) => {
          s.push(text('monoBold', M + 4, y + 30, `${i + 1}.`, { size: 26, fill: acc }));
          const p = paragraph('sans', pt, M + 56, y, W - M * 2 - 56, { size: 27, fill: '#3E3033', lineHeight: 1.5 });
          s.push(p.svg);
          y = p.bottom + 18;
        });
      }
      const by = Math.max(y + 40, H - 230);
      s.push(dashed(M, by, W - M * 2, 96, { stroke: acc }));
      s.push(text('sansBold', W / 2, by + 60, C.closer.cta, { size: 30, fill: acc, anchor: 'middle' }));
      out.push(s.join(''));
    }

    return out;
  },
};
