// Does fitText's model agree with what satori/resvg actually paints?
// Renders single lines into a known box and measures the real ink bbox.
// Any positive error (rendered wider/taller than modelled) is a shipped-overflow risk.
import sharp from 'sharp';
import { resolveFace } from '../engine/fonts.mjs';
import { measureLine, layoutWidth, fitText } from '../engine/fit-text.mjs';
import { renderVectorLayer } from '../engine/render-type.mjs';

const W = 1080, H = 400, PAD = 40;

async function inkBox(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  let minX = w, maxX = -1, minY = h, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * c + 3] > 24) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

const CASES = [
  ['display-editorial', 400, 'normal', 'lazy habits that make athletes', 0],
  ['display-editorial', 400, 'italic', 'unstoppable', 0],
  ['display-heavy', 400, 'normal', 'HIT EVERY MUSCLE', 0],
  ['display-heavy', 400, 'normal', 'FOLLOW FOR MORE', -0.01],
  ['display-block', 900, 'normal', 'One product. Six perspectives.', -0.02],
  ['display-sport', 800, 'italic', 'side effects of', -0.03],
  ['display-sport', 800, 'italic', 'running', -0.03],
  ['body', 400, 'normal', 'Chasing new workouts feels productive. It is not.', 0],
  ['body', 700, 'normal', 'The pull toward you', 0],
  ['mono', 500, 'normal', '3. The 2x Investing Rule', 0.02],
  ['mono', 400, 'normal', 'For every $1 you spend on a luxury, invest $1.', 0],
  ['body', 600, 'normal', 'SAVE THIS FOR LATER', 0.18],
];

let worstW = -1e9, worstH = -1e9, rows = [];
for (const [role, weight, style, text, tracking] of CASES) {
  for (const size of [28, 56, 96, 148]) {
    const face = resolveFace(role, weight, style);
    const lsPx = tracking * size;
    const modelW = layoutWidth(face, text, size, lsPx);
    if (modelW > W - 2 * PAD) continue;
    const fit = { size, lines: [text], lineHeight: 1.0, trackingPx: lsPx };
    const { png } = await renderVectorLayer({
      width: W, height: H,
      blocks: [{ x: PAD, y: PAD, w: W - 2 * PAD, h: H - 2 * PAD, align: 'left', valign: 'top', fit, face, color: '#000' }],
    });
    const ink = await inkBox(png);
    if (!ink) { rows.push([role, size, text.slice(0, 18), 'NO INK']); continue; }
    // ink starts at the left bearing, so compare right edge against the modelled advance
    const renderedRight = ink.x + ink.w - PAD;
    const dW = renderedRight - modelW;
    const dH = ink.h - size * 1.0;             // ink height vs em box (usually negative)
    worstW = Math.max(worstW, dW);
    worstH = Math.max(worstH, dH);
    rows.push([`${role}/${weight}${style === 'italic' ? 'i' : ''}`, size, text.slice(0, 22),
      modelW.toFixed(1), renderedRight.toFixed(1), dW.toFixed(1), (100 * dW / modelW).toFixed(2) + '%']);
  }
}
console.log(['face', 'size', 'text', 'model_w', 'render_w', 'delta', 'delta%'].map(s => String(s).padEnd(12)).join(''));
for (const r of rows) console.log(r.map(s => String(s).padEnd(12)).join(''));
console.log(`\nworst width overshoot : ${worstW.toFixed(2)} px  (positive = renders WIDER than modelled)`);
console.log(`worst ink-height over em: ${worstH.toFixed(2)} px`);
console.log(worstW <= 1.0 ? '\nPASS — model is conservative or exact.' : '\nFAIL — model under-measures; fitText would ship overflow.');
