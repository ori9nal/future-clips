import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLES, stylesFor } from '../../engine/styles/registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = path.join(ROOT, 'output/web');
const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(WEB, f)).toString('base64')}`;
const spec = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${id}.json`), 'utf8'));

const slidesOf = (set) => fs.readdirSync(WEB)
  .filter((f) => f.startsWith(`${set}-`) && f.endsWith('.jpg'))
  .map((f) => ({ f, n: Number(f.slice(set.length + 1, -4)) }))
  .filter((x) => Number.isFinite(x.n))
  .sort((a, b) => a.n - b.n);

/* niche → the sets rendered for it. `cross` marks a style the niche does not
   usually run, which is exactly the point of showing it. */
const NICHES = [
  { niche: 'calisthenics', sets: [{ id: 'bedrock-form', style: 'bedrock', generated: true }] },
  { niche: 'fitness', sets: [
    { id: 'apex-strength', style: 'native' },
    { id: 'apex-strength', style: 'mascot' }] },
  { niche: 'longevity', sets: [
    { id: 'meridian-vo2', style: 'clinical' },
    { id: 'meridian-vo2', style: 'poster', cross: true }] },
  { niche: 'mindset', sets: [
    { id: 'quiet-miles', style: 'editorial' },
    { id: 'quiet-miles', style: 'clinical', cross: true }] },
  { niche: 'personal finance', sets: [
    { id: 'ledger-pro', style: 'document' },
    { id: 'ledger-pro', style: 'pastel', cross: true },
    { id: 'ledger-money', style: 'native', cross: true }] },
  { niche: 'skincare', sets: [
    { id: 'lumen-barrier', style: 'pastel' },
    { id: 'lumen-barrier', style: 'editorial', cross: true },
    { id: 'lumen-barrier', style: 'clinical', cross: true },
    { id: 'lumen-barrier', style: 'poster', cross: true }] },
  { niche: 'marketing', sets: [
    { id: 'signal-hooks', style: 'poster' },
    { id: 'signal-hooks', style: 'document', cross: true }] },
  { niche: 'nutrition', sets: [{ id: 'fuel-prep', style: 'native' }] },
  { niche: 'supplements', sets: [{ id: 'core-creatine', style: 'native' }] },
];

const ratio = (c) => { const g = (a, b) => (b ? g(b, a % b) : a); const d = g(c.w, c.h); return `${c.w / d}:${c.h / d}`; };

const row = (set, canvas) => {
  const items = slidesOf(set);
  return `<div class="row">${items.map(({ f, n }) => `<figure style="--ar:${canvas.w}/${canvas.h}">
        <img src="${b64(f)}" alt="${set} slide ${n}" loading="lazy"><figcaption>${String(n).padStart(2, '0')}</figcaption></figure>`).join('')}</div>`;
};

const total = fs.readdirSync(WEB).filter((f) => f.endsWith('.jpg')).length;
const styleById = Object.fromEntries(STYLES.map((s) => [s.id, s]));

const html = `<title>The Style System</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Newsreader:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
:root{--ground:#0B0B0C;--surface:#141518;--line:#26282D;--text:#F2F0EB;--muted:#8A8F97;
  --accent:#FF5A1F;--ok:#34D07F}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){
  --ground:#F6F4F0;--surface:#FFF;--line:#E0DCD5;--text:#131316;--muted:#5F646B;--accent:#C93F0C;--ok:#1B8A57}}
:root[data-theme="light"]{--ground:#F6F4F0;--surface:#FFF;--line:#E0DCD5;--text:#131316;--muted:#5F646B;--accent:#C93F0C;--ok:#1B8A57}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);line-height:1.6;
  font-family:"Archivo",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1340px;margin:0 auto;padding:clamp(2.4rem,6vw,4.6rem) clamp(1.1rem,4vw,2.4rem) 5rem}
.eyebrow{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.7rem;font-weight:700;
  letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin:0 0 .9rem}
h1{font-family:"Newsreader",Georgia,serif;font-size:clamp(2.4rem,7vw,4.4rem);line-height:1.02;
  font-weight:600;letter-spacing:-.02em;margin:0 0 1rem;text-wrap:balance}
.standfirst{font-size:clamp(1rem,1.9vw,1.16rem);color:var(--muted);max-width:64ch;margin:0 0 2rem}
.standfirst strong{color:var(--text);font-weight:600}
.facts{display:flex;flex-wrap:wrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:2.8rem}
.fact{flex:1 1 120px;padding:.9rem 1rem .9rem 0;border-right:1px solid var(--line)}
.fact:last-child{border-right:0}
.fact dt{font-family:"JetBrains Mono",monospace;font-size:.6rem;letter-spacing:.15em;
  text-transform:uppercase;color:var(--muted);margin:0 0 .2rem}
.fact dd{margin:0;font-weight:700;font-size:1.25rem;font-variant-numeric:tabular-nums}
h2{font-family:"Newsreader",Georgia,serif;font-size:clamp(1.5rem,3.4vw,2.1rem);line-height:1.12;
  font-weight:600;margin:0 0 .3rem;letter-spacing:-.01em}
.sectnote{color:var(--muted);max-width:68ch;margin:0 0 1.4rem}
section{margin-bottom:clamp(2.8rem,6vw,4.4rem)}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.9rem}
.scard{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:1rem 1.1rem}
.scard h3{margin:0 0 .1rem;font-size:1.02rem;font-weight:600;display:flex;justify-content:space-between;gap:.6rem;align-items:baseline}
.scard h3 em{font-style:normal;font-family:"JetBrains Mono",monospace;font-size:.66rem;color:var(--muted)}
.scard p{margin:.35rem 0 .55rem;font-size:.85rem;color:var(--muted);line-height:1.45}
.scard .for{font-family:"JetBrains Mono",monospace;font-size:.62rem;letter-spacing:.08em;
  text-transform:uppercase;color:var(--muted);opacity:.8}

.niche{border-top:1px solid var(--line);padding-top:1.2rem;margin-bottom:2rem}
.niche > header{display:flex;flex-wrap:wrap;gap:.4rem 1rem;align-items:baseline;margin-bottom:1rem}
.niche h3{margin:0;font-size:1.3rem;font-weight:700;text-transform:capitalize}
.niche .avail{font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted)}
.set{margin-bottom:1.5rem}
.set header{display:flex;flex-wrap:wrap;gap:.4rem .8rem;align-items:baseline;margin-bottom:.55rem}
.set h4{margin:0;font-size:.95rem;font-weight:600}
.badge{font-family:"JetBrains Mono",monospace;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;
  padding:.16rem .5rem;border-radius:4px;background:rgba(52,208,127,.15);color:var(--ok)}
.badge.cross{background:rgba(255,90,31,.15);color:var(--accent)}
.badge.gen{background:rgba(120,120,255,.18);color:#8f9bff}
.set .meta{font-family:"JetBrains Mono",monospace;font-size:.64rem;color:var(--muted)}

.row{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:.6rem;
  overflow-x:auto;padding-bottom:.5rem;scrollbar-width:thin}
@media (max-width:920px){.row{grid-auto-columns:minmax(140px,1fr)}}
.row figure{margin:0;min-width:0}
.row img{width:100%;aspect-ratio:var(--ar);object-fit:cover;border-radius:5px;display:block;background:var(--surface)}
.row figcaption{font-family:"JetBrains Mono",monospace;font-size:.58rem;color:var(--muted);padding-top:.3rem}

.checks{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}
.checks li{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:.8rem 1.6rem;padding:1rem 0;
  border-bottom:1px solid var(--line);align-items:start}
.checks b{font-weight:600;font-size:.9rem}
.checks span{color:var(--muted);font-size:.87rem;max-width:70ch}
@media (max-width:560px){.checks li{grid-template-columns:1fr;gap:.2rem}}
pre{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:.9rem 1rem;
  overflow-x:auto;font-family:"JetBrains Mono",monospace;font-size:.73rem;line-height:1.65;color:var(--muted);margin:0}
pre b{color:var(--ok);font-weight:400}
footer{border-top:1px solid var(--line);padding-top:1.2rem;color:var(--muted);
  font-family:"JetBrains Mono",monospace;font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;
  display:flex;flex-wrap:wrap;gap:.4rem 1.5rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <p class="eyebrow">Future Clips — style system</p>
  <h1>One niche does not get one look</h1>
  <p class="standfirst">The reference library runs the same niche several different ways — fitness as a whitepaper, as a phone photo, as an illustrated character — and all of them work, because they are aimed at different readers. So the engine now carries <strong>${STYLES.length} styles</strong>, and a niche gets a <strong>ranked list</strong> rather than an answer.</p>

  <dl class="facts">
    <div class="fact"><dt>Styles</dt><dd>${STYLES.length}</dd></div>
    <div class="fact"><dt>Niches</dt><dd>${NICHES.length}</dd></div>
    <div class="fact"><dt>Sets</dt><dd>${NICHES.reduce((s, n) => s + n.sets.length, 0)}</dd></div>
    <div class="fact"><dt>Slides</dt><dd>${total}</dd></div>
    <div class="fact"><dt>Canvases</dt><dd>2</dd></div>
    <div class="fact"><dt>Image spend</dt><dd>$0.61</dd></div>
  </dl>

  <section>
    <h2>The styles</h2>
    <p class="sectnote">Each one is built to a specific set in the local reference library, not invented. A style is a renderer over the same campaign JSON — the content model does not change when the look does.</p>
    <div class="grid">
      ${STYLES.map((s) => `<article class="scard">
        <h3>${s.label}<em>${ratio(s.canvas)}</em></h3>
        <p>${s.blurb}</p>
        <span class="for">${s.niches.slice(0, 4).join(' · ')}</span>
      </article>`).join('\n      ')}
    </div>
  </section>

  <section>
    <h2>Every niche, every style rendered</h2>
    <p class="sectnote">Green is the style the niche usually runs. Orange is the same campaign pushed through a style it normally would not use — which is often the reason a set gets noticed.</p>
    ${NICHES.map(({ niche, sets }) => {
      const avail = stylesFor(niche).filter((s) => s.fit !== 'stretch').map((s) => s.id);
      return `<div class="niche">
      <header><h3>${niche}</h3><span class="avail">recommended: ${avail.join(', ') || '—'}</span></header>
      ${sets.map(({ id, style, cross }) => {
        const c = spec(id), st = styleById[style];
        return `<div class="set">
        <header>
          <h4>${c.brand} — ${st.label}</h4>
          <span class="badge${cross ? ' cross' : ''}${sets.find((x) => x.id === id && x.style === style)?.generated ? ' gen' : ''}">${
            sets.find((x) => x.id === id && x.style === style)?.generated ? 'gpt-image-2 character' : cross ? 'cross-style' : 'native fit'}</span>
          <span class="meta">${ratio(st.canvas)} · ${slidesOf(`${id}-${style}`).length} slides · ${c.requirements.required_mention}</span>
        </header>
        ${row(`${id}-${style}`, st.canvas)}
      </div>`;
      }).join('\n      ')}
    </div>`;
    }).join('\n    ')}
  </section>

  <section>
    <h2>How a niche gets its styles</h2>
    <p class="sectnote">Scoring is deliberately blunt, and it ranks rather than filters — every style stays reachable at the bottom of the list.</p>
    <pre>GET /api/styles?niche=skincare

  <b>pastel     native    1080x1350</b>   made for this niche
  <b>editorial  adjacent  1080x1350</b>   used by neighbouring niches
  <b>native     adjacent  1080x1920</b>
  clinical   stretch   1080x1350   unusual here, which is sometimes the point
  document   stretch   1080x1350
  mascot     stretch   1080x1920
  poster     stretch   1080x1350</pre>
  </section>

  <section>
    <h2>The generated character</h2>
    <p class="sectnote">One style in the library cannot be built from stock photography: it needs the same illustrated figure in many poses. That one is now real, made with <strong>gpt-image-2</strong> against a live key.</p>
    <pre>probe first, because gpt-image-2 shipped after the model's training cutoff

  returns        <b>b64_json only, no url</b>
  1024x1536      low <b>158 tok  $0.0047   9s</b>
                 med <b>1372 tok $0.0412  19s</b>
                 high <b>5488 tok $0.1646  67s</b>
  1024x1792      accepted, closer to 9:16 AND cheaper than 1024x1536

consistency: draw every pose in ONE generation, then cut it up.
one image cannot drift from itself.

  3 sheets @ medium   <b>$0.126</b>
  4 poses cut         <b>translucency 0.003 (limit 0.06) — all PASS</b>
  every later render  <b>$0.00</b></pre>
  </section>

  <section>
    <h2>What broke building it</h2>
    <ul class="checks">
      <li><b>A cache that charged twice</b><span>The generated-image cache put the caller's <em>label</em> in the filename, so the identical sheet requested by the CLI and by the studio missed each other's entry and was paid for twice. It is content-addressed now — the label is a ledger annotation, not identity. Cost $0.25 to find.</span></li>
      <li><b>I reintroduced the bug the engine exists to prevent</b><span>Two styles set a subline with bare <code>text()</code> at a fixed size instead of fitting it, and long copy ran straight off the frame. The fix was not just to fit it: <code>hook.sub</code> means a standfirst in one style and a one-line aside in another, so the kit now has an <code>aside()</code> that picks a size band from the copy length and wraps.</span></li>
      <li><b>A chip sized by guess</b><span>The pastel score pill was a fixed 178px wide, so "the usual cause" rendered as "e usual caus". It now measures the label against the real face and sizes to it.</span></li>
      <li><b>Fractional geometry</b><span>Layout maths produces fractional heights; sharp demands integers. Rounding inside <code>plate()</code> fixed it for every style rather than at each call site.</span></li>
      <li><b>An empty panel</b><span>Pastel drew its tinted body panel whether or not the campaign had body copy for it, leaving a blank pink block. It is gated on content now.</span></li>
    </ul>
  </section>

  <footer>
    <span>Future Clips</span>
    <span>Photography: Pexels</span>
    <span>Fictional campaigns</span>
  </footer>
</div>
`;

const out = path.join(ROOT, 'design/apex/styles.html');
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB ·', total, 'slides');
