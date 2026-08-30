import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPAIGN, MISSED, C } from './campaign.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IMG = path.join(ROOT, 'output/noon');
const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(IMG, f)).toString('base64')}`;

const SLIDES = [
  ['Sun yellow', 'Type left, a hard-cut circle bleeding off the right. The hook is an offer with a number in it.'],
  ['Paper', 'The dot fields are the data: 128 dots against 32, so the picture cannot say something the caption does not.'],
  ['Electric blue', 'An arch crop and a 460px serif numeral. Nothing else on the slide is built this way.'],
  ['Hot pink', 'One centred dial. The ring is the two-hour reapply window; the arcs are the only two water-resistance ratings a label may carry.'],
  ['Mint', 'A labelled photograph. Pins are read off the real crop and rotated with it — and the one thing not in frame is stated, not pointed at.'],
  ['Ink + yellow', 'A split. Wordmark, three rules, one handle.'],
];

const GUARDS = [
  ['Glyph coverage', 'Every string is checked against its own face before it renders. Instrument Serif has no superscript two, and one missing glyph makes resvg fall the entire run back to the default family — so "2 mg/cm²" quietly set in the grotesque beside its serif sibling.'],
  ['Overlap assertion', 'Text boxes assert they are clear of the elements around them. fitText guarantees copy fits its own box and knows nothing about the photograph next to it, so a paragraph ran underneath one and lost the end of every line.'],
  ['Sticker bounds', 'A sticker sizes itself from its label, so a long label walked off the right edge and through a headline. Bounds now include the lift the rotation adds.'],
  ['Translucency gate', 'engine/source/cutout.mjs had the gate and the measurement but never connected them — stats never carried the field, so the check silently skipped and five see-through face mattes reported "pass". Now wired.'],
  ['Negation-aware claims', 'The banned-claims check flagged "waterproof" in the line "nothing is waterproof" — punishing the copy for being accurate. It now looks back for a negator before deciding a term was asserted, and still catches the asserted form.'],
  ['Derived counts', `The headline says ${['zero','one','two','three','four','five','six'][MISSED.length]} places because it counts the array beneath it.`],
];

const html = `<title>SPF, Honestly</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
:root{
  --ground:#FBF8F2; --surface:#FFFFFF; --line:#E2DCD1;
  --text:#141210; --muted:#6E665C;
  --sun:${C.sun}; --blue:${C.blue}; --pink:${C.pink}; --mint:${C.mint};
  --accent:#1F49D6;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ground:#131211; --surface:#1B1917; --line:#2E2A26;
    --text:#F1ECE4; --muted:#968D82; --accent:#8FA9FF;
  }
}
:root[data-theme="dark"]{
  --ground:#131211; --surface:#1B1917; --line:#2E2A26;
  --text:#F1ECE4; --muted:#968D82; --accent:#8FA9FF;
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);
  font-family:"Bricolage Grotesque",system-ui,-apple-system,sans-serif;
  font-variation-settings:"wdth" 100,"wght" 450;line-height:1.55;-webkit-font-smoothing:antialiased}
.wrap{max-width:1160px;margin:0 auto;padding:clamp(2.4rem,6vw,5rem) clamp(1.1rem,4vw,2.4rem) 5rem}
.eyebrow{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.7rem;font-weight:700;
  letter-spacing:.24em;text-transform:uppercase;color:var(--accent);margin:0 0 1rem}
h1{font-variation-settings:"wdth" 88,"wght" 800;font-size:clamp(3rem,10vw,6.4rem);line-height:.92;
  letter-spacing:-.02em;margin:0 0 .5rem;text-wrap:balance}
h1 em{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-weight:400;
  font-variation-settings:normal;letter-spacing:0}
.standfirst{font-size:clamp(1.02rem,2vw,1.24rem);color:var(--muted);max-width:58ch;margin:1.2rem 0 2.2rem}
.standfirst strong{color:var(--text);font-variation-settings:"wdth" 100,"wght" 700}
.swatches{display:flex;gap:.5rem;margin:0 0 2rem;padding:0;list-style:none;flex-wrap:wrap}
.swatches li{width:74px;height:44px;border-radius:6px;border:1px solid var(--line)}
h2{font-variation-settings:"wdth" 92,"wght" 800;font-size:clamp(1.6rem,3.6vw,2.3rem);line-height:1.04;
  margin:0 0 .5rem;letter-spacing:-.01em}
.sectnote{color:var(--muted);max-width:64ch;margin:0 0 1.6rem}
section{margin-bottom:clamp(3.2rem,7vw,5rem)}
.swipe{font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);margin:0 0 1.1rem}
.strip{display:flex;gap:clamp(.9rem,2.2vw,1.7rem);overflow-x:auto;scroll-snap-type:x mandatory;
  padding:.4rem 0 1.5rem;margin:0 calc(-1 * clamp(1.1rem,4vw,2.4rem));
  padding-left:clamp(1.1rem,4vw,2.4rem);padding-right:clamp(1.1rem,4vw,2.4rem);scrollbar-width:thin}
.card{flex:0 0 min(74vw,368px);scroll-snap-align:center}
.card figure{margin:0}
.card img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;border-radius:5px;background:var(--surface)}
.card figcaption{padding-top:.85rem}
.num{font-family:"JetBrains Mono",monospace;font-size:.64rem;font-weight:700;letter-spacing:.16em;
  color:var(--accent);display:block;margin-bottom:.2rem;text-transform:uppercase}
.card p{margin:0;color:var(--muted);font-size:.88rem;line-height:1.5}
.checks{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}
.checks li{display:grid;grid-template-columns:minmax(150px,230px) 1fr;gap:.9rem 1.8rem;padding:1.15rem 0;
  border-bottom:1px solid var(--line);align-items:start}
.checks b{font-variation-settings:"wdth" 100,"wght" 700;font-size:.95rem}
.checks span{color:var(--muted);font-size:.9rem;max-width:68ch}
@media (max-width:560px){.checks li{grid-template-columns:1fr;gap:.25rem}}
.pull{font-family:"Instrument Serif",Georgia,serif;font-style:italic;font-size:clamp(1.5rem,3.4vw,2.1rem);
  line-height:1.24;max-width:26ch;margin:0;color:var(--text)}
footer{border-top:1px solid var(--line);padding-top:1.3rem;color:var(--muted);
  font-family:"JetBrains Mono",monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;
  display:flex;flex-wrap:wrap;gap:.5rem 1.6rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <p class="eyebrow">${CAMPAIGN.brand} — ${CAMPAIGN.product}</p>
  <h1>You apply a quarter<br><em>of the SPF on the label</em></h1>
  <p class="standfirst">A six-slide skincare carousel. <strong>A different ground colour and a different composition on every frame</strong> — a hard-cut circle, a dot-field comparison, an arch, a dial, a labelled photograph, a split. The teaching is standard public sunscreen guidance; the brand is fictional and claims nothing of its own.</p>
  <ul class="swatches">
    <li style="background:${C.sun}"></li><li style="background:${C.blue}"></li>
    <li style="background:${C.pink}"></li><li style="background:${C.mint}"></li>
    <li style="background:${C.paper}"></li><li style="background:${C.ink}"></li>
  </ul>

  <section>
    <h2>The set</h2>
    <p class="swipe">← swipe / scroll →</p>
    <div class="strip">
      ${SLIDES.map(([ground, note], i) => `<article class="card"><figure>
        <img src="${b64(`w-${i + 1}.jpg`)}" alt="Slide ${i + 1}, ${ground} ground">
        <figcaption><span class="num">${String(i + 1).padStart(2, '0')} / 06 · ${ground}</span>
          <p>${note}</p></figcaption></figure></article>`).join('\n      ')}
    </div>
  </section>

  <section>
    <h2>What changed from the last set</h2>
    <p class="sectnote">The gym carousel was marked down as too dark, too uniform, and one design language repeated. Each of those is a specific, checkable thing rather than a matter of taste — so each got a specific answer.</p>
    <ul class="checks">
      <li><b>Too dark</b><span>Photography is filtered on measured luminance before it enters the pool — anything under a mean of 118 is discarded. Four of the six grounds are saturated colour; two are paper. Nothing in the set is near-black except one half of the closing frame.</span></li>
      <li><b>All the same</b><span>No layout is reused. The compositions are: bleed circle, two-column dot comparison, arch with an oversized numeral, centred dial, labelled photograph, horizontal split.</span></li>
      <li><b>Same design language</b><span>New typefaces, not the ones used all session: Bricolage Grotesque for the shouting, Instrument Serif italic answering it, JetBrains Mono for labels. New niche, new brand, new palette.</span></li>
    </ul>
  </section>

  <section>
    <h2>What the build refuses to ship</h2>
    <p class="sectnote">Five of these six were written because they caught something in this set.</p>
    <ul class="checks">
      ${GUARDS.map(([n, d]) => `<li><b>${n}</b><span>${d}</span></li>`).join('\n      ')}
    </ul>
  </section>

  <section>
    <p class="pull">Matting was tried and rejected — every candidate failed the translucency gate between 0.20 and 0.97 against a 0.06 limit. Bright skin on a bright ground gives the model no edge to find. So the photography is cut into geometry instead, which is what collage actually is, and which cannot half-fail.</p>
  </section>

  <footer>
    <span>${CAMPAIGN.brand} · ${CAMPAIGN.handle}</span>
    <span>${CAMPAIGN.credit}</span>
    <span>Fictional campaign</span>
  </footer>
</div>
`;

const out = path.join(ROOT, 'design/noon/noon-spf.html');
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB');
