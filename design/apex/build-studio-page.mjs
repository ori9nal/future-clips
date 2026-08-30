import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const WEB = path.join(ROOT, 'output/web');
const b64 = (f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(WEB, f)).toString('base64')}`;
const spec = (id) => JSON.parse(fs.readFileSync(path.join(ROOT, 'campaigns', `${id}.json`), 'utf8'));

/** Every slide of a set, in order — no sampling. */
function slidesOf(set) {
  return fs.readdirSync(WEB)
    .filter((f) => f.startsWith(`${set}-`) && f.endsWith('.jpg'))
    .map((f) => ({ f, n: Number(f.slice(set.length + 1, -4)) }))
    .filter((x) => Number.isFinite(x.n))
    .sort((a, b) => a.n - b.n);
}

const SETS = [
  { id: 'apex-strength', style: 'native', note: 'Closes on the app screen at full bleed — the brief requires a real screenshot.' },
  { id: 'ledger-money', style: 'native', note: 'Budgeting habits only. The brief bans anything that reads as investment advice.' },
  { id: 'fuel-prep', style: 'native', note: 'One meal-prep shoot, so the set reads as one person’s Sunday.' },
  { id: 'core-creatine', style: 'native', note: 'Authored through the admin form during this session, then rendered from the studio. Three ranked items, so five slides.' },
];

const row = (set) => {
  const items = slidesOf(set);
  return `<div class="row" style="--n:${items.length}">${items.map(({ f, n }) => `<figure>
      <img src="${b64(f)}" alt="${set} slide ${n}" loading="lazy">
      <figcaption>${String(n).padStart(2, '0')}</figcaption></figure>`).join('\n      ')}</div>`;
};

const total = fs.readdirSync(WEB).filter((f) => f.endsWith('.jpg')).length;

const html = `<title>Four Campaigns, One Studio</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
:root{--ground:#0B0B0C;--surface:#141518;--line:#26282D;--text:#F2F0EB;--muted:#8A8F97;
  --accent:#FF5A1F;--ok:#34D07F}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){
  --ground:#F5F3EF;--surface:#FFF;--line:#DEDAD2;--text:#131316;--muted:#61666E;--accent:#D8410B;--ok:#1B8A57}}
:root[data-theme="light"]{--ground:#F5F3EF;--surface:#FFF;--line:#DEDAD2;--text:#131316;--muted:#61666E;--accent:#D8410B;--ok:#1B8A57}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);line-height:1.6;
  font-family:"Poppins",system-ui,-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1320px;margin:0 auto;padding:clamp(2.4rem,6vw,4.6rem) clamp(1.1rem,4vw,2.4rem) 5rem}
.eyebrow{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:.7rem;font-weight:700;
  letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin:0 0 .9rem}
h1{font-size:clamp(2.3rem,6.6vw,4rem);line-height:1.03;font-weight:700;letter-spacing:-.02em;margin:0 0 1rem;text-wrap:balance}
.standfirst{font-size:clamp(1rem,1.9vw,1.16rem);color:var(--muted);max-width:62ch;margin:0 0 2rem}
.standfirst strong{color:var(--text);font-weight:600}
.facts{display:flex;flex-wrap:wrap;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-bottom:2.6rem}
.fact{flex:1 1 130px;padding:.9rem 1rem .9rem 0;border-right:1px solid var(--line)}
.fact:last-child{border-right:0}
.fact dt{font-family:"JetBrains Mono",monospace;font-size:.6rem;letter-spacing:.15em;
  text-transform:uppercase;color:var(--muted);margin:0 0 .2rem}
.fact dd{margin:0;font-weight:700;font-size:1.25rem;font-variant-numeric:tabular-nums}
h2{font-size:clamp(1.4rem,3.2vw,2rem);line-height:1.12;font-weight:700;margin:0 0 .3rem;letter-spacing:-.01em}
.sectnote{color:var(--muted);max-width:66ch;margin:0 0 1.3rem}
section{margin-bottom:clamp(2.8rem,6vw,4.4rem)}
.set{border-top:1px solid var(--line);padding-top:1.3rem;margin-bottom:2.4rem}
.set header{display:flex;flex-wrap:wrap;gap:.5rem 1.2rem;align-items:baseline;margin-bottom:.3rem}
.set h3{margin:0;font-size:1.15rem;font-weight:700}
.set .meta{font-family:"JetBrains Mono",monospace;font-size:.68rem;letter-spacing:.1em;
  text-transform:uppercase;color:var(--muted)}
.set p{color:var(--muted);font-size:.88rem;margin:0 0 .9rem;max-width:64ch}

/* The whole set side by side. On a wide screen every slide fits at once;
   below that the row scrolls rather than reflowing, because a carousel read
   out of order is not the same set. */
.row{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:.7rem;
  overflow-x:auto;padding-bottom:.55rem;scroll-snap-type:x proximity;scrollbar-width:thin}
@media (max-width:920px){.row{grid-auto-columns:minmax(150px,1fr)}}
.row figure{margin:0;min-width:0;scroll-snap-align:start}
.row img{width:100%;aspect-ratio:9/16;object-fit:cover;border-radius:6px;display:block;background:var(--surface)}
.row figcaption{font-family:"JetBrains Mono",monospace;font-size:.6rem;color:var(--muted);padding-top:.35rem}

.ui{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}
.ui div{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:1rem 1.1rem}
.ui h4{margin:0 0 .35rem;font-size:.95rem;font-weight:600}
.ui code{font-family:"JetBrains Mono",monospace;font-size:.72rem;color:var(--accent)}
.ui p{margin:.4rem 0 0;color:var(--muted);font-size:.85rem}
.checks{list-style:none;padding:0;margin:0;border-top:1px solid var(--line)}
.checks li{display:grid;grid-template-columns:minmax(140px,220px) 1fr;gap:.8rem 1.6rem;padding:1rem 0;
  border-bottom:1px solid var(--line);align-items:start}
.checks b{font-weight:600;font-size:.9rem}
.checks span{color:var(--muted);font-size:.87rem;max-width:70ch}
@media (max-width:560px){.checks li{grid-template-columns:1fr;gap:.2rem}}
pre{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:.9rem 1rem;
  overflow-x:auto;font-family:"JetBrains Mono",monospace;font-size:.74rem;line-height:1.65;color:var(--muted);margin:0}
pre b{color:var(--ok);font-weight:400}
footer{border-top:1px solid var(--line);padding-top:1.2rem;color:var(--muted);
  font-family:"JetBrains Mono",monospace;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;
  display:flex;flex-wrap:wrap;gap:.4rem 1.5rem}
:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>

<div class="wrap">
  <p class="eyebrow">Future Clips — studio</p>
  <h1>Four campaigns, one studio</h1>
  <p class="standfirst">Four niches, four briefs, one renderer. <strong>Every slide of every set is here</strong> — a campaign is a JSON file and a folder of pictures, and the engine, the studio and the admin form all read the same file with no second copy to keep in sync.</p>

  <dl class="facts">
    <div class="fact"><dt>Campaigns</dt><dd>4</dd></div>
    <div class="fact"><dt>Niches</dt><dd>4</dd></div>
    <div class="fact"><dt>Styles</dt><dd>2</dd></div>
    <div class="fact"><dt>Slides</dt><dd>${total}</dd></div>
    <div class="fact"><dt>Render</dt><dd>~5s</dd></div>
  </dl>

  <section>
    <h2>The sets, complete</h2>
    <p class="sectnote">Native format throughout: 9:16, full-bleed photography, stroked caption, ranked countdown so the swipe pays off at the end.</p>
    ${SETS.map((s) => {
      const c = spec(s.id);
      const n = slidesOf(`${s.id}-${s.style}`).length;
      return `<div class="set">
      <header><h3>${c.brand}</h3>
        <span class="meta">${c.niche} · ${n} slides · $${c.payout.rate_usd.toFixed(2)}/1k · ${c.requirements.required_mention}</span></header>
      <p>${s.note}</p>
      ${row(`${s.id}-${s.style}`)}
    </div>`;
    }).join('\n    ')}
  </section>

  <section>
    <h2>Same campaign, mascot style</h2>
    <p class="sectnote">When an agency supplies a mascot, nothing about the campaign changes — same spec, same ranked array, same required mention. Only the renderer differs. All six slides.</p>
    ${row('apex-strength-mascot')}
  </section>

  <section>
    <h2>The interface</h2>
    <p class="sectnote">Runs on the Next app. Verified end to end this session: a campaign was created through the form, listed in the studio, and rendered — five slides in 5.5 seconds.</p>
    <div class="ui">
      <div><h4>Studio</h4><code>/studio</code>
        <p>Pick a campaign and a style. The panel above the button shows what the brief locks — rate, budget left, review window, aspect, required mention, banned claims — so a clipper sees the terms before rendering, not after rejection. Mascot style is disabled with a reason when the campaign has no mascot asset.</p></div>
      <div><h4>Admin</h4><code>/admin/new</code>
        <p>Agency onboarding: brand, terms, banned claims, palette, photo folder, optional mascot, then the hook, the ranked payload and the closer. Saves the exact JSON the engine reads.</p></div>
      <div><h4>Render API</h4><code>POST /api/sets</code>
        <p>Renders and returns slide URLs with the logic-check verdict. A copy line that will not fit comes back as a 422 naming the line, because "render failed" tells an operator nothing they can act on.</p></div>
      <div><h4>File API</h4><code>GET /api/file/…</code>
        <p>Serves rendered slides. The path is resolved and then checked against <code>output/</code>, so a traversal cannot escape — verified: <b>403</b> on a campaign JSON, <b>404</b> on <code>../.env.local</code>.</p></div>
    </div>
  </section>

  <section>
    <h2>Verified, not asserted</h2>
    <pre>POST /api/specs   {"id":"core-creatine",…}     -> <b>saved: core-creatine</b>
POST /api/sets    {"campaignId":"core-creatine"} -> <b>5 slides in 5.5s · logic PASS</b>
GET  /api/file/output/sets/…/slide-1.png        -> <b>200 image/png 1,182,296b</b>
GET  /api/file/campaigns/apex-strength.json     -> <b>403 forbidden</b>
GET  /api/file/../.env.local                    -> <b>404 not found</b>
GET  /api/specs                                 -> <b>APEX, CORE, FUEL, LEDGER</b></pre>
  </section>

  <section>
    <h2>What the renderer learned this round</h2>
    <ul class="checks">
      <li><b>Captions on faces</b><span>The band solver measured how busy a region was, which cannot see a face — a face in flat light is one of the <em>quietest</em> things in a frame, which is exactly how the money set put its hook across a man's eyes. Bands now carry a skin-tone share, weighted heavily.</span></li>
      <li><b>Quiet band, loud block</b><span>Worse: the block was anchored at a band's top and allowed to grow past it, so a quiet strip only guaranteed its own 158px. The caption is now fitted first to learn its real height, then windows of <em>that</em> height are scored and ranked.</span></li>
      <li><b>Zone cut off the best spot</b><span>The hook's search zone started at 10% of frame height, which excluded the band above the subject's head — the single best placement in a portrait. It starts at 5% now.</span></li>
    </ul>
  </section>

  <footer>
    <span>Future Clips</span>
    <span>Photography: Pexels</span>
    <span>Fictional campaigns</span>
  </footer>
</div>
`;

const out = path.join(ROOT, 'design/apex/studio.html');
fs.writeFileSync(out, html);
console.log(out, (fs.statSync(out).size / 1024 / 1024).toFixed(2) + ' MB', `· ${total} slides embedded`);
