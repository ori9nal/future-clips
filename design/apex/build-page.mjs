import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPAIGN, RANKED } from './native.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const b64 = (d, f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(ROOT, d, f)).toString('base64')}`;

const NATIVE_NOTES = [
  'Hook. A promise with a number, and the count comes from the ranked array.',
  'Rank 4. Title high, verdict low, both clear of the face — the band solver picked both.',
  'Rank 3.',
  'Rank 2.',
  'Rank 1, the payoff of the countdown.',
  'The app, full bleed. The brief requires a real screenshot; the reference sets do exactly this.',
];
const MASCOT_NOTES = [
  'Cover. Agency palette, mascot large.',
  'Rank 4. Speech bubble sized to its text, mascot right.',
  'Rank 3, mascot flipped left so four ranked slides do not read as one.',
  'Rank 2.',
  'Rank 1.',
  'Closer with the required mention.',
];

const P = CAMPAIGN.payout, RQ = CAMPAIGN.requirements;

const html = `<title>Apex Native Set</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
:root{
  --ground:#0B0B0C; --surface:#141518; --line:#26282D;
  --text:#F2F0EB; --muted:#8A8F97; --accent:#FF5A1F;
}
@media (prefers-color-scheme:light){
  :root:not([data-theme="dark"]){
    --ground:#F5F3EF; --surface:#FFFFFF; --line:#DEDAD2;
    --text:#131316; --muted:#61666E; --accent:#D8410B;
  }
}
:root[data-theme="light"]{
  --ground:#F5F3EF; --surface:#FFFFFF; --line:#DEDAD2;
  --text:#131316; --muted:#61666E; --accent:#D8410B;
}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);
  font-family:"Poppins",system-ui,-apple-system,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:1180px;margin:0 auto;padding:clamp(2.4rem,6vw,4.6rem) clamp(1.1rem,4vw,2.4rem) 5rem}
.eyebrow{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.7rem;font-weight:700;
  letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin:0 0 .9rem}
h1{font-size:clamp(2.4rem,7vw,4.2rem);line-height:1.02;font-weight:700;letter-spacing:-.02em;
  margin:0 0 1.1rem;text-wrap:balance}
.standfirst{font-size:clamp(1rem,1.9vw,1.18rem);color:var(--muted);max-width:60ch;margin:0 0 2rem}
.standfirst strong{color:var(--text);font-weight:600}
.facts{display:flex;flex-wrap:wrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:2.6rem}
.fact{flex:1 1 140px;padding:.95rem 1.1rem .95rem 0;border-right:1px solid var(--line)}
.fact:last-child{border-right:0}
.fact dt{font-family:"JetBrains Mono",monospace;font-size:.62rem;letter-spacing:.15em;
  text-transform:uppercase;color:var(--muted);margin:0 0 .25rem}
.fact dd{margin:0;font-weight:700;font-size:1.3rem;font-variant-numeric:tabular-nums}
h2{font-size:clamp(1.5rem,3.4vw,2.1rem);line-height:1.1;font-weight:700;margin:0 0 .4rem;letter-spacing:-.01em}
.sectnote{color:var(--muted);max-width:64ch;margin:0 0 1.4rem}
section{margin-bottom:clamp(3rem,6vw,4.6rem)}
.swipe{font-family:"JetBrains Mono",monospace;font-size:.64rem;letter-spacing:.16em;text-transform:uppercase;
  color:var(--muted);margin:0 0 1rem}
.strip{display:flex;gap:1rem;overflow-x:auto;scroll-snap-type:x mandatory;padding:.3rem 0 1.3rem;
  margin:0 calc(-1 * clamp(1.1rem,4vw,2.4rem));padding-left:clamp(1.1rem,4vw,2.4rem);
  padding-right:clamp(1.1rem,4vw,2.4rem);scrollbar-width:thin}
.card{flex:0 0 min(62vw,260px);scroll-snap-align:center}
.card img{width:100%;aspect-ratio:9/16;object-fit:cover;display:block;border-radius:6px;background:var(--surface)}
.card figure{margin:0}
.card figcaption{padding-top:.7rem}
.num{font-family:"JetBrains Mono",monospace;font-size:.62rem;font-weight:700;letter-spacing:.15em;
  color:var(--accent);display:block;margin-bottom:.15rem}
.card p{margin:0;color:var(--muted);font-size:.82rem;line-height:1.45}
.checks{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}
.checks li{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:.8rem 1.6rem;padding:1.05rem 0;
  border-bottom:1px solid var(--line);align-items:start}
.checks b{font-weight:600;font-size:.92rem}
.checks span{color:var(--muted);font-size:.88rem;max-width:68ch}
@media (max-width:560px){.checks li{grid-template-columns:1fr;gap:.2rem}}
pre{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:1rem 1.1rem;
  overflow-x:auto;font-family:"JetBrains Mono",monospace;font-size:.76rem;line-height:1.6;color:var(--muted);margin:0}
pre b{color:var(--text);font-weight:400}
footer{border-top:1px solid var(--line);padding-top:1.2rem;color:var(--muted);
  font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;
  display:flex;flex-wrap:wrap;gap:.4rem 1.5rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <p class="eyebrow">${CAMPAIGN.brand} — ${CAMPAIGN.agency}</p>
  <h1>Built to the format, not to my taste</h1>
  <p class="standfirst">Folders 14 and 15 settle it: the gym niche does not run designed carousels. It runs <strong>a full-bleed photo off someone's phone with a stroked caption on top</strong>, a ranked countdown, and at least one slide that is nothing but the app's own screen. Everything I made before this looked like a magazine ad — which reads as an ad, and gets scrolled.</p>

  <dl class="facts">
    <div class="fact"><dt>Aspect</dt><dd>${RQ.aspect}</dd></div>
    <div class="fact"><dt>Slides</dt><dd>${RANKED.length + 2}</dd></div>
    <div class="fact"><dt>Rate</dt><dd>$${P.rate_usd.toFixed(2)}/1k</dd></div>
    <div class="fact"><dt>Review</dt><dd>${P.review_days} days</dd></div>
    <div class="fact"><dt>Styles</dt><dd>2</dd></div>
  </dl>

  <section>
    <h2>Native — the format the reference actually uses</h2>
    <p class="sectnote">Real gym photography, stroked Poppins, ranked countdown, and the app at full bleed on the last slide because the brief requires a real screenshot.</p>
    <p class="swipe">← swipe / scroll →</p>
    <div class="strip">
      ${NATIVE_NOTES.map((n, i) => `<article class="card"><figure>
        <img src="${b64('output/apex', `w-${i + 1}.jpg`)}" alt="Native slide ${i + 1}">
        <figcaption><span class="num">${String(i + 1).padStart(2, '0')} / 0${NATIVE_NOTES.length}</span><p>${n}</p></figcaption>
      </figure></article>`).join('\n      ')}
    </div>
  </section>

  <section>
    <h2>Mascot — the same campaign, a different renderer</h2>
    <p class="sectnote">When an agency supplies a mascot and wants a character-led set, nothing about the campaign changes. Same JSON, same ranked array, same copy, same required mention — only the drawing differs. A mascot is also the one character problem that is easy: it is one asset reused on every frame, so nothing has to stay consistent across generations. It matted at <strong>0.023 translucency against a 0.06 limit</strong>, where the photographic faces earlier failed between 0.20 and 0.97.</p>
    <p class="swipe">← swipe / scroll →</p>
    <div class="strip">
      ${MASCOT_NOTES.map((n, i) => `<article class="card"><figure>
        <img src="${b64('output/apex-mascot', `w-${i + 1}.jpg`)}" alt="Mascot slide ${i + 1}">
        <figcaption><span class="num">${String(i + 1).padStart(2, '0')} / 0${MASCOT_NOTES.length}</span><p>${n}</p></figcaption>
      </figure></article>`).join('\n      ')}
    </div>
  </section>

  <section>
    <h2>The campaign is data, not copy in a file</h2>
    <p class="sectnote">A realistic brief: payout terms, platform list, review window, required mention, banned claims, and which assets the agency supplies versus which the clipper brings. Both renderers read this same file.</p>
    <pre><b>campaigns/apex-strength.json</b>

payout        $${P.rate_usd.toFixed(2)} per 1,000 views · $${P.min_payout_usd} min · $${P.max_payout_usd} max
platforms     ${P.platforms.join(', ')}
review        ${P.review_days} days · budget $${P.budget_remaining_usd.toLocaleString('en-US')} of $${P.budget_total_usd.toLocaleString('en-US')} left
requires      ${RQ.aspect} · ${RQ.min_slides}-${RQ.max_slides} slides · ${RQ.required_mention}
              must_show_app: ${RQ.must_show_app}
banned        ${CAMPAIGN.rules.banned_claims.join(', ')}
supplied      palette, app screens        (clipper brings the footage)</pre>
  </section>

  <section>
    <h2>What broke on the way</h2>
    <ul class="checks">
      <li><b>Every caption refused to fit</b><span>Poppins' ascender plus descender is about 1.4em, so the flat line-collision check rejected every size at the 1.14 leading these captions want. The block just reported "does not fit". Switched to measured leading, which lifts spacing only as far as the actual ink needs.</span></li>
      <li><b>My own stroke guard</b><span>The fitter maximised the type to exactly the box width, then I added the stroke and threw on a 3px overrun. Reserving the stroke before fitting is the fix — and the reservation depends on the size, which depends on the reservation, so it iterates until it settles.</span></li>
      <li><b>Caption across a data row</b><span>I hardcoded the app slide's caption at y=1180 and it landed straight on "Overhead press". Now the same band solver places it, and the screen carries three lifts instead of four so there is a real gap to sit in.</span></li>
      <li><b>Speech bubble clipping its own text</b><span>The bubble was clamped to a max width while the type stayed at a fixed size, so the longest line ran out through the side. Fit the type first, then size the bubble from what fitted.</span></li>
      <li><b>Subline on a face</b><span>Searching for the quietest band independently floated the hook's subline down onto the model. It belongs directly under the title, which is what the reference does.</span></li>
    </ul>
  </section>

  <footer>
    <span>${CAMPAIGN.brand} · ${RQ.required_mention}</span>
    <span>Photography: Pexels</span>
    <span>Fictional campaign</span>
  </footer>
</div>
`;

const out = path.join(ROOT, 'design/apex/apex-native.html');
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB');
