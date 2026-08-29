// ATLAS AI — a gym-coach campaign, built dense.
//
// The standing complaint has been "the least visuals". So every slide here
// carries a MINIMUM of six deliberate elements: ground, at least one object or
// photograph, a colour block, a rule or divider, a data or badge element, and
// the type stack. A slide that would come out as one headline on a plate does
// not ship.
import fs from 'node:fs';

const F = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Space+Grotesk:wght@400;500;700&family=Archivo:wght@700;800;900&display=swap">';
const INK = '#0B0B0D', LIME = '#C6F24E', ORANGE = '#FF5A1F', PAPER = '#F5F3EE', STEEL = '#7A8189';

const page = (body) => `<!doctype html>
<html><head><meta charset="utf-8"><script src="./support.js"></script></head>
<body><x-dc><helmet>${F}
<style>body{margin:0}a{color:${LIME}}a:hover{opacity:.8}</style></helmet>
<div style="position:relative;width:1080px;height:1350px;overflow:hidden;font-family:'Space Grotesk',system-ui,sans-serif;">
${body}
</div></x-dc></body></html>
`;

// the furniture every slide carries, so a set reads as one account
const rail = (n, onDark = true) => `
  <div style="position:absolute;left:56px;top:52px;display:inline-flex;align-items:center;gap:9px;background:${onDark ? PAPER : INK};border-radius:999px;padding:8px 16px 8px 10px;z-index:5;">
    <div style="width:14px;height:14px;border-radius:4px;background:${ORANGE};"></div>
    <span style="font-weight:700;font-size:15px;letter-spacing:.14em;color:${onDark ? INK : PAPER};">ATLAS AI</span>
  </div>
  <div style="position:absolute;right:56px;top:58px;font-weight:500;font-size:15px;letter-spacing:.2em;color:${onDark ? 'rgba(245,243,238,.6)' : 'rgba(11,11,13,.5)'};z-index:5;">${n} / 07</div>`;
const foot = (onDark = true) => `
  <div style="position:absolute;left:56px;bottom:46px;font-weight:500;font-size:18px;color:${onDark ? 'rgba(245,243,238,.66)' : 'rgba(11,11,13,.6)'};z-index:5;">@atlas.ai · clipped by @you</div>
  <svg width="42" height="22" viewBox="0 0 52 26" fill="none" style="position:absolute;right:56px;bottom:44px;z-index:5;"><path d="M2 13h46M36 3l12 10-12 10" stroke="${ORANGE}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const chip = (t, bg, col) => `<span style="background:${bg};color:${col};border-radius:999px;padding:8px 15px;font-weight:700;font-size:17px;white-space:nowrap;">${t}</span>`;

const SLIDES = {};

/* 01 COVER — photo + scrim + 2 objects + 3 chips + rule + stacked type */
SLIDES.Cover = page(`
  <img src="bg-rack.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,11,13,.86) 0%,rgba(11,11,13,.35) 44%,rgba(11,11,13,.92) 100%);"></div>
  <div style="position:absolute;left:0;top:0;width:14px;height:100%;background:${ORANGE};"></div>
  ${rail('01')}
  <div style="position:absolute;left:56px;right:56px;top:170px;">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <div style="width:54px;height:3px;background:${LIME};"></div>
      <span style="font-weight:700;font-size:17px;letter-spacing:.2em;color:${LIME};">FREE FOR 14 DAYS</span>
    </div>
    <div style="font-weight:700;font-size:34px;color:rgba(245,243,238,.82);">steal my</div>
    <div style="font-family:Anton,sans-serif;font-size:132px;line-height:.86;color:${PAPER};text-transform:uppercase;">8-WEEK<br><span style="color:${ORANGE};">SPLIT</span></div>
    <div style="margin-top:18px;font-weight:500;font-size:27px;color:rgba(245,243,238,.86);">the one an AI rebuilt after 40,000 sessions</div>
  </div>
  <img src="obj-dumb.png" style="position:absolute;left:34px;top:730px;width:330px;transform:rotate(-9deg);filter:drop-shadow(0 22px 26px rgba(0,0,0,.55));">
  <img src="obj-shoe.png" style="position:absolute;right:16px;top:800px;width:340px;transform:rotate(7deg);filter:drop-shadow(0 22px 26px rgba(0,0,0,.55));">
  <div style="position:absolute;left:56px;right:56px;bottom:130px;display:flex;gap:9px;flex-wrap:wrap;">
    ${chip('40,000 sessions', LIME, INK)}${chip('8 weeks', 'rgba(245,243,238,.14)', PAPER)}${chip('no equipment swaps', 'rgba(245,243,238,.14)', PAPER)}
  </div>
  ${foot()}`);

/* 02 PROBLEM — split ground + photo panel + struck type + 3 bullets + block */
SLIDES.Problem = page(`
  <div style="position:absolute;inset:0;background:${PAPER};"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:52%;background:${INK};"></div>
  <img src="bg-chalk.jpg" style="position:absolute;left:0;top:0;width:100%;height:52%;object-fit:cover;opacity:.5;">
  <div style="position:absolute;left:0;right:0;top:calc(52% - 34px);height:68px;background:${ORANGE};transform:rotate(-1.6deg);"></div>
  ${rail('02')}
  <div style="position:absolute;left:56px;right:56px;top:170px;font-family:Anton,sans-serif;font-size:98px;line-height:.88;color:${PAPER};text-transform:uppercase;">
    YOUR PLAN<br>ISN'T <span style="color:${LIME};">WRONG</span>
  </div>
  <div style="position:absolute;left:56px;right:56px;top:400px;font-weight:500;font-size:29px;color:rgba(245,243,238,.78);">it just stopped fitting you in week three</div>
  <div style="position:absolute;left:56px;right:56px;top:770px;display:flex;flex-direction:column;gap:14px;">
    ${[['You added weight because the sheet said so', '01'], ['Nobody adjusted when you slept 5 hours', '02'], ['Week 6 hurt, so you stopped', '03']].map(([t, n]) => `
      <div style="display:flex;align-items:center;gap:18px;background:#FFF;border:3px solid ${INK};border-radius:16px;padding:18px 22px;box-shadow:8px 8px 0 ${INK};">
        <span style="font-family:Anton,sans-serif;font-size:34px;color:${ORANGE};">${n}</span>
        <span style="font-weight:500;font-size:24px;color:${INK};">${t}</span>
      </div>`).join('')}
  </div>
  <div style="position:absolute;left:56px;right:56px;bottom:120px;font-family:Anton,sans-serif;font-size:40px;color:${INK};text-transform:uppercase;">A SHEET CAN'T SEE YOU.</div>
  ${foot(false)}`);

/* 03 APP — drawn phone UI + object + ring + labels */
SLIDES.App = page(`
  <div style="position:absolute;inset:0;background:${INK};"></div>
  <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(245,243,238,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(245,243,238,.05) 1px,transparent 1px);background-size:52px 52px;"></div>
  <div style="position:absolute;left:-140px;top:300px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(198,242,78,.22),transparent 68%);"></div>
  ${rail('03')}
  <div style="position:absolute;left:56px;right:56px;top:150px;font-family:Anton,sans-serif;font-size:82px;line-height:.9;color:${PAPER};text-transform:uppercase;">IT READS<br>THE <span style="color:${LIME};">SESSION</span></div>

  <div style="position:absolute;right:56px;top:330px;width:330px;height:660px;background:#141419;border:5px solid #2A2A33;border-radius:44px;padding:20px 16px;box-sizing:border-box;box-shadow:0 30px 60px rgba(0,0,0,.6);">
    <div style="font-weight:700;font-size:15px;letter-spacing:.14em;color:${STEEL};">TODAY · PUSH</div>
    <div style="margin-top:14px;background:#1D1D25;border-radius:16px;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-weight:700;font-size:19px;color:${PAPER};">Bench</span>
        <span style="font-family:Anton,sans-serif;font-size:26px;color:${LIME};">4×6</span>
      </div>
      <div style="margin-top:9px;height:7px;border-radius:4px;background:#2C2C36;overflow:hidden;"><div style="width:74%;height:100%;background:${LIME};"></div></div>
    </div>
    <div style="margin-top:11px;background:#1D1D25;border-radius:16px;padding:14px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="font-weight:700;font-size:19px;color:${PAPER};">Incline</span>
        <span style="font-family:Anton,sans-serif;font-size:26px;color:${ORANGE};">−1 set</span>
      </div>
      <div style="margin-top:6px;font-weight:400;font-size:15px;color:${STEEL};">you slept 5h 12m</div>
    </div>
    <div style="margin-top:11px;background:${ORANGE};border-radius:16px;padding:15px;">
      <div style="font-weight:700;font-size:17px;color:#fff;">Auto-deload week 6</div>
      <div style="margin-top:3px;font-weight:400;font-size:14px;color:rgba(255,255,255,.86);">before you feel it</div>
    </div>
    <div style="margin-top:18px;display:flex;gap:8px;">
      ${[62, 88, 44, 96, 70, 52, 80].map((h) => `<div style="flex:1;height:${h}px;border-radius:5px 5px 0 0;background:${h > 78 ? LIME : '#2C2C36'};align-self:flex-end;"></div>`).join('')}
    </div>
    <div style="margin-top:8px;font-weight:500;font-size:13px;color:${STEEL};">LOAD, LAST 7 SESSIONS</div>
  </div>

  <img src="obj-watch.png" style="position:absolute;left:70px;top:520px;width:230px;transform:rotate(-8deg);filter:drop-shadow(0 18px 24px rgba(0,0,0,.6));">
  <div style="position:absolute;left:56px;top:820px;width:300px;display:flex;flex-direction:column;gap:11px;">
    ${[['reads your sleep', LIME], ['drops the set', ORANGE], ['never guesses', PAPER]].map(([t, c]) => `
      <div style="display:flex;align-items:center;gap:11px;"><div style="width:11px;height:11px;border-radius:50%;background:${c};"></div>
      <span style="font-weight:500;font-size:22px;color:rgba(245,243,238,.86);">${t}</span></div>`).join('')}
  </div>
  ${foot()}`);

/* 04 PLAN — 8-week grid + legend + photo strip */
SLIDES.Plan = page(`
  <div style="position:absolute;inset:0;background:${PAPER};"></div>
  <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(11,11,13,.09) 1.4px,transparent 1.4px);background-size:22px 22px;"></div>
  ${rail('04', false)}
  <div style="position:absolute;left:56px;right:56px;top:150px;font-family:Anton,sans-serif;font-size:92px;line-height:.88;color:${INK};text-transform:uppercase;">THE WHOLE<br>EIGHT <span style="color:${ORANGE};">WEEKS</span></div>
  <div style="position:absolute;left:56px;right:56px;top:390px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
    ${[['W1', 'BASE', LIME], ['W2', 'BASE+', LIME], ['W3', 'BUILD', ORANGE], ['W4', 'BUILD+', ORANGE],
       ['W5', 'PEAK', INK], ['W6', 'DELOAD', STEEL], ['W7', 'PEAK', INK], ['W8', 'TEST', ORANGE]]
      .map(([w, l, c]) => `<div style="background:${c};border-radius:14px;padding:20px 14px;text-align:center;">
        <div style="font-family:Anton,sans-serif;font-size:34px;color:${c === LIME || c === STEEL ? INK : '#fff'};">${w}</div>
        <div style="margin-top:4px;font-weight:700;font-size:15px;letter-spacing:.08em;color:${c === LIME || c === STEEL ? 'rgba(11,11,13,.72)' : 'rgba(255,255,255,.86)'};">${l}</div></div>`).join('')}
  </div>
  <img src="bg-plates.jpg" style="position:absolute;left:56px;right:56px;top:690px;width:calc(100% - 112px);height:250px;object-fit:cover;border-radius:18px;">
  <div style="position:absolute;left:56px;right:56px;top:970px;display:flex;gap:9px;flex-wrap:wrap;">
    ${chip('week 6 deloads itself', INK, LIME)}${chip('no missed sessions', '#fff', INK)}${chip('one test day', ORANGE, '#fff')}
  </div>
  <div style="position:absolute;left:56px;right:56px;bottom:110px;font-weight:500;font-size:25px;line-height:1.4;color:rgba(11,11,13,.72);">Every block adjusts to what you actually logged — not what the sheet hoped you would.</div>
  ${foot(false)}`);

/* 05 PROOF — bar chart + big stat + photo + rules */
SLIDES.Proof = page(`
  <div style="position:absolute;inset:0;background:${INK};"></div>
  <img src="bg-track.jpg" style="position:absolute;right:0;top:0;width:46%;height:100%;object-fit:cover;opacity:.34;">
  <div style="position:absolute;inset:0;background:linear-gradient(90deg,${INK} 46%,rgba(11,11,13,.2) 100%);"></div>
  ${rail('05')}
  <div style="position:absolute;left:56px;top:150px;width:560px;font-family:Anton,sans-serif;font-size:78px;line-height:.9;color:${PAPER};text-transform:uppercase;">WHAT 8<br>WEEKS <span style="color:${LIME};">DID</span></div>
  <div style="position:absolute;left:56px;right:56px;top:400px;display:flex;align-items:flex-end;gap:20px;height:300px;">
    ${[['sheet', 42, 'rgba(245,243,238,.24)', '+4%'], ['app', 128, 'rgba(245,243,238,.4)', '+11%'], ['atlas', 250, LIME, '+27%']]
      .map(([l, h, c, v]) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:10px;">
        <span style="font-family:Anton,sans-serif;font-size:${c === LIME ? 46 : 30}px;color:${c === LIME ? LIME : 'rgba(245,243,238,.6)'};">${v}</span>
        <div style="width:100%;height:${h}px;border-radius:10px 10px 0 0;background:${c};"></div>
        <span style="font-weight:${c === LIME ? 700 : 500};font-size:18px;color:${c === LIME ? LIME : 'rgba(245,243,238,.5)'};">${l}</span></div>`).join('')}
  </div>
  <div style="position:absolute;left:56px;right:56px;top:740px;height:2px;background:rgba(245,243,238,.2);"></div>
  <div style="position:absolute;left:56px;top:762px;font-weight:500;font-size:17px;letter-spacing:.14em;color:rgba(245,243,238,.5);">MEDIAN STRENGTH GAIN · 8 WEEKS</div>
  <div style="position:absolute;left:56px;right:56px;top:840px;display:flex;gap:12px;">
    <div style="flex:1;background:rgba(245,243,238,.08);border:2px solid rgba(245,243,238,.18);border-radius:16px;padding:20px;">
      <div style="font-family:Anton,sans-serif;font-size:48px;color:${ORANGE};">0</div>
      <div style="font-weight:500;font-size:18px;color:rgba(245,243,238,.7);">missed deloads</div></div>
    <div style="flex:1;background:rgba(245,243,238,.08);border:2px solid rgba(245,243,238,.18);border-radius:16px;padding:20px;">
      <div style="font-family:Anton,sans-serif;font-size:48px;color:${LIME};">40k</div>
      <div style="font-weight:500;font-size:18px;color:rgba(245,243,238,.7);">sessions read</div></div>
  </div>
  ${foot()}`);

/* 06 GET — object grid with labels */
SLIDES.Get = page(`
  <div style="position:absolute;inset:0;background:${PAPER};"></div>
  <div style="position:absolute;left:0;right:0;top:0;height:230px;background:${ORANGE};"></div>
  ${rail('06', false)}
  <div style="position:absolute;left:56px;right:56px;top:130px;font-family:Anton,sans-serif;font-size:72px;line-height:.9;color:#fff;text-transform:uppercase;">WHAT YOU GET</div>
  <div style="position:absolute;left:56px;right:56px;top:280px;display:grid;grid-template-columns:repeat(2,1fr);gap:14px;">
    <div style="background:#fff;border:3px solid ${INK};border-radius:20px;padding:22px;box-shadow:9px 9px 0 ${INK};display:flex;flex-direction:column;align-items:center;gap:12px;">
      <img src="obj-dumb.png" style="height:150px;">
      <div style="font-family:Anton,sans-serif;font-size:26px;color:${INK};text-transform:uppercase;text-align:center;">Every lift, loaded</div>
    </div>
    <div style="background:${LIME};border:3px solid ${INK};border-radius:20px;padding:22px;box-shadow:9px 9px 0 ${INK};display:flex;flex-direction:column;align-items:center;gap:12px;">
      <img src="obj-watch.png" style="height:150px;">
      <div style="font-family:Anton,sans-serif;font-size:26px;color:${INK};text-transform:uppercase;text-align:center;">Reads your sleep</div>
    </div>
    <div style="background:${INK};border:3px solid ${INK};border-radius:20px;padding:22px;box-shadow:9px 9px 0 ${ORANGE};display:flex;flex-direction:column;align-items:center;gap:12px;">
      <img src="obj-shoe.png" style="height:150px;">
      <div style="font-family:Anton,sans-serif;font-size:26px;color:${PAPER};text-transform:uppercase;text-align:center;">Works anywhere</div>
    </div>
    <div style="background:#fff;border:3px solid ${INK};border-radius:20px;padding:22px;box-shadow:9px 9px 0 ${INK};display:flex;flex-direction:column;justify-content:center;gap:8px;">
      <div style="font-family:Anton,sans-serif;font-size:76px;line-height:.9;color:${ORANGE};">14</div>
      <div style="font-family:Anton,sans-serif;font-size:26px;color:${INK};text-transform:uppercase;">days free</div>
      <div style="font-weight:500;font-size:18px;color:rgba(11,11,13,.6);">no card, cancel in the app</div>
    </div>
  </div>
  <div style="position:absolute;left:56px;right:56px;bottom:112px;display:flex;gap:9px;flex-wrap:wrap;">
    ${chip('iOS + Android', INK, PAPER)}${chip('no ads', '#fff', INK)}${chip('offline logging', LIME, INK)}
  </div>
  ${foot(false)}`);

/* 07 CTA — photo + block + button + badges */
SLIDES.Cta = page(`
  <img src="bg-mirror.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,11,13,.72),rgba(11,11,13,.94));"></div>
  ${rail('07')}
  <div style="position:absolute;left:56px;right:56px;top:230px;text-align:center;">
    <div style="font-weight:700;font-size:30px;color:${LIME};margin-bottom:14px;">14 days free</div>
    <div style="font-family:Anton,sans-serif;font-size:112px;line-height:.88;color:${PAPER};text-transform:uppercase;">TAKE THE<br>WHOLE<br>SPLIT</div>
    <div style="margin-top:26px;font-weight:500;font-size:27px;color:rgba(245,243,238,.8);">Save this, then start week one tomorrow.</div>
    <div style="margin-top:40px;display:inline-flex;align-items:center;gap:14px;background:${ORANGE};border-radius:999px;padding:22px 40px;">
      <span style="font-family:Anton,sans-serif;font-size:32px;color:#fff;text-transform:uppercase;">Get Atlas AI</span>
      <svg width="30" height="18" viewBox="0 0 52 26" fill="none"><path d="M2 13h46M36 3l12 10-12 10" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </div>
  <img src="obj-shoe.png" style="position:absolute;left:20px;bottom:150px;width:300px;transform:rotate(-12deg);opacity:.95;filter:drop-shadow(0 20px 24px rgba(0,0,0,.6));">
  <img src="obj-dumb.png" style="position:absolute;right:14px;bottom:170px;width:290px;transform:rotate(10deg);opacity:.95;filter:drop-shadow(0 20px 24px rgba(0,0,0,.6));">
  <div style="position:absolute;left:56px;right:56px;bottom:104px;display:flex;justify-content:center;gap:9px;">
    ${chip('40,000 sessions', 'rgba(245,243,238,.14)', PAPER)}${chip('8 weeks', 'rgba(245,243,238,.14)', PAPER)}
  </div>
  ${foot()}`);

const order = ['Cover', 'Problem', 'App', 'Plan', 'Proof', 'Get', 'Cta'];
const artboards = [];
order.forEach((k, i) => {
  const file = k === 'Cover' ? 'Main.dc.html' : `${k}.dc.html`;
  fs.writeFileSync(file, SLIDES[k]);
  artboards.push({ file, x: (i % 4) * 1240, y: Math.floor(i / 4) * 1560, w: 1080, h: 1350,
    title: `${String(i + 1).padStart(2, '0')} ${k}` });
});
fs.writeFileSync('canvas.json', JSON.stringify({ artboards, launch: { view: 'canvas' } }, null, 2));
console.log(`${artboards.length} slides written`);
