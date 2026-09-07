// RAIL — the growithalex format (Random niche / example 1).
//
// Full-bleed cinematic photography, a thin header rail of tracked micro-caps,
// a progress rail along the bottom with BACK / numbered dots / NEXT, and a type
// pair sitting in the upper third: one QUIET line and one LOUD line, tightly
// interlocked so they read as one lockup rather than two stacked headings.
//
// The pairing is the whole design here. It is chosen per set from
// engine/pairings.mjs and locked for the set — varied between sets, never
// within one, because a carousel that changes typeface mid-swipe reads as
// broken rather than designed.
import fs from 'node:fs';
import path from 'node:path';
import { rect, line, text, stack, paragraph, plate, image, scrim, FACES } from './kit.mjs';
import { loadFace } from '../fonts.mjs';
import { layoutWidth } from '../fit-text.mjs';
import { pickPairing } from '../pairings.mjs';
import { scoreRegion } from '../caption.mjs';
import { grade } from '../grade.mjs';

export default {
  id: 'rail',
  label: 'Rail',
  canvas: { w: 1080, h: 1350 },
  niches: ['creator', 'design', 'marketing', 'travel', 'lifestyle', 'fashion', 'agency'],
  blurb: 'Cinematic full-bleed photo, tracked header rail, numbered progress rail, and a loud/quiet type pair locked per set.',

  async slides(spec, ctx) {
    const { sharp, outDir, root } = ctx;
    const C = spec.content;
    const W = 1080, H = 1350, M = 54;

    // one pairing for the whole set
    const pair = pickPairing({
      root, seed: spec.id, force: spec.assets?.pairing,
      moods: [spec.niche, ...(spec.assets?.moods ?? [])],
    });
    const LOUD = pair.loud, QUIET = pair.quiet, BODY = pair.body;

    const ink = '#FFFFFF', dim = 'rgba(255,255,255,0.62)';
    const look = spec.assets?.look ?? 'cinematic';
    const total = C.ranked.length + 2;

    /** Header rail: three tracked micro-caps, spread across the measure. */
    const header = () => {
      const left = (spec.content.kicker ?? `${spec.brand}`).toUpperCase();
      const mid = (spec.requirements.required_mention ?? '').replace('@', '').toUpperCase();
      const right = (spec.product ?? spec.niche ?? '').toUpperCase();
      return text('monoBold', M, 56, left, { size: 17, fill: ink, ls: 2.6 })
        + text('monoBold', W / 2, 56, mid, { size: 17, fill: ink, ls: 2.6, anchor: 'middle' })
        + text('monoBold', W - M, 56, right, { size: 17, fill: ink, ls: 2.6, anchor: 'end' });
    };

    /** Progress rail: arrows, a hairline, and the slide numbers. */
    const railFoot = (n) => {
      const y = H - 52;
      let s = line(M + 74, y - 6, W - M - 74, y - 6, { stroke: ink, sw: 1.5, op: 0.5 });
      s += text('monoBold', M, y, 'BACK', { size: 15, fill: dim, ls: 2 });
      s += text('monoBold', W - M, y, 'NEXT', { size: 15, fill: dim, ls: 2, anchor: 'end' });
      s += `<path d="M ${M + 68} ${y - 6} l 10 -5 v 10 z" fill="${ink}" opacity="0.7"/>`;
      s += `<path d="M ${W - M - 68} ${y - 6} l -10 -5 v 10 z" fill="${ink}" opacity="0.7"/>`;
      const span = W - M * 2 - 200, x0 = M + 100;
      for (let i = 1; i <= total; i++) {
        const x = x0 + ((i - 0.5) / total) * span;
        s += text('monoBold', x, y, String(i).padStart(2, '0'),
          { size: 15, fill: ink, ls: 1.4, anchor: 'middle', op: i === n ? 1 : 0.42 });
      }
      return s;
    };

    /**
     * The lockup: quiet line, then loud line, negatively led so the two
     * interlock. The quiet line is indented to the loud line's optical start,
     * which is what makes them read as one object.
     */
    const lockup = (quietText, loudText, y, o = {}) => {
      const loudFace = loadFace(FACES[LOUD].file);
      const unit = layoutWidth(loudFace, loudText, 100) / 100;
      // 0.97 so the loud line never kisses the margin — filling the measure
      // exactly reads as an overflow even when it technically fits
      const boxW = (W - M * 2) * 0.97;
      const loudSize = Math.min(o.max ?? 168, boxW / unit);
      const quietSize = Math.round(loudSize * (o.quietRatio ?? 0.30));

      const qFace = loadFace(FACES[QUIET].file);
      const loudW = unit * loudSize;
      const x = o.anchor === 'middle' ? W / 2 : M + (o.indent ?? 0);

      let s = '';
      let cy = y + quietSize * (qFace.capHeight / qFace.upm);
      s += text(QUIET, o.anchor === 'middle' ? x : x + Math.round(loudSize * 0.06), Math.round(cy), quietText,
        { size: quietSize, fill: o.quietFill ?? ink, anchor: o.anchor ?? 'start' });
      // The loud line's CAP TOP sits just under the quiet baseline. Deriving the
      // baseline from the cap height is the only way to place it tightly without
      // collision — the first version subtracted a fraction of the quiet size
      // instead, which put the loud cap top ABOVE the quiet baseline and printed
      // the two lines through each other.
      const gap = quietSize * 0.22;
      cy += gap + loudSize * (loudFace.capHeight / loudFace.upm);
      s += text(LOUD, x, Math.round(cy), loudText,
        { size: loudSize, fill: o.loudFill ?? ink, anchor: o.anchor ?? 'start' });
      return { svg: s, bottom: cy + loudSize * 0.12, loudSize, quietSize, width: loudW };
    };

    async function photo(id, n) {
      const src = path.join(ctx.photoDir, `${id}.jpg`);
      const p = await plate(sharp, src, W, H, outDir);
      const graded = await grade(p, look, { width: W, height: H });
      const file = path.join(outDir, `_g${n}.png`);
      fs.writeFileSync(file, graded);
      return file;
    }

    /**
     * How dark the scrim over a band has to be for white type to hold.
     *
     * A fixed scrim is right for the average photo and wrong for the two that
     * matter — a bright fog frame swallowed white type completely while a dark
     * one got needlessly muddied. So the band under the lockup is measured and
     * the scrim is set from what is actually there.
     */
    async function scrimFor(file, y0, h) {
      const { mean } = await scoreRegion(file, {
        w: W, h: H, sharp, rect: { x: 0, y: Math.max(0, y0), w: W, h },
      }).then((r) => ({ mean: r.range != null ? r.mean ?? null : null }))
        .catch(() => ({ mean: null }));
      const lum = mean ?? 128;
      // target: keep the band under ~95 mean luminance so white holds
      const need = Math.max(0, (lum - 70) / 185);
      return Math.min(0.86, 0.3 + need * 0.62);
    }

    const out = [];

    /* cover */
    {
      const f = await photo(C.hook.photo, 1);
      const s = [image(f, 0, 0, W, H)];
      const a1 = await scrimFor(f, 100, Math.round(H * 0.34));
      s.push(scrim(0, 0, W, Math.round(H * 0.62), { from: `rgba(0,0,0,${a1.toFixed(2)})`, to: 'rgba(0,0,0,0)', id: 'sc1' }));
      s.push(scrim(0, Math.round(H * 0.82), W, Math.round(H * 0.18), { from: 'rgba(0,0,0,0)', to: 'rgba(0,0,0,0.55)', id: 'sc1b', dir: 'down' }));
      s.push(header());
      const l = lockup(C.hook.quiet ?? spec.brand.toLowerCase(), C.hook.loud ?? C.hook.lines[0], 130, { max: 176 });
      s.push(l.svg);
      if (C.hook.sub?.length) {
        s.push(paragraph(BODY, C.hook.sub[0], M + 4, l.bottom + 26, W - M * 2 - 160,
          { size: 30, fill: dim, lineHeight: 1.45 }).svg);
      }
      s.push(railFoot(1));
      out.push(s.join(''));
    }

    /* body */
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const f = await photo(item.photo, i + 2);
      const s = [image(f, 0, 0, W, H)];
      const low = i % 2 === 1;
      const ab = await scrimFor(f, low ? Math.round(H * 0.50) : 100, Math.round(H * 0.32));
      // Full-height, three stops. A band starting partway down the frame left a
      // visible hard edge; carrying the gradient across the whole canvas with a
      // floor at the lockup fixes both the edge and the contrast.
      s.push(low
        ? scrim(0, 0, W, H, {
            from: 'rgba(0,0,0,0)', mid: `rgba(0,0,0,${(ab * 0.55).toFixed(2)})`, midAt: 0.46,
            to: `rgba(0,0,0,${ab.toFixed(2)})`, id: `sc${i}`, dir: 'down' })
        : scrim(0, 0, W, H, {
            from: `rgba(0,0,0,${ab.toFixed(2)})`, mid: `rgba(0,0,0,${(ab * 0.45).toFixed(2)})`, midAt: 0.42,
            to: 'rgba(0,0,0,0)', id: `sc${i}` }));
      s.push(header());
      const y = low ? Math.round(H * 0.52) : 128;
      const l = lockup(item.quiet ?? String(i + 1).padStart(2, '0'), item.loud ?? item.name, y, { max: 150 });
      s.push(l.svg);
      let by = l.bottom + 24;
      for (const para of item.lines ?? []) {
        const p = paragraph(BODY, para, M + 4, by, W - M * 2 - 120, { size: 28, fill: dim, lineHeight: 1.5 });
        s.push(p.svg);
        by = p.bottom + 14;
      }
      s.push(railFoot(i + 2));
      out.push(s.join(''));
    }

    /* close */
    {
      const f = await photo(C.closer.photo, total);
      const s = [image(f, 0, 0, W, H)];
      const az = await scrimFor(f, Math.round(H * 0.30), Math.round(H * 0.30));
      s.push(scrim(0, 0, W, H, { from: `rgba(0,0,0,${az.toFixed(2)})`, to: `rgba(0,0,0,${(az * 0.6).toFixed(2)})`, id: 'scz' }));
      s.push(header());
      const l = lockup(C.closer.quiet ?? 'so', C.closer.loud ?? C.closer.lines[0], Math.round(H * 0.34), { max: 190, anchor: 'middle' });
      s.push(l.svg);
      s.push(text(BODY, W / 2, l.bottom + 66, C.closer.cta, { size: 32, fill: ink, anchor: 'middle' }));
      s.push(railFoot(total));
      out.push(s.join(''));
    }

    return out;
  },
};
