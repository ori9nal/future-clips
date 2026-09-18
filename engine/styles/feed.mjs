// FEED — what the TikTok slideshow niche actually posts (reference-2026-09).
//
// Measured off the reference corpus (tools/_measure.mjs, 2026-09-13), not
// guessed at. What separates a real post from what the engine produced:
//
//  1. The type is the PLATFORM'S: TikTok "Classic" (a Proxima Nova cut), one
//     weight, sentence case, white, on every one of the 100-odd phone-photo
//     slides. Never condensed, never uppercase, never a serif. Figtree is the
//     closest open face. A rotating display pairing was the loudest tell.
//  2. The outline is thin but real: 3.5–4.5 px visible on a 1080 canvas at a
//     ~55 px em, i.e. 0.065–0.075 of the size. With paint-order stroke the
//     SVG stroke-width is twice the visible width, so OUTLINE is 0.13.
//  3. The block is small and sits in the picture — over the chest as often
//     as over a quiet wall (block top median 0.33 H, bottom 0.62 H). No scrim,
//     ever: a gradient behind the text is a designed tell.
//  4. The app is a PHOTOGRAPH of a phone on a bench or in a hand (9 of 11
//     gym sets), never a full-bleed UI mock.
//
// Plus the trading device: an app icon as a rounded square over a lifestyle
// photo, with a white pill naming it underneath (sets 01, 04, 14).
import fs from 'node:fs';
import path from 'node:path';
import { rect, text, paragraph, plate, image, line, esc, FACES } from './kit.mjs';
import { familyFor, SOFT_FAMILIES } from '../scenes.mjs';
import { loadFace } from '../fonts.mjs';
import { layoutWidth } from '../fit-text.mjs';
import { breakToFit } from '../caption.mjs';
import { grade } from '../grade.mjs';
import { deslop, strengthFor } from '../deslop.mjs';
import { scoreRegion } from '../caption.mjs';
import { pickPairing } from '../pairings.mjs';

/**
 * The outline as an SVG stroke-width fraction of the em. paint-order puts
 * the fill over the stroke, so the VISIBLE outline is half this: 0.065 em,
 * which is the 4 px measured on set-05 and set-08 at their ~55 px em.
 */
const OUTLINE = 0.095;

/**
 * 2026-09-18 (docs/QUALITY.md §3.1, F1): cap heights read off native-pixel
 * crops are 48–52 px for a reference gym heading (set-08 "5. Dumbbell
 * curls" = 50) and 36–40 px for body lines (set-13); the trading family runs
 * ~37 px bodies (set-01). Rendered at the sizes below without this factor
 * the same lines came out at 35 / 27 px. So every caption is scaled by 1.4,
 * and OUTLINE drops from 0.13 to 0.095 em so the visible outline stays at
 * the measured 5–7 px instead of growing with the type.
 */
const SIZE = 1.4;

/**
 * The SOFT look (docs/QUALITY.md §3.12–3.15; the owner's 2026-09-18 batch,
 * 11 sets / 68 slides: football, fashion, skincare, height). The platform's
 * own caption — white, NO outline, a soft drop shadow, sentence case — and
 * the block dead-centre: top 0.47 / bottom 0.53 H on every one-line item
 * measured, 0.43–0.59 on five-liners. Line bands at 1080 wide: 47–58 px on
 * the football sets, 28–36 px on the fashion sets, 47 px on the height set.
 * Font sizes per family below (a band is ≈ 0.95 em); the hook runs 12 % up.
 */
const SOFT_SIZES = {
  sport:    { head: 48, body: 36 },
  fashion:  { head: 38, body: 31 },
  life:     { head: 42, body: 34 },
  everyday: { head: 42, body: 34 },
};
const SOFT_DEFS = '<defs><filter id="softsh" x="-10%" y="-40%" width="120%" height="180%">' +
  '<feGaussianBlur in="SourceAlpha" stdDeviation="3.2"/><feOffset dx="0" dy="2" result="b"/>' +
  '<feFlood flood-color="#000000" flood-opacity="0.82"/><feComposite in2="b" operator="in"/>' +
  '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>';
// the caption faces hold no emoji glyphs; the send-off's 📌 and 💜 are dropped rather than drawn as boxes
const EMOJI_G = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;
const deEmoji = (s) => String(s ?? '').replace(EMOJI_G, '').replace(/\s{2,}/g, ' ').trim();
/** A five-point star path, for the App Store card's rating row. */
const star = (cx, cy, r, fill) => {
  const pts = [];
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5; const rr = k % 2 ? r * 0.45 : r; pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`); }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
};

/**
 * Faces that hold up as a thin-outlined caption over a photo. Every pairing's
 * loud face is here; the two that are not (Unbounded, Abril) go wide or
 * spindly at caption size. A set draws ONE heading face and ONE body face from
 * its pairing and keeps them for every slide — the nine trading rounds all
 * came out in Poppins because this file hard-coded it.
 */
const CAPTION_SAFE = new Set([
  'sansBlack', 'displayCond', 'anton', 'bebas', 'oswald', 'syne', 'serifFat',
  'serifDisplay', 'serifDisplayIt', 'frauncesBlack', 'playfairBlack', 'manrope',
  'grotesk', 'outfitBlack', 'poppinsBold', 'familjen', 'phoneSemi', 'phoneBold', 'phoneMed', 'phoneAlt',
]);

/**
 * Faces differ enormously in how much line a given size buys: Bebas at 44px
 * is a whisper, Archivo Black at 44px is a wall. Sizes in this file are set
 * for Poppins, so each face is scaled to the same lowercase run as Poppins.
 */
function sizeScale(faceKey) {
  const f = loadFace(FACES[faceKey].file), p = loadFace(FACES.poppinsBold.file);
  const run = 'the quick brown fox jumps over the lazy dog';
  const r = layoutWidth(p, run, 100) / layoutWidth(f, run, 100);
  return Math.min(1.35, Math.max(0.82, Math.pow(r, 0.75)));
}

export default {
  id: 'feed',
  label: 'Feed',
  canvas: { w: 1080, h: 1440 },
  niches: ['trading', 'finance', 'fitness', 'gym', 'lifestyle', 'supplements', 'crypto', 'football', 'soccer', 'fashion', 'skincare'],
  /** 9:16 for the soft families (every one of their references is 9:16); 4:5 for gym and trading. */
  canvasFor(spec) { return SOFT_FAMILIES.has(familyFor(spec?.niche)) ? { w: 1080, h: 1920 } : this.canvas; },
  blurb: 'What the niche actually posts: full-bleed phone photography, small outlined captions, numbered countdown, app icon on a pill.',

  async slides(spec, ctx) {
    const { sharp, outDir, root } = ctx;
    const C = spec.content;
    const family = familyFor(spec.niche);
    const soft = SOFT_FAMILIES.has(family);
    const W = 1080, H = soft ? 1920 : 1440;
    const M = 56;
    const look = spec.assets?.look ?? 'cinematic';

    // The platform face, always — every reference slide is typed in it. A
    // brand with a house style can still pin a pairing with assets.pairing;
    // the default pin is not recorded, so the designed styles' rotation is
    // untouched.
    const pairing = pickPairing({
      root, seed: `${spec.id}:${(C.hook?.lines ?? []).join(' ')}`,
      moods: [spec.niche, C.mood].filter(Boolean), force: spec.assets?.pairing ?? 'phone',
      record: !!spec.assets?.pairing,
      allow: (p) => CAPTION_SAFE.has(p.loud),
    });
    const HEAD = CAPTION_SAFE.has(pairing.loud) ? pairing.loud : 'phoneSemi';
    const BODY = ['sans', 'sansMed', 'bookSerif', 'phoneSemi', 'phoneMed'].includes(pairing.body) ? pairing.body : 'phoneSemi';
    // The gym reference runs a size up on the trading reference (set 08
    // heads at ~48px and bodies at ~40px; set 01 heads at 44 and bodies at 36).
    const T = /gym|fitness|supplement|nutrition|muscle/i.test(spec.niche ?? '') ? 1.12 : 1;
    const headScale = sizeScale(HEAD) * T, bodyScale = sizeScale(BODY) * T;
    spec.content.pairing = { id: pairing.id, head: HEAD, body: BODY };

    const capFace = loadFace(FACES[HEAD].file);

    // One outline for every set: measured 5–7 px core on 1080–1200 canvases
    // across all fifteen reference sets, no hairlines and no slabs. A brand
    // can still pin `assets.stroke: "heavy"` for the CapCut look.
    const strokeMode = spec.assets?.stroke ?? 'thin';
    const OUTLINE_W = strokeMode === 'heavy' ? 0.2 : OUTLINE;
    spec.content.stroke = strokeMode;

    /**
     * A caption block, centred, small, thinly outlined.
     *
     * Sizes are absolute rather than fitted-to-fill: the reference keeps the
     * same modest scale whatever the copy is, and lets the block grow taller
     * instead of the type growing bigger. `face` is a ROLE — head or body —
     * resolved through the set's pairing, never a font name.
     */
    const SZ = SOFT_SIZES[family] ?? SOFT_SIZES.everyday;
    const softPx = (kind) => (kind === 'hook' ? Math.round(SZ.head * 1.12) : kind === 'body' ? SZ.body : kind === 'cta' ? Math.round(SZ.body * 0.92) : SZ.head);
    /** One soft block: centred lines under a drop shadow, no outline. `dry` measures only. */
    const softCaption = (lines, cy, { kind = 'head', fill = '#FFFFFF', lh = 1.32, dry = false } = {}) => {
      // the fashion references run the body a weight lighter than the heading
      const key = kind === 'body' || kind === 'cta' ? (family === 'fashion' ? 'phoneMed' : BODY) : HEAD;
      const f = FACES[key];
      const ff = loadFace(f.file);
      const size = softPx(kind);
      const wrapped = (lines ?? []).map(deEmoji).filter(Boolean).flatMap((l) => breakToFit(ff, l, Math.round(W * 0.74), size, { max: 6 }));
      const height = wrapped.length * size * lh;
      if (dry) return { svg: '', height, bottom: cy + height };
      let y = cy + size * (ff.capHeight / ff.upm);
      let svg = '';
      for (const l of wrapped) {
        svg += `<text x="${W / 2}" y="${Math.round(y)}" text-anchor="middle" filter="url(#softsh)" ` +
          `font-family="${f.family}" font-weight="${f.weight}"${f.style ? ` font-style="${f.style}"` : ''} font-size="${size}" ` +
          `fill="${fill}">${esc(l)}</text>`;
        y += size * lh;
      }
      return { svg, height, bottom: cy + height };
    };
    /** Parts stacked with a gap, centred on `cy`, or hung from it with anchor 'top'. */
    const softStack = (parts, cy, { anchor = 'centre', gap = 22 } = {}) => {
      const live = parts.filter((p) => (p.lines ?? []).some((l) => deEmoji(l)));
      const heights = live.map((p) => softCaption(p.lines, 0, { kind: p.kind, dry: true }).height);
      const total = heights.reduce((a, b) => a + b, 0) + gap * Math.max(0, live.length - 1);
      const top = anchor === 'top' ? cy : Math.round(cy - total / 2);
      let y = top, svg = '';
      live.forEach((p, k) => { svg += softCaption(p.lines, y, { kind: p.kind }).svg; y += heights[k] + gap; });
      return { svg, top, bottom: y - gap };
    };
    /**
     * The App Store card (four of the five app slides in the owner's 2026-09-18
     * batch: Footly twice, Inspoy twice): the store's own product card — icon,
     * name, subtitle, developer, a GET pill, and the ratings / age / category
     * row when the campaign supplies `assets.app_store` — drawn over an
     * ordinary frame at 0.66 W, never a phone on a bench and never an icon on a pill.
     */
    const appCard = (top) => {
      const st = spec.assets?.app_store ?? {};
      const title = st.title ?? spec.rules?.required_phrase ?? spec.brand ?? 'App';
      const sub = st.subtitle ?? String(spec.product ?? '').split(/,| that | which | — |:/)[0].trim();
      const dev = st.developer ?? spec.advertiser ?? '';
      const dark = (st.theme ?? 'dark') !== 'light';
      const cw = Math.round(W * 0.66), cx = Math.round((W - cw) / 2), pad = 28, ic = 116;
      const bg = dark ? '#151517' : '#FFFFFF', fg = dark ? '#FFFFFF' : '#111111', mute = dark ? '#98989F' : '#6E6E73';
      const stats = !!(st.rating || st.age || st.category);
      const ch = pad * 2 + ic + (stats ? 126 : 0);
      let s = rect(cx, top, cw, ch, { r: 30, fill: bg, op: 0.95 });
      const ix = cx + pad, iy = top + pad;
      const iconFile = spec.assets?.app_icon ? path.join(root, spec.assets.app_icon) : null;
      if (iconFile && fs.existsSync(iconFile)) s += `<g clip-path="inset(0 round 26px)">${image(iconFile, ix, iy, ic, ic)}</g>`;
      else {
        s += rect(ix, iy, ic, ic, { r: 26, fill: spec.assets?.palette?.[0] ?? '#2A6DF4' });
        s += text('phoneBold', ix + ic / 2, iy + ic / 2 + 22, (title.match(/[A-Za-z]/) ?? ['A'])[0].toUpperCase(), { size: 64, fill: '#FFFFFF', anchor: 'middle' });
      }
      const pw = 104, ph = 44;
      const tx = ix + ic + 22, tw = cw - pad * 2 - ic - 22 - pw - 16;
      const tf = loadFace(FACES.phoneSemi.file), mf = loadFace(FACES.phoneMed.file);
      const fitOne = (face, str, w, size) => { let t = String(str); while (t.length > 3 && layoutWidth(face, t, size) > w) t = t.slice(0, -2).trimEnd() + '…'; return t; };
      const tl = breakToFit(tf, title, tw, 32, { max: 2 });
      let ty = iy + 30;
      for (const l of tl) { s += text('phoneSemi', tx, ty, l, { size: 32, fill: fg }); ty += 37; }
      if (sub) { s += text('phoneMed', tx, ty + 1, fitOne(mf, sub, tw, 24), { size: 24, fill: mute }); ty += 31; }
      if (dev) s += text('phoneMed', tx, ty + 1, fitOne(mf, dev, tw, 22), { size: 22, fill: mute });
      const px = cx + cw - pad - pw, py = iy + Math.round(ic / 2 - ph / 2);
      s += rect(px, py, pw, ph, { r: 22, fill: '#0A84FF' });
      s += text('phoneBold', px + pw / 2, py + 31, st.cta ?? 'GET', { size: 23, fill: '#FFFFFF', anchor: 'middle', ls: 1 });
      if (stats) {
        const sy = iy + ic + 22;
        s += line(cx + pad, sy, cx + cw - pad, sy, { stroke: dark ? '#2C2C2E' : '#E5E5EA', sw: 2 });
        const colW = (cw - pad * 2) / 3;
        const col = (k, a, b, c) => {
          const mx = Math.round(cx + pad + colW * k + colW / 2);
          let o = text('phoneMed', mx, sy + 30, a, { size: 17, fill: mute, anchor: 'middle', ls: 1 });
          if (b) o += text('phoneBold', mx, sy + 72, b, { size: 34, fill: fg, anchor: 'middle' });
          if (typeof c === 'string') o += text(b ? 'phoneMed' : 'phoneSemi', mx, b ? sy + 100 : sy + 76, fitOne(mf, c, colW - 12, b ? 19 : 22), { size: b ? 19 : 22, fill: b ? mute : fg, anchor: 'middle' });
          else if (c) o += c(mx);
          return o;
        };
        const n = st.rating ? Math.max(1, Math.min(5, Math.round(+st.rating))) : 0;
        const stars = (mx) => { let o = ''; for (let k = 0; k < 5; k++) o += star(mx - 40 + k * 20, sy + 96, 8, k < n ? mute : (dark ? '#3A3A3C' : '#D1D1D6')); return o; };
        s += col(0, st.ratings ? `${st.ratings} RATINGS` : 'RATING', st.rating ?? '', st.rating ? stars : '');
        s += col(1, 'AGE', st.age ?? '4+', 'Years');
        s += col(2, 'CATEGORY', '', st.category ?? '');
      }
      return { svg: s, bottom: top + ch };
    };
    const base = (f) => [image(f, 0, 0, W, H), ...(soft ? [SOFT_DEFS] : [])];

    const caption = (lines, cy, { size = 40, face = 'head', fill = '#FFFFFF', lh = 1.24, boost = 0 } = {}) => {
      const key = face === 'body' ? BODY : HEAD;
      const f = FACES[key];
      const ff = loadFace(f.file);
      size = Math.round(size * SIZE * (face === 'body' ? bodyScale : headScale));
      const wrapped = lines.flatMap((l) => breakToFit(ff, l, W - M * 2 - 40, size, { max: 4 }));
      // The outline thickens on a bright ground. A single thin outline is right
      // over a dark car and disappears entirely over a sunset sky, which is
      // exactly where the first pass lost three slides.
      const sw = +(size * (OUTLINE_W + boost)).toFixed(2);
      let y = cy + size * (ff.capHeight / ff.upm);
      let svg = '';
      for (const l of wrapped) {
        const esc = String(l).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        svg += `<text x="${W / 2}" y="${Math.round(y)}" text-anchor="middle" ` +
          `font-family="${f.family}" font-weight="${f.weight}"${f.style ? ` font-style="${f.style}"` : ""} font-size="${size}" ` +
          `fill="${fill}" stroke="#000000" stroke-width="${sw}" ` +
          `stroke-linejoin="round" paint-order="stroke fill">${esc}</text>`;
        y += size * lh;
      }
      return { svg, height: wrapped.length * size * lh, bottom: cy + wrapped.length * size * lh };
    };

    /**
     * The app-icon device: rounded icon, white pill, one small line under it.
     * `tile: 'none'` draws the pill alone — a third-party app in an apps list
     * (set-01 puts Forex Factory, Meta Trader 5 and Trading View on the same
     * device as the campaign's app; we hold no icon for them, so the pill
     * carries the name and the photo does the rest).
     */
    const iconLockup = (iconFile, label, sub, top, { tile = 'icon' } = {}) => {
      const S = tile === 'none' ? 0 : Math.round(W * 0.27);
      const x = Math.round((W - S) / 2);
      let svg = '';
      if (tile === 'none') {
        // no tile: the pill sits where the icon's lower edge would be
      } else if (iconFile && fs.existsSync(path.join(root, iconFile))) {
        svg += `<g clip-path="inset(0 round ${Math.round(S * 0.225)}px)">` +
          image(path.join(root, iconFile), x, top, S, S) + '</g>';
      } else {
        // a placeholder that still reads as an app tile rather than a gap
        svg += rect(x, top, S, S, { r: Math.round(S * 0.225), fill: '#1B1F27' });
        svg += text(HEAD, W / 2, top + S / 2 + 20, (label.match(/[A-Za-z]/) ?? [''])[0].toUpperCase(),
          { size: 72, fill: '#FFFFFF', anchor: 'middle' });
      }
      // the white pill, overlapping the icon's lower edge exactly as the
      // reference does — it reads as one object rather than two stacked
      // set-01 slide 2 "4. Forex Factory" on a 25 px grid: cap height ≈ 60 px,
      // pill ≈ 100 px tall and 62 % of the width; ours was a 32 px cap (round
      // 2, 2026-09-18, docs/QUALITY.md F11)
      const pt = 76;
      const pw = Math.ceil(layoutWidth(capFace, label, pt)) + 64;
      const py = tile === 'none' ? top : top + S - Math.round(pt * 0.5);
      svg += rect(Math.round((W - pw) / 2), py, pw, pt + 28, { r: (pt + 28) / 2, fill: '#FFFFFF' });
      svg += text(HEAD, W / 2, py + pt + 4, label, { size: pt, fill: '#111111', anchor: 'middle' });
      let bottom = py + pt + 28;
      const subs = Array.isArray(sub) ? sub.filter(Boolean) : sub ? [sub] : [];
      if (subs.length) {
        const c = caption(subs, bottom + 18, { size: 32, face: 'body' });
        svg += c.svg;
        bottom = c.bottom;
      }
      return { svg, bottom };
    };

    /**
     * How much extra outline a band needs for white type to hold.
     *
     * Measured, not fixed — the same 0.045 outline that is right over a dark
     * street vanished over a sunset. Returns an addition to OUTLINE plus an
     * optional scrim when the ground is genuinely bright.
     */
    async function contrastAt(file, y, h) {
      let mean = 128;
      try {
        const r = await scoreRegion(file, { w: W, h: H, sharp, rect: { x: 0, y: Math.max(0, y), w: W, h } });
        mean = r.mean ?? 128;
      } catch { /* keep the default */ }
      // No scrim, ever — the reference holds white type over a midday sky
      // (set-01 slide 3, set-14 slide 2) with the outline alone. A bright
      // ground gets a little more outline instead.
      const over = Math.max(0, (mean - 90) / 120);
      return { boost: Math.min(0.05, over * 0.05), scrim: 0, mean };
    }

    async function frame(idOrPath, n) {
      const src = path.isAbsolute(String(idOrPath))
        ? String(idOrPath)
        : path.join(ctx.photoDir ?? root, `${idOrPath}.jpg`);
      const p = await plate(sharp, src, W, H, outDir);
      const g = await grade(p, look, { width: W, height: H });
      // De-slop the photo before the caption goes on: off-centre crop, flat
      // exposure, sensor grain in the shadows, a hard JPEG pass. The text is
      // drawn afterwards so it stays crisp. `assets.deslop` pins the strength
      // (0 turns it off); otherwise the look decides.
      const strength = spec.assets?.deslop ?? strengthFor(look);
      const d = strength > 0 ? await deslop(g, { seed: `${spec.id}:${n}:${(C.hook?.lines ?? []).join(' ')}`, width: W, height: H, strength }) : g;
      const f = path.join(outDir, `_f${n}.png`);
      fs.writeFileSync(f, d);
      return f;
    }

    const out = [];
    const total = C.ranked.length + 2;
    const numbering = C.numbering ?? 'countdown';
    // an apps list ("4 trading apps i open") puts EVERY app on the pill device
    const appsList = /\bapps?\b/i.test((C.hook?.lines ?? []).join(' ')) && C.ranked.some((r) => r.icon);

    /**
     * The quietest of a few bands for a caption block. A fixed top put the
     * hook straight over the face in every mirror selfie; the reference
     * hooks sit across the chest or the mid-frame, wherever the picture is
     * calm. Busy (range) matters more than bright — bright gets a scrim.
     */
    const quietBand = async (f, fracs, bandH) => {
      let top = Math.round(H * fracs[0]), best = Infinity;
      for (const frac of fracs) {
        const y = Math.round(H * frac);
        try {
          const r = await scoreRegion(f, { w: W, h: H, sharp, rect: { x: 0, y, w: W, h: bandH } });
          // skin barely counts: the reference puts the block across the chest
          // and the arm as often as across a wall (set-05, set-13, gym-2)
          // and the block belongs near the reference's position: top 0.33 H
          // (gym) / 0.36 H (wealth), measured 2026-09-18 — a calm ceiling at
          // 0.10 H is not where a real post puts its caption
          const cost = r.range + Math.max(0, r.mean - 110) * 0.4 + (r.skin ?? 0) * 30 + Math.abs(frac - 0.34) * 120;
          if (cost < best) { best = cost; top = y; }
        } catch { /* keep the default */ }
      }
      return top;
    };

    /* hook — one short block wherever the frame is calm, nothing else */
    if (soft) {
      // dead-centre: every hook in the 2026-09-18 batch sits at 0.41–0.53 H
      const f = await frame(C.hook.photo, 1);
      const s = base(f);
      s.push(softStack([{ lines: C.hook.lines ?? [], kind: 'hook' }, { lines: C.hook.sub ?? [], kind: 'body' }], Math.round(H * 0.50)).svg);
      out.push(s.join(''));
    } else {
      const f = await frame(C.hook.photo, 1);
      const s = base(f);
      const top = await quietBand(f, [0.24, 0.32, 0.40, 0.48], Math.round(H * 0.22));
      const { boost, scrim } = await contrastAt(f, top - 20, Math.round(H * 0.22));
      if (scrim) s.push(rect(0, Math.max(0, top - 60), W, Math.round(H * 0.32), { fill: '#000000', op: scrim }));
      const hk = caption(C.hook.lines, top, { size: 46, boost });
      s.push(hk.svg);
      if (C.hook.sub?.length) {
        // under the block, not at a fixed offset — a three-line hook in a
        // tall face ran straight through "Top five only" on gym round two
        s.push(caption(C.hook.sub, hk.bottom + 14, { size: 32, face: 'body', boost }).svg);
      }
      out.push(s.join(''));
    }

    /* body */
    // Two kinds of app slide. The PHOTOGRAPHED app (a phone on a bench, the
    // gym convention) is a bonus tip and gets no number — set 08 runs 5, 4,
    // 3, 2, PRO TIP, 1. The ICON device (the trading app-list convention) is
    // one of the ranked apps and is numbered like the rest — set-01 runs
    // "4. Forex Factory … 1. The Edge X", set-14 "1. Webull, 2. TradeLens,
    // 3. Stocktwits". Round 2 (2026-09-18) rendered 4, 3, [TradeLens App], 1.
    const rankable = C.ranked.filter((r) => !r.screen && !r.bonus && !r.card);
    let remaining = rankable.length + (C.closerRank ? 1 : 0);
    for (let i = 0; i < C.ranked.length; i++) {
      const item = C.ranked[i];
      const isBonus = !!item.screen || !!item.bonus || !!item.card;
      // a hand-numbered set uses the model's numbers and nothing else
      const hand = C.ranked.some((r) => r.rank != null);
      const rank = hand ? item.rank : isBonus ? 0 : numbering === 'countdown' ? remaining-- : rankable.length - --remaining;
      const label = (numbering === 'none' && !hand) || isBonus || !rank ? item.name : `${rank}. ${item.name}`;

      if (soft) {
        const f = await frame(item.photo, i + 2);
        const s = base(f);
        if (item.card) {
          // the App Store card high in the frame and the "Bonus" line under it
          const card = appCard(Math.round(H * 0.31));
          s.push(card.svg);
          s.push(softStack([{ lines: [label], kind: 'head' }, { lines: item.lines ?? [], kind: 'body' }], card.bottom + 84, { anchor: 'top' }).svg);
        } else {
          s.push(softStack([{ lines: [label], kind: 'head' }, { lines: item.lines ?? [], kind: 'body' }], Math.round(H * 0.50)).svg);
        }
        out.push(s.join(''));
        continue;
      }

      const appPhoto = item.screen && item.photo && path.isAbsolute(String(item.photo)) && fs.existsSync(String(item.photo)) ? String(item.photo) : null;
      if (appPhoto) {
        // The app photographed on a phone — the frame generated from the
        // screenshot (engine/art.mjs appFrame). Caption above it, verdict
        // under: "PRO TIP / Track your lifts … / stop guessing and start
        // tracking" is set 08's app slide, over a phone on the gym floor.
        const f = await frame(appPhoto, i + 2);
        const s = base(f);
        const top = await quietBand(f, [0.05, 0.09, 0.13], Math.round(H * 0.22));
        const { boost } = await contrastAt(f, top - 20, Math.round(H * 0.22));
        const hd = caption([label], top, { size: 44, boost });
        s.push(hd.svg);
        if (item.lines?.length) s.push(caption(item.lines, hd.bottom + 14, { size: 36, face: 'body', boost }).svg);
        out.push(s.join(''));
        continue;
      }
      if (item.screen) {
        // No generated frame (no AI art): contain the screenshot on a dark
        // ground rather than cover-cropping the bottom off the app.
        const src = path.join(root, item.screen);
        const meta = await sharp(src).metadata();
        const availH = Math.round(H * 0.80);
        const sw2 = Math.round(availH * (meta.width / meta.height));
        const sx = Math.round((W - sw2) / 2), sy = Math.round(H * 0.16);
        const s = [rect(0, 0, W, H, { fill: '#08090C' })];
        s.push(`<g clip-path="inset(0 round 28px)">${image(src, sx, sy, sw2, availH)}</g>`);
        // heading above the phone, the verdict line under it — the reference
        // app slide is "PRO TIP … / stop guessing and start tracking", not a
        // bare heading over a screenshot
        const hd = caption([label], Math.round(H * 0.035), { size: 44 });
        s.push(hd.svg);
        if (item.lines?.length) {
          const bl = caption(item.lines, Math.round(H * 0.16 + availH) + 18, { size: 34, face: 'body' });
          s.push(bl.svg);
        }
        out.push(s.join(''));
        continue;
      }

      const f = await frame(item.photo, i + 2);
      const s = base(f);

      if (item.icon) {
        // app-icon slide: icon + pill, no heading above it
        const lock = iconLockup(item.icon, label, (item.lines ?? [])[0], Math.round(H * 0.14));
        s.push(lock.svg);
      } else if (appsList && /^[A-Z0-9]/.test(String(item.name ?? '')) && String(item.name).trim().split(/\s+/).length <= 3) {
        // a third-party app (a proper noun of one to three words; a routine like
        // "how i actually run it" keeps the plain caption): the pill alone at
        // the reference's pill height (set-01: ≈0.40 H)
        const lock = iconLockup(null, label, item.lines ?? [], Math.round(H * 0.40), { tile: 'none' });
        s.push(lock.svg);
      } else {
        // Three candidate bands; take the quietest. A fixed 30% put the
        // MetaTrader caption straight across a wall of glowing monitors.
        const bandH = Math.round(H * 0.26);
        const top = await quietBand(f, [0.20, 0.28, 0.36, 0.44], bandH);
        const { boost, scrim } = await contrastAt(f, top - 20, bandH);
        if (scrim) {
          s.push(`<defs><linearGradient id="fs${i}" x1="0" y1="0" x2="0" y2="1">` +
            `<stop offset="0" stop-color="rgba(0,0,0,0)"/>` +
            `<stop offset="0.42" stop-color="rgba(0,0,0,${scrim.toFixed(2)})"/>` +
            `<stop offset="1" stop-color="rgba(0,0,0,0)"/></linearGradient></defs>` +
            `<rect x="0" y="${top - 90}" width="${W}" height="${Math.round(H * 0.40)}" fill="url(#fs${i})"/>`);
        }
        const head = caption([label], top, { size: 44, boost });
        s.push(head.svg);
        let y = head.bottom;
        if (item.score) {
          const sc = caption([item.score], y + 2, { size: 42, boost });
          s.push(sc.svg);
          y = sc.bottom;
        }
        if (item.lines?.length) {
          s.push(caption(item.lines, y + 22, { size: 36, face: 'body', boost }).svg);
        }
      }
      out.push(s.join(''));
    }

    /* closer */
    if (soft) {
      const f = await frame(C.closer.photo, total);
      const s = base(f);
      const closerLines = C.closerRank && C.closer.lines.length ? [`${C.closerRank}. ${C.closer.lines[0]}`, ...C.closer.lines.slice(1)] : C.closer.lines;
      const parts = [{ lines: closerLines.slice(0, 1), kind: 'head' }, { lines: closerLines.slice(1), kind: 'body' }, { lines: C.closer.cta ? [C.closer.cta] : [], kind: 'cta' }];
      if (C.closer.card) {
        const card = appCard(Math.round(H * 0.31));
        s.push(card.svg);
        s.push(softStack(parts, card.bottom + 84, { anchor: 'top' }).svg);
      } else {
        s.push(softStack(parts, Math.round(H * 0.50)).svg);
      }
      out.push(s.join(''));
    } else {
      const closerAppPhoto = C.closer.screen && C.closer.photo && path.isAbsolute(String(C.closer.photo)) && fs.existsSync(String(C.closer.photo)) ? String(C.closer.photo) : null;
      if (closerAppPhoto) {
        // the app on the closer, photographed on a phone (see the ranked app slide)
        const f = await frame(closerAppPhoto, total);
        const s = base(f);
        const top = await quietBand(f, [0.05, 0.09, 0.13], Math.round(H * 0.22));
        const { boost } = await contrastAt(f, top - 20, Math.round(H * 0.22));
        const c = caption(C.closer.lines, top, { size: 44, boost });
        s.push(c.svg);
        s.push(caption([C.closer.cta], c.bottom + 14, { size: 34, face: 'body', boost }).svg);
        out.push(s.join(''));
      } else if (C.closer.screen) {
        const s = [image(path.join(root, C.closer.screen), 0, 0, W, H)];
        s.push(rect(0, 0, W, Math.round(H * 0.20), { fill: '#000000', op: 0.6 }));
        s.push(caption(C.closer.lines, Math.round(H * 0.04), { size: 40 }).svg);
        s.push(caption([C.closer.cta], Math.round(H * 0.04) + 110, { size: 34, face: 'body' }).svg);
        out.push(s.join(''));
      } else {
        const f = await frame(C.closer.photo, total);
        const s = base(f);
        const top = await quietBand(f, [0.24, 0.34, 0.44, 0.54], Math.round(H * 0.24));
        const { boost, scrim } = await contrastAt(f, top - 20, Math.round(H * 0.24));
        if (scrim) s.push(rect(0, Math.max(0, top - 80), W, Math.round(H * 0.40), { fill: '#000000', op: scrim }));
        const closerLines = C.closerRank && C.closer.lines.length
          ? [`${C.closerRank}. ${C.closer.lines[0]}`, ...C.closer.lines.slice(1)]
          : C.closer.lines;
        const c = caption(closerLines, top, { size: 44, boost });
        s.push(c.svg);
        s.push(caption([C.closer.cta], c.bottom + 24, { size: 34, face: 'body', boost }).svg);
        out.push(s.join(''));
      }
    }

    return out;
  },
};
