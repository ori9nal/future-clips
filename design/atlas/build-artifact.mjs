// Assemble the campaign into a single self-contained page.
//
// A carousel should be presented as a carousel: the slides live in a horizontal
// snap track you swipe, at feed proportion, so the set is judged the way it will
// actually be seen rather than as a grid of posters.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPAIGN, CUTS, RESULTS } from './campaign.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IMG = path.join(ROOT, 'output/atlas/campaign');
const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(IMG, f)).toString('base64')}`;

const SLIDES = [
  ['The hook', 'A contrarian claim with a number behind it. The phone is the same object on every slide from here.'],
  ['The problem', 'A colour field breaks the rhythm. Readiness for the seven days ending today — not a calendar week, which would claim to know Friday.'],
  ['The mechanism', 'Callouts are projected through the same homography that painted the screen, so each one points at the element it names.'],
  ['The block', `Orange is spent on the ${CUTS} cut sessions, not the majority that ran in full. The headline's number is counted from the grid.`],
  ['The result', 'Bar length is derived from the value. A 12 kg gain looks like a 12 kg gain; the delta chip carries the punch instead.'],
  ['The ask', 'Three steps and one handle. The diagonal sits below every line of copy so nothing crosses onto a ground it cannot be read on.'],
];

const CHECKS = [
  ['Font preflight', 'Rasterise a probe in every family and compare its ink width to the loaded TTF. Catches silent fallback — which had been rendering headlines 40% wider than the fitter allowed.'],
  ['Fit contract', 'Every headline and paragraph is sized by binary search against real advance widths and kern pairs. Copy that will not fit throws instead of overflowing.'],
  ['Overflow assertion', 'Stacked blocks assert their final baseline clears the page furniture. Caught the results slide sitting 10px under its own page number.'],
  ['Derived figures', 'Chart geometry and the numbers in the copy read from the same arrays, so a headline cannot drift from the grid beneath it.'],
  ['Logic check', 'Gap-closing hooks, cross-slide numeric contradictions, banned claims, missing CTA verb, missing required mention. Free, deterministic, runs before any paid call.'],
];

const html = `<title>It Deleted My Leg Day</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
:root{
  --ground:#F1EFEB; --surface:#FFFFFF; --sunk:#E6E3DE; --line:#D3CFC8;
  --text:#14161A; --muted:#5E646C; --accent:#D9530A; --accent-soft:rgba(217,83,10,.10);
  --shadow:0 1px 2px rgba(20,22,26,.06),0 12px 32px rgba(20,22,26,.10);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#0C0D10; --surface:#15171B; --sunk:#101216; --line:#252A31;
    --text:#E9E7E3; --muted:#8A9099; --accent:#FF6A1A; --accent-soft:rgba(255,106,26,.13);
    --shadow:0 1px 2px rgba(0,0,0,.5),0 18px 48px rgba(0,0,0,.55);
  }
}
:root[data-theme="dark"]{
  --ground:#0C0D10; --surface:#15171B; --sunk:#101216; --line:#252A31;
  --text:#E9E7E3; --muted:#8A9099; --accent:#FF6A1A; --accent-soft:rgba(255,106,26,.13);
  --shadow:0 1px 2px rgba(0,0,0,.5),0 18px 48px rgba(0,0,0,.55);
}
*{box-sizing:border-box}
body{
  margin:0; background:var(--ground); color:var(--text);
  font-family:"Archivo",system-ui,-apple-system,"Segoe UI",sans-serif;
  font-variation-settings:"wdth" 100,"wght" 420;
  line-height:1.55; -webkit-font-smoothing:antialiased;
}
.wrap{max-width:1180px;margin:0 auto;padding:clamp(2.5rem,6vw,5.5rem) clamp(1.1rem,4vw,2.5rem) 6rem}
.eyebrow{
  font-family:"JetBrains Mono",ui-monospace,monospace; font-size:.72rem; font-weight:700;
  letter-spacing:.22em; text-transform:uppercase; color:var(--accent); margin:0 0 1.1rem;
}
h1{
  font-variation-settings:"wdth" 68,"wght" 900;
  font-size:clamp(3.1rem,11vw,7rem); line-height:.88; letter-spacing:-.015em;
  margin:0 0 1.4rem; text-transform:uppercase; text-wrap:balance;
}
.standfirst{font-size:clamp(1.05rem,2.1vw,1.3rem);color:var(--muted);max-width:56ch;margin:0 0 2.4rem}
.standfirst strong{color:var(--text);font-variation-settings:"wdth" 100,"wght" 620}

.facts{
  display:flex;flex-wrap:wrap;gap:0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  margin-bottom:clamp(3rem,7vw,5rem);
}
.fact{flex:1 1 150px;padding:1.1rem 1.3rem 1.1rem 0;border-right:1px solid var(--line)}
.fact:last-child{border-right:0}
.fact dt{
  font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--muted);margin:0 0 .35rem;
}
.fact dd{margin:0;font-variation-settings:"wdth" 88,"wght" 700;font-size:1.5rem;font-variant-numeric:tabular-nums}

h2{
  font-variation-settings:"wdth" 74,"wght" 850;text-transform:uppercase;
  font-size:clamp(1.7rem,4vw,2.6rem);line-height:1;letter-spacing:-.01em;margin:0 0 .6rem;
}
.sectnote{color:var(--muted);max-width:62ch;margin:0 0 1.8rem}
section{margin-bottom:clamp(3.5rem,8vw,6rem)}

/* the carousel, presented as one */
.strip{
  display:flex;gap:clamp(1rem,2.4vw,1.9rem);overflow-x:auto;scroll-snap-type:x mandatory;
  padding:.5rem .25rem 1.6rem;margin:0 calc(-1 * clamp(1.1rem,4vw,2.5rem));
  padding-left:clamp(1.1rem,4vw,2.5rem);padding-right:clamp(1.1rem,4vw,2.5rem);
  scrollbar-width:thin;
}
.card{flex:0 0 min(76vw,388px);scroll-snap-align:center}
.card figure{margin:0}
.card img{
  width:100%;aspect-ratio:4/5;object-fit:cover;display:block;border-radius:6px;
  background:var(--sunk);box-shadow:var(--shadow);
}
.card figcaption{padding-top:1rem}
.num{
  font-family:"JetBrains Mono",monospace;font-size:.68rem;font-weight:700;letter-spacing:.16em;
  color:var(--accent);display:block;margin-bottom:.3rem;
}
.card h3{margin:0 0 .35rem;font-size:1.06rem;font-variation-settings:"wdth" 100,"wght" 700}
.card p{margin:0;color:var(--muted);font-size:.9rem;line-height:1.5}
.swipe{
  font-family:"JetBrains Mono",monospace;font-size:.68rem;letter-spacing:.16em;
  text-transform:uppercase;color:var(--muted);margin:0 0 1.4rem;
}

/* the making-of */
.chain{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:clamp(1rem,2.5vw,2rem)}
.step{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:1rem;display:flex;flex-direction:column;gap:.9rem}
.step img{width:100%;display:block;border-radius:4px;background:var(--sunk);object-fit:contain;max-height:420px}
.step .num{margin:0}
.step h3{margin:0;font-size:1rem;font-variation-settings:"wdth" 100,"wght" 700}
.step p{margin:0;color:var(--muted);font-size:.88rem;line-height:1.5}

/* checks */
.checks{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}
.checks li{
  display:grid;grid-template-columns:minmax(150px,210px) 1fr;gap:1rem 1.8rem;
  padding:1.15rem 0;border-bottom:1px solid var(--line);align-items:start;
}
.checks b{font-variation-settings:"wdth" 100,"wght" 700;font-size:.95rem}
.checks span{color:var(--muted);font-size:.92rem;max-width:66ch}
@media (max-width:560px){.checks li{grid-template-columns:1fr;gap:.3rem}}

.caveat{
  border-left:3px solid var(--accent);background:var(--accent-soft);
  padding:1.1rem 1.3rem;border-radius:0 6px 6px 0;max-width:70ch;
}
.caveat p{margin:0 0 .6rem;font-size:.95rem}
.caveat p:last-child{margin:0}
.caveat b{font-variation-settings:"wdth" 100,"wght" 700}
footer{
  border-top:1px solid var(--line);padding-top:1.4rem;color:var(--muted);
  font-family:"JetBrains Mono",monospace;font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;
  display:flex;flex-wrap:wrap;gap:.6rem 1.6rem;
}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <p class="eyebrow">Campaign — ${CAMPAIGN.brand}, ${CAMPAIGN.product}</p>
  <h1>It deleted my leg&nbsp;day</h1>
  <p class="standfirst">Six slides for a clipper campaign. <strong>One photograph carries the set</strong> — a real phone in a real gym, with the app composited into the glass through the plane's own perspective, so the same object appears on four of the six frames.</p>

  <dl class="facts">
    <div class="fact"><dt>Slides</dt><dd>6</dd></div>
    <div class="fact"><dt>Frame</dt><dd>1080×1350</dd></div>
    <div class="fact"><dt>Photographs</dt><dd>1</dd></div>
    <div class="fact"><dt>Sessions cut</dt><dd>${CUTS}</dd></div>
    <div class="fact"><dt>Squat, wk 1→6</dt><dd>${RESULTS[0].before}→${RESULTS[0].after}</dd></div>
  </dl>

  <section>
    <h2>The set</h2>
    <p class="sectnote">Presented the way it is read — swipe through it.</p>
    <p class="swipe">← swipe / scroll →</p>
    <div class="strip">
      ${SLIDES.map(([title, note], i) => `<article class="card"><figure>
        <img src="${b64(`w-slide-${i + 1}.jpg`)}" alt="Slide ${i + 1}: ${title}">
        <figcaption><span class="num">${String(i + 1).padStart(2, '0')} / 06</span>
          <h3>${title}</h3><p>${note}</p></figcaption>
      </figure></article>`).join('\n      ')}
    </div>
  </section>

  <section>
    <h2>How the phone was made</h2>
    <p class="sectnote">A screenshot pasted flat onto a photo reads as a sticker, because a phone in the hand is a plane under perspective. These three files are the whole trick.</p>
    <div class="chain">
      <div class="step">
        <span class="num">01 — Drawn</span>
        <img src="${b64('w-screen.jpg')}" alt="The Atlas app screen, rendered flat at phone resolution">
        <h3>The app screen</h3>
        <p>Rendered at 900×1950 from the same font files as the slides. The accent is sampled from the rim light in the photograph, so the glow on the glass and the glow in the room match.</p>
      </div>
      <div class="step">
        <span class="num">02 — Generated</span>
        <img src="${b64('w-photo.jpg')}" alt="Photograph of a hand holding a phone with a blank screen in a dark gym">
        <h3>The photograph</h3>
        <p>Generated with a deliberately blank screen. Two other attempts were rejected — one turned the phone into a glowing egg, the other had no phone at all.</p>
      </div>
      <div class="step">
        <span class="num">03 — Composited</span>
        <img src="${b64('w-composite.jpg')}" alt="The app screen warped into the phone in the photograph">
        <h3>The composite</h3>
        <p>The UI is mapped through the homography taking the unit square to the screen's four corners, then the photo's own specular highlight is put back on top — neutral, and damped where the pixel is saturated, or the original screen bleeds through as a coloured smear.</p>
      </div>
    </div>
  </section>

  <section>
    <h2>What the build refuses to ship</h2>
    <p class="sectnote">Each of these exists because it caught something in this set.</p>
    <ul class="checks">
      ${CHECKS.map(([name, note]) => `<li><b>${name}</b><span>${note}</span></li>`).join('\n      ')}
    </ul>
  </section>

  <section>
    <div class="caveat">
      <p><b>Where this is honest about its limits.</b> The imagery comes from a keyless free endpoint, which cannot hold a character across generations — so there is no recurring mascot and no person in frame. That is the ceiling on this set, not a stylistic choice.</p>
      <p>The vision judge is written and wired but unrun: it needs an Anthropic key. The deterministic half of it — the logic checks above — runs free and passes.</p>
    </div>
  </section>

  <footer>
    <span>${CAMPAIGN.brand} · ${CAMPAIGN.handle}</span>
    <span>Fictional campaign, built as a production test</span>
  </footer>
</div>
`;

const out = path.join(ROOT, 'design/atlas/atlas-campaign.html');
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB');
