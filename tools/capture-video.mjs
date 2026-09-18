// node tools/capture-video.mjs <shotsDir> <out.mp4> "<title>" "<subtitle>"  — stills → title card + 2.4 s per frame, H.264
import fs from 'node:fs'; import path from 'node:path'; import { execFileSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';
const [dir0, out, title, sub] = process.argv.slice(2); const dir = path.resolve(dir0);
const W = 1440, H = 900, HOLD = 2.4, TITLE = 2.2;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${W}' height='${H}'><rect width='${W}' height='${H}' fill='#F7F6F2'/>
<g transform='translate(120,300) scale(1.3)'><rect x='0' y='21' width='55' height='39' rx='7' fill='#D9D7D1'/><rect x='14' y='12' width='55' height='39' rx='7' fill='#8E8D89'/><rect x='31' y='2' width='55' height='39' rx='7' fill='#0E0E10'/></g>
<text x='120' y='470' font-family='Archivo' font-weight='700' font-size='72' fill='#151517' letter-spacing='-2'>${esc(title)}</text>
<text x='122' y='530' font-family='Manrope' font-weight='500' font-size='28' fill='#5B5B60'>${esc(sub)}</text>
<text x='120' y='800' font-family='Manrope' font-weight='600' font-size='20' fill='#8A8A90'>the futureclips, walkthrough, ${new Date().toISOString().slice(0, 10)}</text></svg>`;
const fontFiles = fs.readdirSync('assets/fonts').filter((f) => /^(Archivo-Bold|Manrope)/.test(f)).map((f) => path.join('assets/fonts', f));
fs.writeFileSync(path.join(dir, '00-title.png'), new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Archivo' } }).render().asPng());
const frames = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.png$/.test(f)).sort().map((f) => path.join(dir, f));
const q = (f) => `'${f.replace(/'/g, "'\\''")}'`;
fs.writeFileSync(path.join(dir, 'list.txt'), frames.map((f, i) => `file ${q(f)}\nduration ${i === 0 ? TITLE : HOLD}`).join('\n') + `\nfile ${q(frames.at(-1))}\n`);
const total = TITLE + HOLD * (frames.length - 1);
const vf = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=#F7F6F2,format=yuv420p,fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 0.6).toFixed(2)}:d=0.6`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', vf, '-r', '30', '-c:v', 'libx264', '-crf', '20', '-preset', 'medium', '-movflags', '+faststart', out]);
console.log(path.basename(out), `${frames.length} frames, ${total.toFixed(1)} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
