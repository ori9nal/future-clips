// BEDROCK — the @bedrock.form format, measured off the two reference sets.
//
// Cream ground. A small badge. A headline in tall condensed caps at ~130px,
// stacked BLACK over RED with a red rule under the red line. A cel-shaded
// charcoal figure with glowing eyes filling most of the frame, doing the
// exercise the slide teaches, with the working muscles tinted red. Under it a
// bullet list of the actual work: "Push Ups — 4x15-20". Progression slides
// are a 2x2 grid of LEVEL tags. The app slide is the figure holding a phone
// beside a real phone with the app's own screen in it.
//
// The first build of this style had the headline at a third of that size and
// the figure at a quarter, and read as a wireframe of the reference rather
// than the reference. Every number below was taken off the real slides.
//
// The figure is GENERATED per slide (engine/character.mjs) from one reference
// figure, so it does the movement named rather than a stock pose — that is
// what makes the reference work: the character is always doing the thing.
import fs from 'node:fs';
import path from 'node:path';
import { rect, line, text, image, grain, circle } from './kit.mjs';
import { loadFace } from '../fonts.mjs';
import { layoutWidth } from '../fit-text.mjs';
import { FACES } from './kit.mjs';
import { figure, figureRow } from '../character.mjs';

const W = 1080, H = 1350, M = 64;

export default {
  id: 'bedrock',
  label: 'Bedrock',
  canvas: { w: W, h: H },
  niches: ['fitness', 'gym', 'calisthenics', 'supplements', 'health'],
  blurb: 'Cream ground, huge condensed black-over-red headline, a cel-shaded character doing the exercise with the muscles tinted, sets x reps underneath.',
  requires: ['assets.character.ref'],

  async slides(spec, ctx) {
    const { sharp, root, outDir } = ctx;
    const C = spec.content;
    const paper = '#F3EBDD', ink = '#141212', muted = '#6B635C';
    const acc = /^#[0-9a-f]{6}$/i.test(spec.assets?.palette?.[1] ?? '') ? spec.assets.palette[1] : '#E0261B';
    const quality = spec.assets?.character?.quality ?? 'medium';
    const cacheDir = path.join(root, 'output/gen/cache');
    const figDir = path.join(outDir, 'figures');
    fs.mkdirSync(figDir, { recursive: true });

    const refFile = path.join(root, spec.assets?.character?.ref ?? 'output/gen/character/ref.png');
    if (!fs.existsSync(refFile)) throw new Error(`bedrock needs a reference figure at ${refFile} (tools/make-character.mjs)`);
    let usd = 0;

    const anton = loadFace(FACES.anton.file);
    const widthOf = (s, size) => layoutWidth(anton, s, size);

    /* ── chrome ─────────────────────────────────────────────────────── */
    const badge = () => {
      const name = (spec.brand ?? 'BRAND').toUpperCase();
      return circle(M + 14, 58, 14, { fill: ink }) + circle(M + 14, 53, 5, { fill: paper }) + rect(M + 7, 61, 14, 9, { r: 3, fill: paper })
        + text('sansBold', M + 40, 66, name, { size: 22, fill: ink, ls: 2 });
    };
    const chrome = () => rect(0, 0, W, H, { fill: paper }) + grain(W, H, { op: 0.045 }) + badge();

    /**
     * The headline. Lines are set in Anton caps, centred, the LAST line in
     * the accent with a rule under it. Size is fitted to the widest line so
     * "CALISTHENICS" and "PUSH DAY" both fill the measure; the reference runs
     * 120–150px and never below about 96.
     */
    const headline = (lines, top, { max = 150, min = 84, accentLast = true, sub } = {}) => {
      // a line past ~16 characters breaks at its last space — the model
      // writes "DAY 6+7 — FULL BODY," and the size collapses to fit it
      const L = lines.flatMap((l) => {
        const u = String(l).toUpperCase().replace(/\s*[—–-]\s*$/, '');
        if (u.length <= 16 || !u.includes(' ')) return [u];
        const cut = u.lastIndexOf(' ', 16);
        return cut > 3 ? [u.slice(0, cut), u.slice(cut + 1)] : [u];
      }).slice(0, 3);
      const measure = W - M * 2;
      let size = max;
      while (size > min && Math.max(...L.map((l) => widthOf(l, size))) > measure) size -= 2;
      const lh = 0.98;
      const cap = anton.capHeight / anton.upm;
      let y = top + size * cap;
      let svg = '';
      L.forEach((l, i) => {
        const isAcc = accentLast && i === L.length - 1 && L.length > 1;
        svg += text('anton', W / 2, Math.round(y), l, { size, fill: isAcc ? acc : ink, anchor: 'middle' });
        if (isAcc) {
          const w = widthOf(l, size);
          svg += line(Math.round(W / 2 - w / 2), Math.round(y + size * 0.14), Math.round(W / 2 + w / 2), Math.round(y + size * 0.14), { stroke: acc, sw: Math.max(6, Math.round(size * 0.055)) });
        }
        y += size * lh;
      });
      let bottom = top + L.length * size * lh;
      if (sub) {
        svg += text('sansSemi', W / 2, Math.round(bottom + 30), sub, { size: 30, fill: ink, anchor: 'middle' });
        bottom += 46;
      }
      return { svg, bottom, size };
    };

    /** Bullet list, bold, accent dots — "Push Ups — 4x15-20". */
    const bullets = (items, x, y, { size = 36, gap = 20, fill = ink } = {}) => {
      let svg = '', yy = y;
      for (const it of items) {
        svg += circle(x + 10, Math.round(yy - size * 0.34), 9, { fill: ink });
        svg += text('sansBold', x + 40, Math.round(yy), it, { size, fill });
        yy += size + gap;
      }
      return { svg, bottom: yy };
    };

    /** A generated figure placed to fit a box, bottom-aligned, centred on cx. */
    const place = async (fig, cx, bottom, maxH, maxW) => {
      const sc = Math.min(maxH / fig.h, maxW / fig.w);
      const w = Math.round(fig.w * sc), h = Math.round(fig.h * sc);
      return image(fig.file, Math.round(cx - w / 2), Math.round(bottom - h), w, h);
    };

    const fig = async (n, pose, muscles) => {
      const r = await figure({ root, cacheDir, refFile, pose, muscles, accent: acc, quality, outFile: path.join(figDir, `fig-${n}.png`), label: `${spec.id}-fig${n}` });
      usd += r.usd;
      return r;
    };

    const out = [];
    const total = C.ranked.length + 2;

    /* ── cover ──────────────────────────────────────────────────────── */
    {
      const s = [chrome()];
      const h = headline(C.hook.lines, 112, { sub: C.hook.sub?.[0] });
      s.push(h.svg);
      const f = await fig(1, C.hook.pose ?? 'standing facing the viewer, one hand raised open toward the camera', C.hook.muscles);
      s.push(await place(f, W / 2, H - 30, H - h.bottom - 60, W - M * 2));
      out.push(s.join(''));
    }

    /* ── body ───────────────────────────────────────────────────────── */
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const s = [chrome()];
      const lines = item.headline ?? (item.name.split(' ').length > 2
        ? [item.name.split(' ').slice(0, -2).join(' '), item.name.split(' ').slice(-2).join(' ')]
        : [item.name]);

      if (item.screen) {
        // the app: headline, a short line, the figure holding a phone at left
        // and a real phone at right with the app's own screen in it
        const h = headline(lines, 112, { max: 132 });
        s.push(h.svg);
        let y = h.bottom + 26;
        for (const l of (item.lines ?? []).slice(0, 3)) { s.push(text('sansMed', M, Math.round(y), l, { size: 28, fill: ink })); y += 38; }
        const f = await fig(i + 2, item.pose ?? 'standing, holding a phone up and looking at it', item.muscles);
        s.push(await place(f, W * 0.30, H - 60, H - y - 90, W * 0.5));
        const src = path.join(root, item.screen);
        const meta = await sharp(src).metadata();
        const ph = Math.round(H - y - 110), pw = Math.round(ph * (meta.width / meta.height));
        const px = Math.round(W * 0.92 - pw), py = Math.round(y + 20);
        const bez = 16;
        s.push(rect(px - bez, py - bez, pw + bez * 2, ph + bez * 2, { r: 64, fill: ink }));
        s.push(`<g clip-path="inset(0 round 48px)">${image(src, px, py, pw, ph)}</g>`);
        s.push(rect(px + pw / 2 - 90, py + 14, 180, 34, { r: 17, fill: ink }));
        out.push(s.join(''));
        continue;
      }

      if (item.layout === 'grid' && (item.levels ?? item.lines)?.length >= 4) {
        // progression: LEVEL 1-4, each a small figure with a caption
        const h = headline(lines, 112, { max: 132 });
        s.push(h.svg);
        const lv = (item.levels ?? item.lines).slice(0, 4);
        const poses = lv.map((l) => (typeof l === 'string' ? l : l.pose ?? l.name));
        const captions = lv.map((l) => (typeof l === 'string' ? l : `${l.name} — ${l.reps ?? ''}`.trim()));
        const row = await figureRow({ root, cacheDir, refFile, poses: poses.map((p) => `doing ${p.replace(/\s*[—-]\s*\d.*$/, '')}`), muscles: item.muscles, accent: acc, quality, outDir: path.join(figDir, `grid-${i + 2}`), label: `${spec.id}-grid${i + 2}` });
        usd += row.usd;
        const gy = h.bottom + 30, gh = H - gy - 40;
        const cw = (W - M * 2) / 2, ch = gh / 2;
        for (let k = 0; k < 4; k++) {
          const cx = M + cw * (k % 2) + cw / 2, cy = gy + ch * Math.floor(k / 2);
          s.push(rect(Math.round(cx - cw / 2 + 10), Math.round(cy + 6), 118, 36, { r: 4, fill: ink }));
          s.push(text('sansBold', Math.round(cx - cw / 2 + 69), Math.round(cy + 32), `LEVEL ${k + 1}`, { size: 20, fill: paper, anchor: 'middle', ls: 1 }));
          const p = row.parts[k];
          if (p) s.push(await place(p, cx, Math.round(cy + ch - 56), ch - 110, cw - 40));
          s.push(text('sansBold', Math.round(cx), Math.round(cy + ch - 18), captions[k], { size: 22, fill: ink, anchor: 'middle' }));
        }
        out.push(s.join(''));
        continue;
      }

      // list: headline, the figure big in the middle, the work underneath
      const h = headline(lines, 112, { max: 140 });
      s.push(h.svg);
      const items = (item.lines ?? []).slice(0, 5);
      const listH = items.length ? items.length * 56 + 24 : 0;
      const f = await fig(i + 2, item.pose ?? `doing ${item.name.toLowerCase()}`, item.muscles);
      const figBottom = H - listH - 40;
      s.push(await place(f, W / 2, figBottom, figBottom - h.bottom - 30, W - M * 2));
      if (items.length) s.push(bullets(items, M + 40, figBottom + 56).svg);
      if (item.score && !items.length) s.push(text('sansBold', W / 2, H - 70, item.score, { size: 30, fill: acc, anchor: 'middle' }));
      out.push(s.join(''));
    }

    /* ── closer ─────────────────────────────────────────────────────── */
    {
      const s = [chrome()];
      const h = headline(C.closer.lines?.length ? C.closer.lines : ['FOLLOW', 'FOR MORE'], 112, { max: 150 });
      s.push(h.svg);
      s.push(text('sansSemi', M, Math.round(h.bottom + 34), 'SAVE THIS FOR LATER', { size: 22, fill: muted, ls: 2 }));
      const f = await fig(total, C.closer.pose ?? 'standing, flexing both arms, front double biceps', C.closer.muscles ?? 'biceps and shoulders');
      s.push(await place(f, W / 2, H - 130, H - h.bottom - 200, W - M * 2));
      s.push(rect(M, H - 108, W - M * 2, 68, { r: 8, fill: ink }));
      s.push(text('sansBold', W / 2, H - 64, C.closer.cta ?? `Follow @${spec.requirements?.required_mention?.replace('@', '') ?? spec.brand}`, { size: 28, fill: paper, anchor: 'middle' }));
      out.push(s.join(''));
    }

    ctx.artUsd = usd;
    return out;
  },
};
