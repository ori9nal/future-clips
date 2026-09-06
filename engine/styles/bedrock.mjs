// BEDROCK — illustrated character over cream (the BEDROCK FORM reference).
//
// Cream ground, a badge lockup, a headline stacked black-over-accent with a
// rule under it, a cel-shaded character, and a bullet list of the actual work.
//
// This is the one style that cannot be built from stock photography: it needs a
// single character in many poses. Those come from ONE generated sheet cut into
// pieces (tools/make-character.mjs → cut-character.mjs), because a single
// generation is self-consistent by construction — separate calls per pose is
// exactly where character drift comes from.
//
// The reference also tints the worked muscle group red. That is deliberately
// not done here: an image model approximates anatomy, and a confidently wrong
// muscle highlight on a fitness brand is worse than none.
import fs from 'node:fs';
import path from 'node:path';
import { rect, line, text, stack, aside, list, image, grain, circle } from './kit.mjs';

/** Poses cut from the sheet, in filename order. */
function poses(root, spec) {
  const dir = spec.assets?.character?.dir;
  if (!dir) return [];
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter((f) => /^pose-\d+\.png$/.test(f))
    .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0])
    .map((f) => path.join(full, f));
}

/** Draw a cutout at a target height, preserving its own aspect. */
function figure(sharpMeta, file, cx, bottom, targetH) {
  const { width, height } = sharpMeta;
  const h = targetH, w = Math.round((width / height) * h);
  return image(file, Math.round(cx - w / 2), Math.round(bottom - h), w, h);
}

export default {
  id: 'bedrock',
  label: 'Bedrock',
  canvas: { w: 1080, h: 1350 },
  niches: ['fitness', 'gym', 'calisthenics', 'supplements', 'health'],
  blurb: 'Cream ground, badge lockup, black-over-accent headline and a cel-shaded character. Needs a generated character sheet.',
  requires: ['assets.character.dir'],

  async slides(spec, ctx) {
    const { sharp, root } = ctx;
    const C = spec.content;
    const paper = '#F2EADC', ink = '#151313', muted = '#6E6660';
    const acc = /^#[0-9a-f]{6}$/i.test(spec.assets.palette?.[1] ?? '') ? spec.assets.palette[1] : '#D92B1F';
    const W = 1080, H = 1350, M = 66;

    const files = poses(root, spec);
    if (!files.length) throw new Error(`bedrock needs a character: no poses under ${spec.assets?.character?.dir}`);
    const metas = await Promise.all(files.map((f) => sharp(f).metadata()));

    const badge = () => circle(M + 20, 62, 20, { fill: ink })
      + circle(M + 20, 56, 7, { fill: paper })
      + rect(M + 12, 66, 16, 12, { r: 4, fill: paper })
      + text('sansBold', M + 52, 71, spec.brand.toUpperCase(), { size: 22, fill: ink, ls: 2.4 });

    const chrome = () => rect(0, 0, W, H, { fill: paper }) + grain(W, H, { op: 0.05 }) + badge();

    /**
     * Headline stacked black over accent with a rule under the accent line —
     * the reference's signature move, and the reason the copy is written as
     * two short lines rather than one long one.
     */
    const heading = (lines, y, max) => {
      const h = stack('displayCondXB', lines.map((l) => l.toUpperCase()), { x: M, y, w: W - M * 2, h: 320 },
        { max, min: 40, lineHeight: 1.0, fill: (_, i) => (i === lines.length - 1 ? acc : ink) });
      const lastRow = h.rows[h.rows.length - 1];
      const rule = line(M, Math.round(lastRow.y + h.size * 0.16), M + Math.min(lastRow.width, W - M * 2),
        Math.round(lastRow.y + h.size * 0.16), { stroke: acc, sw: 6 });
      return { svg: h.svg + rule, bottom: h.bottom + 14, size: h.size };
    };

    const out = [];
    // The campaign names the pose per slide (1-based). Round-robin put the
    // flexing pose on the legs slide, which reads as carelessness on a fitness
    // brand — the content knows which pose it wants, so let it say.
    const pick = (want, fallback) => {
      const n = Number(want);
      return Number.isInteger(n) && n >= 1 && n <= files.length ? n - 1 : fallback % files.length;
    };

    /* cover */
    {
      const s = [chrome()];
      const h = heading(C.hook.lines, 150, 132);
      s.push(h.svg);
      if (C.hook.sub?.length) {
        s.push(aside('sansMed', C.hook.sub[0], M, h.bottom + 30, W - M * 2 - 120,
          { big: 34, mid: 30, small: 26, fill: muted }).svg);
      }
      const i = pick(C.hook.pose, 0);
      s.push(figure(metas[i], files[i], W / 2, H - 40, 720));
      out.push(s.join(''));
    }

    /* body */
    C.ranked.forEach((item, n) => {
      const s = [chrome()];
      const words = item.name.split(' ');
      const lines = words.length > 2
        ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')]
        : [item.name];
      const h = heading(lines, 132, 104);
      s.push(h.svg);

      const i = pick(item.pose, n + 1);
      // the figure sits right, the work sits left — the reference never centres
      // a body slide, because the list is the payload
      s.push(figure(metas[i], files[i], W * 0.71, H - 30, 640));
      const l = list('sansSemi', item.lines, M, h.bottom + 40, W * 0.52, {
        size: 27, fill: ink, marker: '•', markerFill: acc, markerSize: 30, gap: 20, indent: 34, lineHeight: 1.4,
      });
      s.push(l.svg);
      if (item.score) {
        s.push(rect(M, l.bottom + 34, 168, 58, { r: 6, fill: acc }));
        s.push(text('sansBold', M + 84, l.bottom + 73, item.score, { size: 27, fill: '#FFFFFF', anchor: 'middle' }));
      }
      out.push(s.join(''));
    });

    /* closer */
    {
      const s = [chrome()];
      const h = heading(C.closer.lines, 150, 124);
      s.push(h.svg);
      const i = pick(C.closer.pose, C.ranked.length + 1);
      s.push(figure(metas[i], files[i], W / 2, H - 150, 640));
      s.push(rect(M, H - 130, W - M * 2, 78, { r: 8, fill: ink }));
      s.push(text('sansBold', W / 2, H - 79, C.closer.cta, { size: 30, fill: paper, anchor: 'middle' }));
      out.push(s.join(''));
    }

    return out;
  },
};
