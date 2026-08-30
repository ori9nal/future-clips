import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLIDES, SIGNALS, CAMPAIGN } from './teach.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IMG = path.join(ROOT, 'output/atlas/teach');
const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(IMG, f)).toString('base64')}`;

const NOTES = [
  'The hook. One claim, and the person who will carry the next five frames.',
  'Grip is the signal, so the frame is the one where his forearms are lit and everything else is dark.',
  'The solver moved the type to the left here — the set alternates rather than parking every headline in the same corner.',
  'Type sits in the black above his shoulder. The scrim strength is computed from what is actually behind the words.',
  'Same man, same light, sixth frame. No generation was involved in keeping him the same.',
];

const html = `<title>You Are Not Overtrained</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
:root{
  --ground:#0B0A0A; --surface:#141210; --line:#2A2622;
  --text:#F0EBE5; --muted:#8C8177; --accent:#BCA89F;
}
:root[data-theme="light"]{
  --ground:#F2EFEA; --surface:#FFFFFF; --line:#DBD4CB;
  --text:#141210; --muted:#6B6159; --accent:#8A6A57;
}
@media (prefers-color-scheme:light){
  :root:not([data-theme="dark"]){
    --ground:#F2EFEA; --surface:#FFFFFF; --line:#DBD4CB;
    --text:#141210; --muted:#6B6159; --accent:#8A6A57;
  }
}
*{box-sizing:border-box}
body{
  margin:0;background:var(--ground);color:var(--text);
  font-family:"Archivo",system-ui,-apple-system,"Segoe UI",sans-serif;
  font-variation-settings:"wdth" 100,"wght" 420;line-height:1.55;-webkit-font-smoothing:antialiased;
}
.wrap{max-width:1160px;margin:0 auto;padding:clamp(2.4rem,6vw,5rem) clamp(1.1rem,4vw,2.4rem) 5rem}
.eyebrow{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.7rem;font-weight:700;
  letter-spacing:.24em;text-transform:uppercase;color:var(--accent);margin:0 0 1rem}
h1{font-variation-settings:"wdth" 64,"wght" 900;font-size:clamp(3rem,10.5vw,6.6rem);line-height:.88;
  letter-spacing:-.01em;margin:0 0 1.3rem;text-transform:uppercase;text-wrap:balance}
.standfirst{font-size:clamp(1.02rem,2vw,1.26rem);color:var(--muted);max-width:58ch;margin:0 0 2.2rem}
.standfirst strong{color:var(--text);font-variation-settings:"wdth" 100,"wght" 640}
.facts{display:flex;flex-wrap:wrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  margin-bottom:clamp(2.6rem,6vw,4rem)}
.fact{flex:1 1 140px;padding:1rem 1.2rem 1rem 0;border-right:1px solid var(--line)}
.fact:last-child{border-right:0}
.fact dt{font-family:"JetBrains Mono",monospace;font-size:.64rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--muted);margin:0 0 .3rem}
.fact dd{margin:0;font-variation-settings:"wdth" 86,"wght" 700;font-size:1.42rem;font-variant-numeric:tabular-nums}
h2{font-variation-settings:"wdth" 72,"wght" 860;text-transform:uppercase;font-size:clamp(1.6rem,3.8vw,2.4rem);
  line-height:1;margin:0 0 .5rem}
.sectnote{color:var(--muted);max-width:62ch;margin:0 0 1.6rem}
section{margin-bottom:clamp(3.2rem,7vw,5rem)}
.swipe{font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);margin:0 0 1.2rem}
.strip{display:flex;gap:clamp(.9rem,2.2vw,1.7rem);overflow-x:auto;scroll-snap-type:x mandatory;
  padding:.4rem 0 1.5rem;margin:0 calc(-1 * clamp(1.1rem,4vw,2.4rem));
  padding-left:clamp(1.1rem,4vw,2.4rem);padding-right:clamp(1.1rem,4vw,2.4rem);scrollbar-width:thin}
.card{flex:0 0 min(74vw,372px);scroll-snap-align:center}
.card figure{margin:0}
.card img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;border-radius:5px;background:#000}
.card figcaption{padding-top:.9rem}
.num{font-family:"JetBrains Mono",monospace;font-size:.66rem;font-weight:700;letter-spacing:.16em;
  color:var(--accent);display:block;margin-bottom:.25rem}
.card p{margin:0;color:var(--muted);font-size:.88rem;line-height:1.5}
.checks{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}
.checks li{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:.9rem 1.8rem;padding:1.1rem 0;
  border-bottom:1px solid var(--line);align-items:start}
.checks b{font-variation-settings:"wdth" 100,"wght" 700;font-size:.94rem}
.checks span{color:var(--muted);font-size:.9rem;max-width:66ch}
@media (max-width:560px){.checks li{grid-template-columns:1fr;gap:.25rem}}
.pal{display:flex;flex-wrap:wrap;gap:.8rem;margin:0 0 1.4rem;padding:0;list-style:none}
.pal li{display:flex;align-items:center;gap:.6rem;font-family:"JetBrains Mono",monospace;font-size:.74rem;color:var(--muted)}
.sw{width:34px;height:34px;border-radius:4px;border:1px solid var(--line)}
footer{border-top:1px solid var(--line);padding-top:1.3rem;color:var(--muted);
  font-family:"JetBrains Mono",monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;
  display:flex;flex-wrap:wrap;gap:.5rem 1.6rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <p class="eyebrow">${CAMPAIGN.brand} — teaching carousel</p>
  <h1>You are not overtrained</h1>
  <p class="standfirst"><strong>One man, six frames, from slide one.</strong> The teaching is carried in type beside him — no charts, no drawn objects, no diagrams. The body holds attention; the words do the work.</p>

  <dl class="facts">
    <div class="fact"><dt>Slides</dt><dd>6</dd></div>
    <div class="fact"><dt>Model</dt><dd>1</dd></div>
    <div class="fact"><dt>Signals taught</dt><dd>${SIGNALS.length}</dd></div>
    <div class="fact"><dt>Images generated</dt><dd>0</dd></div>
    <div class="fact"><dt>Asset cost</dt><dd>$0</dd></div>
  </dl>

  <section>
    <h2>The set</h2>
    <p class="sectnote">Swipe it the way it is read.</p>
    <p class="swipe">← swipe / scroll →</p>
    <div class="strip">
      ${SLIDES.map((s, i) => `<article class="card"><figure>
        <img src="${b64(`w-${i + 1}.jpg`)}" alt="Slide ${i + 1}: ${s.head.join(' ')}">
        <figcaption><span class="num">${String(i + 1).padStart(2, '0')} / 06</span>
          <p>${NOTES[i] || ''}</p></figcaption></figure></article>`).join('\n      ')}
    </div>
  </section>

  <section>
    <h2>Why he is the same man on every frame</h2>
    <p class="sectnote">Character consistency is what makes this format work and the hardest thing to fake with an image model — a fixed seed freezes the pose, a varying seed drifts the face. It is not faked here. These are six frames from a single studio session by one photographer, so the light, the backdrop and the face are identical across the set because they were shot that way. Free, and licensed for commercial use.</p>
    <ul class="pal">
      <li><span class="sw" style="background:#0B0A0A"></span>#0B0A0A backdrop</li>
      <li><span class="sw" style="background:#1E1413"></span>#1E1413 lit skin</li>
      <li><span class="sw" style="background:#BCA89F"></span>#BCA89F specular</li>
      <li><span class="sw" style="background:#F0EBE5"></span>#F0EBE5 type</li>
    </ul>
    <p class="sectnote">The palette is sampled from the photographs rather than chosen. The one accent is the specular highlight measured off lit skin — a warm stone, because that is the colour actually in the frame.</p>
  </section>

  <section>
    <h2>What decides where the words go</h2>
    <ul class="checks">
      <li><b>Negative-space solver</b><span>Candidate boxes are scored on mean brightness plus p95 — a box that is 90% black with one lit forearm through it scores well on the mean and reads terribly, so the p95 is weighted heavily. Type is then laid into the emptiest box the copy actually fits, falling through in score order.</span></li>
      <li><b>Alternation penalty</b><span>A box pays a penalty for being chosen two slides running, so the set alternates sides instead of parking every headline in the same corner.</span></li>
      <li><b>Derived scrim</b><span>Darkening strength is computed from what is behind the words. A full-width band gets a band-shaped scrim, not a radial one — the radial fell off before the end of the line and left the last words on a lit shoulder.</span></li>
      <li><b>Headline floor</b><span>A box that can only fit the headline by shrinking it under 66px is rejected. A headline squeezed to fit any gap is not a headline.</span></li>
      <li><b>Measured word-spacing</b><span>The extra-condensed black has a very narrow space glyph — "TOP SET" closed up into one word. Word-spacing fixes it and the fitter reserves 5% for the width it adds.</span></li>
      <li><b>Derived counts</b><span>The hook says three signals and the closer says all three because both read <code>SIGNALS.length</code>. Adding a fourth signal rewrites both lines.</span></li>
    </ul>
  </section>

  <footer>
    <span>${CAMPAIGN.brand} · ${CAMPAIGN.handle}</span>
    <span>${CAMPAIGN.credit}</span>
    <span>Fictional campaign</span>
  </footer>
</div>
`;

const out = path.join(ROOT, 'design/atlas/atlas-teaching.html');
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB');
