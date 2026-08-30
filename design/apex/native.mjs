// APEX — the native gym set.
//
// Built to the format the gym niche actually runs, taken from the reference
// carousels: 9:16, full-bleed photography off one person's camera roll, and
// white bold sans with a heavy black stroke sitting straight on top. A ranked
// countdown so the swipe pays off at the end, and one slide that is nothing but
// the app's own screen at full bleed — the campaign brief requires it and the
// reference sets do exactly that.
//
// The point of the format is that it does NOT look designed. Everything I built
// before this looked like a magazine ad, which reads as an ad and gets scrolled.
// So: no colour blocks, no grid, no editorial typography, no collage. The only
// craft that shows is that the captions never land on a face and never overrun.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { loadFace } from '../../engine/fonts.mjs';
import { layoutWidth } from '../../engine/fit-text.mjs';
import { captionBlock, captionBands } from '../../engine/caption.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOOT = path.join(ROOT, 'output/gym/1389931');
const OUT = path.join(ROOT, 'output/apex');

export const W = 1080, H = 1920;   // 9:16, per the campaign brief

export const CAMPAIGN = JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns/apex-strength.json'), 'utf8'));

const CAP = { file: 'Poppins-Bold', family: 'Poppins', weight: 700 };

/* ── the ranked payload ─────────────────────────────────────────────────── */

// One array. The hook counts it, the countdown numbers come from it, and the
// closing line references it — so a fifth entry rewrites all three.
export const RANKED = [
  {
    photo: 30165246,
    name: 'Chasing soreness',
    score: '2/10',
    lines: ['Sore means you did something new.', 'It does not mean it worked.'],
  },
  {
    photo: 30165252,
    name: 'Adding more exercises',
    score: '4/10',
    lines: ['Six movements you half-finish', 'beat nothing. Three you finish', 'beat all six.'],
  },
  {
    photo: 30165250,
    name: 'Sleeping eight hours',
    score: '9/10',
    lines: ['The most boring one on here', 'and the only one I noticed', 'within a week.'],
  },
  {
    photo: 30165251,
    name: 'Writing every set down',
    score: '10/10',
    lines: ['I thought I was progressing', 'for two years. I was repeating', 'the same three sessions.'],
  },
];

const WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'];

export const HOOK = {
  photo: 30165254,
  lines: [`${WORD[RANKED.length].toUpperCase()} THINGS THAT`, 'ACTUALLY MOVED', 'MY LIFTS'],
  sub: ['ranked worst to best'],
};

/* ── rendering ──────────────────────────────────────────────────────────── */

const FONT_FILES = [
  path.join(ROOT, 'assets/fonts/Poppins-Bold.ttf'),
  path.join(ROOT, 'assets/fonts/Poppins-SemiBold.ttf'),
  path.join(ROOT, 'assets/fonts/JetBrainsMono-Bold.ttf'),
];

async function plate(file) {
  const out = path.join(OUT, `_p${path.basename(file, '.jpg')}.png`);
  await sharp(file).resize(W, H, { fit: 'cover', position: sharp.strategy.attention }).png().toFile(out);
  return out;
}

const img = (f) => `<image href="data:image/png;base64,${fs.readFileSync(f).toString('base64')}" x="0" y="0" width="${W}" height="${H}"/>`;

/**
 * Place a caption in the quietest band inside a vertical zone, falling through
 * bands until the copy fits. A fixed y lands on a face the moment the next
 * photo is framed differently.
 */
async function placeCaption(plateFile, lines, { zone, max, min, avoid = [] }) {
  const face = loadFace(CAP.file);
  const bands = (await captionBands(plateFile, { w: W, h: H, sharp, bands: 9, avoid }))
    .filter((b) => b.y >= zone[0] && b.y + b.h <= zone[1]);
  const pool = bands.length ? bands : [{ x: 64, y: zone[0], w: W - 128, h: zone[1] - zone[0] }];
  for (const b of pool) {
    const box = { x: b.x, y: b.y, w: b.w, h: Math.max(b.h, zone[1] - b.y) };
    try {
      const c = captionBlock(face, lines, box, { family: CAP.family, weight: CAP.weight, max, min });
      return { ...c, box: { x: box.x, y: b.y, w: box.w, h: c.height } };
    } catch { /* next band */ }
  }
  throw new Error(`caption fits no band: ${lines.join(' / ')}`);
}

async function hookSlide() {
  const p = await plate(path.join(SHOOT, `${HOOK.photo}.jpg`));
  const s = [img(p)];
  const title = await placeCaption(p, HOOK.lines, { zone: [H * 0.10, H * 0.56], max: 104, min: 62 });
  s.push(title.svg);
  // The subline belongs directly under the title, not wherever the picture
  // happens to be quietest — searching for it independently floated it down
  // onto the model's face.
  const face = loadFace(CAP.file);
  const sub = captionBlock(face, HOOK.sub,
    { x: title.box.x, y: title.box.y + title.height + 14, w: title.box.w, h: 130 },
    { family: CAP.family, weight: CAP.weight, max: 50, min: 32 });
  s.push(sub.svg);
  return s.join('');
}

async function rankSlide(item, rank) {
  const p = await plate(path.join(SHOOT, `${item.photo}.jpg`));
  const s = [img(p)];
  const title = await placeCaption(p, [`${rank}. ${item.name}`, item.score], { zone: [H * 0.10, H * 0.52], max: 84, min: 50 });
  s.push(title.svg);
  const body = await placeCaption(p, item.lines, {
    zone: [Math.max(title.box.y + title.height + 40, H * 0.56), H * 0.92], max: 60, min: 36, avoid: [title.box],
  });
  s.push(body.svg);
  return s.join('');
}

async function appSlide() {
  const screen = path.join(OUT, 'app-progress.png');
  const s = [img(screen)];
  const face = loadFace(CAP.file);
  // The screenshot is the payload, so the caption goes where the app UI is
  // quiet — over the empty band under the tier chips, not across the data.
  // Placed by the same band solver as the photo slides, not by a hardcoded y.
  // The first version parked this caption straight across a data row.
  const c = await placeCaption(screen, ['Two years of guessing.', 'Twelve months of writing it down.'],
    { zone: [H * 0.78, H * 0.94], max: 56, min: 34 });
  s.push(c.svg);
  const cta = captionBlock(face, [`Follow ${CAMPAIGN.requirements.required_mention}`],
    { x: 90, y: c.box.y + c.height + 16, w: W - 180, h: 110 },
    { family: CAP.family, weight: CAP.weight, max: 46, min: 30 });
  s.push(cta.svg);
  return s.join('');
}

function png(body, file) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  fs.writeFileSync(file, new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false, defaultFontFamily: 'Poppins', fontFiles: FONT_FILES },
  }).render().asPng());
  return file;
}

/** Silent fallback renders at a width the fitter never approved. */
export async function preflightFonts(tolerance = 0.05) {
  const probe = 'HAMBURGEFONSTIV 1234';
  const face = loadFace(CAP.file);
  const expected = layoutWidth(face, probe, 100);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="300"><rect width="4000" height="300" fill="#fff"/>` +
    `<text x="20" y="200" font-family="${CAP.family}" font-weight="${CAP.weight}" font-size="100" fill="#000">${probe}</text></svg>`;
  const buf = new Resvg(svg, { font: { loadSystemFonts: false, defaultFontFamily: 'Poppins', fontFiles: FONT_FILES } }).render().asPng();
  const { data, info } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, maxX = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] < 128) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
  }
  const drift = Math.abs((maxX - minX) - expected) / expected;
  if (drift > tolerance) throw new Error(`font fallback: "${CAP.family}" ${CAP.weight} off by ${(drift * 100).toFixed(0)}%`);
}

export const COPY = {
  campaign: { rules: CAMPAIGN.rules, ...CAMPAIGN.requirements },
  slides: [
    { headline: HOOK.lines.join(' '), body: HOOK.sub.join(' ') },
    ...RANKED.map((r, i) => ({ headline: `${RANKED.length - i}. ${r.name} ${r.score}`, body: r.lines.join(' ') })),
    { headline: 'Two years of guessing. Twelve months of writing it down.', body: 'Follow @apex.strength' },
  ],
};

export async function build() {
  fs.mkdirSync(OUT, { recursive: true });
  await preflightFonts();
  const made = [];
  made.push(png(await hookSlide(), path.join(OUT, 'slide-1.png')));
  for (let i = 0; i < RANKED.length; i++) {
    made.push(png(await rankSlide(RANKED[i], RANKED.length - i), path.join(OUT, `slide-${i + 2}.png`)));
  }
  made.push(png(await appSlide(), path.join(OUT, `slide-${RANKED.length + 2}.png`)));
  return made;
}

if (process.argv[1] && process.argv[1].endsWith('native.mjs')) {
  build().then((f) => console.log(f.map((x) => path.basename(x)).join('  ')))
    .catch((e) => { console.error(e.message); process.exit(1); });
}
