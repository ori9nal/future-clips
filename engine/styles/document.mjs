// DOCUMENT — the worked-example look (library folder 4).
//
// White ground, numbered sections, and actual TABLES. This is the style for
// content where the value is the specifics: thresholds, tiers, worked numbers.
// The reference sets a real table with a header row and cells, then a footnote.
//
// Tables are the reason this style exists, so the table is measured rather than
// laid out on guessed column widths — a column sized by eye clips its own
// contents the first time a campaign uses a longer label.
import { rect, line, text, stack, paragraph, grain, FACES } from './kit.mjs';
import { loadFace } from '../fonts.mjs';
import { layoutWidth } from '../fit-text.mjs';

/** Column widths from the widest measured cell, then scaled to the target. */
function table(rows, x, y, w, o = {}) {
  const size = o.size ?? 25, pad = o.pad ?? 20, rowH = o.rowH ?? 74;
  const head = loadFace(FACES.monoBold.file), body = loadFace(FACES.sans.file);
  const cols = rows[0].length;
  const natural = [];
  for (let c = 0; c < cols; c++) {
    let max = 0;
    rows.forEach((r, ri) => {
      const face = ri === 0 ? head : body;
      max = Math.max(max, layoutWidth(face, String(r[c] ?? ''), size));
    });
    natural.push(max + pad * 2);
  }
  const totalNat = natural.reduce((s, v) => s + v, 0);
  const widths = natural.map((v) => (v / totalNat) * w);

  let svg = '', cy = y;
  rows.forEach((row, ri) => {
    const isHead = ri === 0;
    if (isHead) svg += rect(x, cy, w, rowH, { fill: o.headFill ?? '#111418' });
    else if (ri % 2 === 0) svg += rect(x, cy, w, rowH, { fill: '#F4F5F7' });
    let cx = x;
    row.forEach((cell, ci) => {
      const t = String(cell ?? '');
      // wrap inside the cell rather than letting a long value run into the next
      const face = isHead ? head : body;
      const avail = widths[ci] - pad * 2;
      let shown = t, sz = size;
      while (layoutWidth(face, shown, sz) > avail && sz > 15) sz -= 1;
      svg += text(isHead ? 'monoBold' : 'sans', cx + pad, cy + rowH / 2 + sz * 0.35, shown,
        { size: sz, fill: isHead ? '#FFFFFF' : '#1B1F24', ls: isHead ? 1 : 0 });
      cx += widths[ci];
    });
    if (!isHead) svg += line(x, cy, x + w, cy, { stroke: '#DFE2E6', sw: 1.5 });
    cy += rowH;
  });
  svg += line(x, cy, x + w, cy, { stroke: '#DFE2E6', sw: 1.5 });
  return { svg, bottom: cy, height: cy - y };
}

export default {
  id: 'document',
  label: 'Document',
  canvas: { w: 1080, h: 1350 },
  niches: ['finance', 'personal finance', 'business', 'legal', 'productivity'],
  blurb: 'Numbered sections, real tables with measured columns, worked examples and a footnote. For content whose value is the specifics.',

  async slides(spec, ctx) {
    const C = spec.content;
    const ink = '#111418', muted = '#6C737B';
    const accent = spec.assets.palette?.[1] ?? '#1F6F4A';
    const W = 1080, H = 1350, M = 80;
    const out = [];
    const total = C.ranked.length + 2;

    const chrome = (n) => rect(0, 0, W, H, { fill: '#FFFFFF' })
      + grain(W, H, { op: 0.03 })
      + text('mono', M, H - 62, spec.requirements.required_mention, { size: 21, fill: muted })
      + text('mono', W - M, H - 62, `${n} / ${total}`, { size: 21, fill: muted, anchor: 'end' });

    /* cover */
    {
      const s = [chrome(1)];
      s.push(rect(M, 150, 76, 8, { fill: accent }));
      const h = stack('serifSemi', C.hook.lines, { x: M, y: 196, w: W - M * 2, h: 400 },
        { max: 100, min: 48, lineHeight: 1.1, fill: ink });
      s.push(h.svg);
      if (C.hook.sub?.length) {
        s.push(paragraph('sans', C.hook.sub.join(' '), M, h.bottom + 40, W - M * 2 - 160,
          { size: 29, fill: muted, lineHeight: 1.55 }).svg);
      }
      if (C.hook.table) {
        const t = table(C.hook.table, M, Math.max(h.bottom + 200, 700), W - M * 2);
        s.push(t.svg);
      }
      out.push(s.join(''));
    }

    /* sections */
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const s = [chrome(i + 2)];
      const head = stack('serifSemi', [`${i + 1}. ${item.name}`], { x: M, y: 168, w: W - M * 2, h: 180 },
        { max: 66, min: 34, lineHeight: 1.1, fill: ink });
      s.push(head.svg);
      let y = head.bottom + 36;
      for (const para of item.lines) {
        const p = paragraph('sans', para, M, y, W - M * 2, { size: 28, fill: '#242A31', lineHeight: 1.55 });
        s.push(p.svg);
        y = p.bottom + 22;
      }
      if (item.table) {
        const t = table(item.table, M, y + 26, W - M * 2);
        s.push(t.svg);
        y = t.bottom;
      }
      if (item.note) {
        s.push(line(M, y + 40, M + 60, y + 40, { stroke: accent, sw: 3 }));
        s.push(paragraph('sansItalic', item.note, M, y + 58, W - M * 2 - 80, { size: 25, fill: muted, lineHeight: 1.5 }).svg);
      }
      out.push(s.join(''));
    }

    /* close */
    {
      const s = [chrome(total)];
      const h = stack('serifSemi', C.closer.lines, { x: M, y: 220, w: W - M * 2, h: 360 },
        { max: 84, min: 42, lineHeight: 1.12, fill: ink });
      s.push(h.svg);
      let y = h.bottom + 50;
      if (C.closer.points?.length) {
        C.closer.points.forEach((pt, i) => {
          s.push(text('monoBold', M, y + 30, `${i + 1}.`, { size: 26, fill: accent }));
          const p = paragraph('sans', pt, M + 54, y, W - M * 2 - 54, { size: 27, fill: '#242A31', lineHeight: 1.5 });
          s.push(p.svg);
          y = p.bottom + 20;
        });
      }
      s.push(rect(M, H - 236, W - M * 2, 88, { r: 6, fill: accent }));
      s.push(text('sansBold', W / 2, H - 178, C.closer.cta, { size: 31, fill: '#FFFFFF', anchor: 'middle' }));
      out.push(s.join(''));
    }

    return out;
  },
};
