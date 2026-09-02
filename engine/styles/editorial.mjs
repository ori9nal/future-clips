// EDITORIAL — the quiet magazine look (library folder 13).
//
// Near-white ground, a serif headline where exactly one word carries an italic
// accent colour, body copy set small with a lot of air, and a desaturated
// cutout figure sitting low in the frame. It is the calmest thing in the
// library and it works because it is calm — the restraint IS the message, so
// the accent has to stay rationed to one word per slide.
import { rect, line, text, stack, paragraph, plate, image, grain } from './kit.mjs';
import { loadFace } from '../fonts.mjs';
import { layoutWidth } from '../fit-text.mjs';

export default {
  id: 'editorial',
  label: 'Editorial',
  canvas: { w: 1080, h: 1350 },
  niches: ['mindset', 'running', 'wellness', 'self-improvement', 'nutrition'],
  blurb: 'Near-white, airy serif with a single italic accent word, small body copy, a desaturated figure low in frame.',

  async slides(spec, ctx) {
    const { sharp, outDir } = ctx;
    const C = spec.content;
    const paper = '#FAF9F7', ink = '#16181B', muted = '#767B82';
    const accent = spec.assets.palette?.[1] ?? '#D8541F';
    const W = 1080, H = 1350, M = 96;
    const out = [];
    const total = C.ranked.length + 2;
    const serifFace = loadFace('Newsreader-Regular');

    /**
     * Split a headline so the LAST word of the marked line renders italic in
     * the accent. The reference does exactly one accent per slide; more than
     * that and the page stops being quiet.
     */
    const accented = (lines, box, o = {}) => {
      const h = stack('serif', lines, box, { max: o.max ?? 88, min: o.min ?? 40, lineHeight: 1.14, fill: ink });
      let svg = '';
      h.rows.forEach((row, i) => {
        const isAccent = i === (o.accentRow ?? lines.length - 1);
        if (!isAccent) { svg += text('serif', box.x, row.y, row.text, { size: h.size, fill: ink }); return; }
        const words = row.text.split(' ');
        const tail = words.pop();
        const head = words.join(' ');
        // measure the head so the accented tail starts exactly after it
        svg += text('serif', box.x, row.y, head, { size: h.size, fill: ink });
        // measured against the real face, so the accent starts exactly where
        // the roman text ends rather than at an estimated character offset
        const headW = head ? layoutWidth(serifFace, head + ' ', h.size) : 0;
        svg += text('serifMedItalic', box.x + headW, row.y, tail, { size: h.size, fill: accent });
      });
      return { ...h, svg };
    };

    const chrome = (n) => rect(0, 0, W, H, { fill: paper })
      + grain(W, H, { op: 0.04 })
      + text('mono', M, H - 64, spec.requirements.required_mention, { size: 21, fill: muted })
      + text('mono', W - M, H - 64, `${n}/${total}`, { size: 21, fill: muted, anchor: 'end' });

    /* cover */
    {
      const s = [chrome(1)];
      const h = accented(C.hook.lines, { x: M, y: 200, w: W - M * 2, h: 430 }, { max: 96, min: 46 });
      s.push(h.svg);
      if (C.hook.sub?.length) {
        s.push(paragraph('sans', C.hook.sub.join(' '), M, h.bottom + 40, W - M * 2 - 180,
          { size: 27, fill: muted, lineHeight: 1.55 }).svg);
      }
      if (C.hook.photo) {
        const ph = 520;
        const p = await plate(sharp, `${ctx.photoDir}/${C.hook.photo}.jpg`, W - M * 2, ph, outDir);
        // desaturated so the figure reads as a plate, not a stock photo
        s.push(`<g style="filter:grayscale(1) contrast(1.08)">${image(p, M, H - 150 - ph, W - M * 2, ph, { round: 3 })}</g>`);
      }
      out.push(s.join(''));
    }

    /* body slides — one thought each, which is the whole discipline of the style */
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const s = [chrome(i + 2)];
      const h = accented([item.name], { x: M, y: 190, w: W - M * 2, h: 260 }, { max: 78, min: 38, accentRow: 0 });
      s.push(h.svg);
      let y = h.bottom + 46;
      for (const para of item.lines) {
        const p = paragraph('sans', para, M, y, W - M * 2 - 140, { size: 27, fill: '#3A3F45', lineHeight: 1.6 });
        s.push(p.svg);
        y = p.bottom + 26;
      }
      if (item.score) {
        s.push(line(M, y + 8, M + 64, y + 8, { stroke: accent, sw: 3 }));
        s.push(text('serifMedItalic', M, y + 62, item.score, { size: 30, fill: accent }));
      }
      if (item.photo) {
        const ph = 440;
        const p = await plate(sharp, `${ctx.photoDir}/${item.photo}.jpg`, W - M * 2, ph, outDir);
        s.push(`<g style="filter:grayscale(1) contrast(1.08)">${image(p, M, H - 150 - ph, W - M * 2, ph, { round: 3 })}</g>`);
      }
      out.push(s.join(''));
    }

    /* close */
    {
      const s = [chrome(total)];
      // centred rather than top-aligned: the closer carries two lines, and
      // flowing them from the top left the bottom half of the frame empty
      const probe = accented(C.closer.lines, { x: M, y: 0, w: W - M * 2, h: 420 }, { max: 86, min: 42 });
      const top = Math.round((H - probe.height - 200) / 2);
      const h = accented(C.closer.lines, { x: M, y: top, w: W - M * 2, h: 420 }, { max: 86, min: 42 });
      s.push(h.svg);
      s.push(line(M, h.bottom + 56, W - M, h.bottom + 56, { stroke: '#E2DED8', sw: 1.5 }));
      s.push(text('sansSemi', M, h.bottom + 122, C.closer.cta, { size: 32, fill: ink }));
      s.push(text('mono', M, h.bottom + 172, '—', { size: 26, fill: accent }));
      out.push(s.join(''));
    }

    return out;
  },
};
