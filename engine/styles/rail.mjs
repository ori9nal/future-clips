// RAIL — the Grow with Alex family (docs/QUALITY.md §3.4).
//
// Rebuilt 2026-09-18 from five carousels read signed-in (43 slides,
// reference/growithalex/ig/) plus the 18 images on disk. The family has two
// page grammars and a post uses both:
//
//   A  full-bleed cinematic photograph, a tracked header strip, a LOUD line
//      with a QUIET line above it (the jump in scale does the work), a triplet
//      of tiny footer cells. Every cover and every closer; the whole of the
//      font-pairings post.
//   B  a cream or near-black page, an orange disc with the ordinal, the loud
//      line beside it, a quiet qualifier under, a photograph in a rounded
//      card, three rule-separated notes beside the card, and an orange verdict
//      bar near the foot. The three "steal my" posts; light and dark pages
//      alternate.
//
// Four faces per set: the pairing's loud and quiet faces (engine/pairings.mjs,
// rotated per set, never within one), a body sans for the notes, a tracked
// grotesk for the strip. Orange is the only colour unless the campaign's
// palette carries a usable accent. No de-slop, no grade: this family is
// clean by design and the photographs carry the mood.
import fs from 'node:fs';
import path from 'node:path';
import { rect, line, circle, text, stack, paragraph, plate, image, scrim, grain, FACES } from './kit.mjs';
import { loadFace } from '../fonts.mjs';
import { layoutWidth } from '../fit-text.mjs';
import { pickPairing } from '../pairings.mjs';
import { scoreRegion } from '../caption.mjs';

const ORANGE = '#F26B21';
const CREAM = '#EFE9DD';
const BLACK = '#141416';
const INK_ON_CREAM = '#141416';
const INK_ON_BLACK = '#F4F1EA';

/** A palette accent that reads as an accent: not white, not black, not the paper. */
function accentOf(spec) {
  const c = (spec.assets?.palette ?? []).map((h) => String(h).toUpperCase());
  const ok = (h) => { const m = /^#([0-9A-F]{6})$/.exec(h); if (!m) return false; const n = parseInt(m[1], 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx > 90 && (mx - mn) / mx > 0.35; };
  return c.find(ok) ?? ORANGE;
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export default {
  id: 'rail',
  label: 'Rail',
  canvas: { w: 1080, h: 1350 },
  niches: ['creator', 'design', 'marketing', 'travel', 'lifestyle', 'fashion', 'agency', 'mindset'],
  blurb: 'The designed carousel: a cinematic cover with a loud/quiet type pair, then one named thing per page with a card, three notes and a verdict bar.',

  async slides(spec, ctx) {
    const { sharp, outDir, root } = ctx;
    const C = spec.content;
    const W = 1080, H = 1350, M = 64;
    const accent = accentOf(spec);

    // one pairing for the whole set, rotated between sets
    const pair = pickPairing({
      root, seed: `${spec.id}:${(C.hook?.lines ?? []).join(' ')}`, force: spec.assets?.pairing,
      moods: [spec.niche, ...(spec.assets?.moods ?? [])],
      allow: (p) => p.loud !== 'phoneSemi',
    });
    const LOUD = pair.loud, QUIET = pair.quiet, BODY = pair.body ?? 'sans';
    const STRIP = 'sansSemi';
    spec.content.pairing = { id: pair.id, head: LOUD, body: BODY, quiet: QUIET };

    const total = C.ranked.length + 2;
    const handle = String(spec.requirements?.required_mention ?? '').replace(/^@/, '');
    const month = MONTHS[new Date().getMonth()];

    /** The header strip: three tiny tracked cells. */
    const strip = (fill, { left, mid, right } = {}) => {
      const l = (left ?? `${month} ©${new Date().getFullYear()}`).toUpperCase();
      const m = (mid ?? spec.brand).toUpperCase();
      const r = (right ?? spec.product ?? spec.niche ?? '').toUpperCase();
      return text(STRIP, M, 62, l, { size: 15, fill, ls: 2.4 })
        + text(STRIP, W / 2, 62, m, { size: 15, fill, ls: 2.4, anchor: 'middle' })
        + text(STRIP, W - M, 62, r, { size: 15, fill, ls: 2.4, anchor: 'end' });
    };

    /** The footer triplet: three tiny cells along the bottom (the covers). */
    const triplet = (cells, fill) => {
      const [a, b, c] = [cells[0] ?? '', cells[1] ?? '', cells[2] ?? ''].map((s) => String(s).toUpperCase());
      const y = H - 58;
      return text(STRIP, M, y, a, { size: 14, fill, ls: 2.2 })
        + text(STRIP, W / 2, y, b, { size: 14, fill, ls: 2.2, anchor: 'middle' })
        + text(STRIP, W - M, y, c, { size: 14, fill, ls: 2.2, anchor: 'end' });
    };

    /**
     * The loud/quiet lockup, centred: the quiet line small above, the loud line
     * fitted to the measure below. The scale jump (quiet ≈ 0.28 of loud) is the
     * device; both lines must be present for it to read.
     */
    const lockup = (quietText, loudText, y, { max = 230, fill = '#FFFFFF', quietFill, width = W - M * 2 } = {}) => {
      const loudFace = loadFace(FACES[LOUD].file);
      const quietFace = loadFace(FACES[QUIET].file);
      const unit = layoutWidth(loudFace, loudText, 100) / 100;
      const loudSize = Math.round(Math.min(max, (width * 0.94) / Math.max(unit, 0.01)));
      const quietSize = Math.round(Math.max(30, loudSize * 0.28));
      let s = '';
      let cy = y + quietSize * (quietFace.capHeight / quietFace.upm);
      if (quietText) s += text(QUIET, W / 2, Math.round(cy), quietText, { size: quietSize, fill: quietFill ?? fill, anchor: 'middle' });
      const gap = quietText ? quietSize * 0.30 : 0;
      cy += gap + loudSize * (loudFace.capHeight / loudFace.upm);
      s += text(LOUD, W / 2, Math.round(cy), loudText, { size: loudSize, fill, anchor: 'middle' });
      return { svg: s, bottom: cy + loudSize * 0.14, loudSize, quietSize };
    };

    /** A photograph, full canvas or card-sized, without grade or de-slop. */
    async function photo(idOrPath, w, h) {
      const src = path.isAbsolute(String(idOrPath)) ? String(idOrPath) : path.join(ctx.photoDir ?? root, `${idOrPath}.jpg`);
      return plate(sharp, src, w, h, outDir);
    }

    async function lumAt(file, y0, h) {
      try { const r = await scoreRegion(file, { w: W, h: H, sharp, rect: { x: 0, y: Math.max(0, y0), w: W, h } }); return r.mean ?? 128; } catch { return 128; }
    }

    /** Split "steal my carousel layouts" into a quiet lead and a loud tail when the model gave no pair. */
    const splitTitle = (line) => {
      const w = String(line ?? '').trim().split(/\s+/).filter(Boolean);
      if (w.length <= 2) return { quiet: '', loud: w.join(' ') };
      const k = Math.min(3, w.length - 1);
      return { quiet: w.slice(0, k).join(' '), loud: w.slice(k).join(' ') };
    };

    const out = [];

    /* ── cover (grammar A) ─────────────────────────────────────────────── */
    {
      const f = await photo(C.hook.photo, W, H);
      const s = [image(f, 0, 0, W, H)];
      const lum = await lumAt(f, 0, Math.round(H * 0.45));
      const top = Math.min(0.72, 0.28 + Math.max(0, lum - 70) / 220);
      s.push(scrim(0, 0, W, Math.round(H * 0.58), { from: `rgba(0,0,0,${top.toFixed(2)})`, to: 'rgba(0,0,0,0)', id: 'rc1' }));
      s.push(scrim(0, Math.round(H * 0.78), W, Math.round(H * 0.22), { from: 'rgba(0,0,0,0)', to: 'rgba(0,0,0,0.6)', id: 'rc2', dir: 'down' }));
      s.push(strip('#FFFFFF', { right: handle ? `@${handle}` : undefined }));
      const t = C.hook.loud ? { quiet: C.hook.quiet ?? '', loud: C.hook.loud } : splitTitle(C.hook.lines?.[0]);
      const l = lockup(t.quiet, t.loud, Math.round(H * 0.12), { max: 240 });
      s.push(l.svg);
      if (C.hook.sub?.length) s.push(paragraph(BODY, C.hook.sub[0], M, l.bottom + 28, W - M * 2, { size: 30, fill: 'rgba(255,255,255,0.9)', lineHeight: 1.4, anchor: 'middle' }).svg.replace(/x="\d+"/g, `x="${W / 2}"`));
      const tags = C.hook.tags?.length ? C.hook.tags : [`${C.ranked.length} things`, spec.brand, 'save this'];
      s.push(triplet(tags, 'rgba(255,255,255,0.85)'));
      out.push(s.join(''));
    }

    /* ── body (grammar B) ──────────────────────────────────────────────── */
    let shown = 0;
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const dark = i % 3 === 2;                       // the layouts post: pages 4 and 7 of 9 are black
      const paper = dark ? BLACK : CREAM, ink = dark ? INK_ON_BLACK : INK_ON_CREAM;
      const dim = dark ? 'rgba(244,241,234,0.62)' : 'rgba(20,20,22,0.62)';
      const rule = dark ? 'rgba(244,241,234,0.22)' : 'rgba(20,20,22,0.18)';
      const s = [rect(0, 0, W, H, { fill: paper })];
      s.push(grain(W, H, { op: dark ? 0.05 : 0.07, id: `rg${i}` }));
      s.push(strip(dim, { left: handle ? `@${handle}` : undefined, mid: '', right: spec.product ?? spec.niche }));

      // the ordinal disc, unless the item is a bonus or an app slide
      const isApp = !!(item.screen || item.icon);
      const numbered = !item.bonus && !isApp && C.numbering !== 'none';
      const rank = item.rank ?? (numbered ? ++shown : null);
      const cy = Math.round(H * 0.155), cx = M + 48;
      let x = M;
      if (numbered && rank != null) {
        s.push(circle(cx, cy, 48, { fill: accent }));
        s.push(text(LOUD === 'displayCond' || LOUD === 'anton' || LOUD === 'bebas' ? LOUD : 'sansBlack', cx, cy + 15, String(rank).padStart(2, '0'), { size: 40, fill: '#FFFFFF', anchor: 'middle' }));
        x = cx + 48 + 30;
      }
      // the loud line beside the disc, fitted to the remaining measure
      const name = String(item.loud ?? item.name ?? '').replace(/^\s*(?:no\.?|#)?\s*\d+\s*[.:\-–—]\s*/i, '');
      const head = stack(LOUD, [name], { x, y: cy - 46, w: W - x - M, h: 96 }, { min: 44, max: 92, fill: ink, lineHeight: 1.0 });
      s.push(head.svg);
      const quiet = item.quiet ?? item.score ?? '';
      let qy = head.bottom + 10;
      if (quiet) { const q = paragraph(QUIET, quiet, x, qy, W - x - M, { size: 34, fill: dim, lineHeight: 1.2 }); s.push(q.svg); qy = q.bottom; }

      // the card: the photograph (or the app screenshot) in a rounded frame
      const cardY = Math.max(Math.round(H * 0.31), Math.round(qy) + 28);
      const cardW = Math.round(W * 0.50), cardH = Math.round(H * 0.42);
      const src = item.screen ? path.join(root, item.screen) : item.photo;
      const card = await plate(sharp, path.isAbsolute(String(src)) ? String(src) : path.join(ctx.photoDir ?? root, `${src}.jpg`), cardW, cardH, outDir);
      s.push(rect(M - 2, cardY - 2, cardW + 4, cardH + 4, { r: 20, fill: dark ? 'rgba(244,241,234,0.14)' : 'rgba(20,20,22,0.12)' }));
      s.push(image(card, M, cardY, cardW, cardH, { round: 18 }));

      // three notes beside the card, rule-separated
      const nx = M + cardW + 40, nw = W - nx - M;
      let ny = cardY + 6;
      const notes = (item.lines ?? []).slice(0, 3);
      notes.forEach((n, k) => {
        const p = paragraph(BODY, n, nx, ny, nw, { size: 27, fill: ink, lineHeight: 1.32 });
        s.push(p.svg);
        ny = p.bottom + 16;
        if (k < notes.length - 1) { s.push(line(nx, Math.round(ny), nx + Math.round(nw * 0.6), Math.round(ny), { stroke: rule, sw: 1.5 })); ny += 18; }
      });

      // the verdict bar
      const verdict = item.verdict ?? (item.lines ?? [])[3] ?? '';
      if (verdict) {
        const vf = loadFace(FACES.sansBold.file);
        const vs = 28;
        const vw = Math.min(W - M * 2, Math.ceil(layoutWidth(vf, verdict, vs)) + 56);
        const vy = cardY + cardH + 44;
        s.push(rect(M, vy, vw, 64, { fill: accent }));
        s.push(text('sansBold', M + 28, vy + 42, verdict, { size: vs, fill: '#FFFFFF' }));
      }
      s.push(text(BODY, W - M, H - 58, `${String(i + 2).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, { size: 15, fill: dim, ls: 1.5, anchor: 'end' }));
      out.push(s.join(''));
    }

    /* ── closer (grammar A) ────────────────────────────────────────────── */
    {
      const f = await photo(C.closer.photo, W, H);
      const s = [image(f, 0, 0, W, H)];
      s.push(scrim(0, 0, W, H, { from: 'rgba(0,0,0,0.55)', mid: 'rgba(0,0,0,0.35)', midAt: 0.5, to: 'rgba(0,0,0,0.6)', id: 'rcz' }));
      s.push(strip('#FFFFFF', { left: spec.brand, mid: '', right: handle ? `@${handle}` : undefined }));
      const keyword = C.closer.loud ?? (String(C.closer.cta ?? '').split(/\s+/)[0] ?? 'SAVE').toUpperCase();
      const l = lockup(C.closer.quiet ?? 'comment', keyword, Math.round(H * 0.33), { max: 250 });
      s.push(l.svg);
      const ask = C.closer.lines?.[0] ?? C.closer.cta ?? '';
      if (ask) s.push(paragraph(BODY, ask, M, l.bottom + 30, W - M * 2, { size: 32, fill: '#FFFFFF', lineHeight: 1.4, anchor: 'middle' }).svg.replace(/x="\d+"/g, `x="${W / 2}"`));
      if (C.closer.cta && C.closer.lines?.[0] && C.closer.cta !== C.closer.lines[0]) s.push(text(BODY, W / 2, Math.round(H * 0.70), C.closer.cta, { size: 24, fill: 'rgba(255,255,255,0.8)', anchor: 'middle' }));
      s.push(triplet([handle ? `follow @${handle}` : spec.brand, 'to receive', spec.product ?? ''], 'rgba(255,255,255,0.85)'));
      out.push(s.join(''));
    }

    return out;
  },
};
