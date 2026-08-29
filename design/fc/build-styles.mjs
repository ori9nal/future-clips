// Emit two artboards per named design style.
//
// Styles are DATA here for the same reason templates are data in the engine:
// the point is that "Y2K" and "Victorian" are different systems, not different
// colour values on one system. Each entry owns its palette, its type pairing,
// its ground and its ornament.
import fs from 'node:fs';

const FONTS = (families) =>
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=swap">`;

const wrap = (fontLink, body, linkCol = '#0E0E10') => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  ${fontLink}
  <style> body { margin: 0; } a { color: ${linkCol}; } a:hover { opacity: .8; } </style>
</helmet>
<div style="position:relative;width:1080px;height:1350px;overflow:hidden;">
${body}
</div>
</x-dc>
</body>
</html>
`;

// every slide carries the handle so a set always reads as one account
const foot = (col, op = 0.7, font = "'Space Grotesk',system-ui,sans-serif") =>
  `<div style="position:absolute;left:62px;bottom:52px;font-family:${font};font-weight:600;font-size:20px;color:${col};opacity:${op};">@thefutureclips</div>`;
const arrow = (col) =>
  `<svg width="46" height="24" viewBox="0 0 52 26" fill="none" style="position:absolute;right:62px;bottom:50px;"><path d="M2 13h46M36 3l12 10-12 10" stroke="${col}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const tag = (t, col, bg) =>
  `<div style="position:absolute;left:62px;top:56px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:15px;letter-spacing:.18em;color:${col};background:${bg};padding:8px 16px;border-radius:999px;">${t}</div>`;

const STYLES = [];
const S = (id, name, fonts, a, b) => STYLES.push({ id, name, fonts, a, b });

/* 1 MINIMALISM ------------------------------------------------------------ */
S('Minimalism', 'Minimalism', FONTS('family=Inter:wght@300;400;500'),
  `<div style="position:absolute;inset:0;background:#FBFBF9;"></div>
   <div style="position:absolute;left:120px;top:120px;width:8px;height:8px;border-radius:50%;background:#0E0E10;"></div>
   <div style="position:absolute;left:120px;right:120px;top:598px;height:1px;background:#0E0E10;opacity:.18;"></div>
   <div style="position:absolute;left:120px;right:200px;top:640px;font-family:Inter,sans-serif;font-weight:300;font-size:64px;line-height:1.14;letter-spacing:-.03em;color:#0E0E10;">Two minutes.<br>Thirty-five slides.</div>
   <div style="position:absolute;left:120px;top:880px;font-family:Inter,sans-serif;font-weight:400;font-size:20px;letter-spacing:.02em;color:#0E0E10;opacity:.5;">the future clips</div>
   ${foot('#0E0E10', .45, 'Inter,sans-serif')}`,
  `<div style="position:absolute;inset:0;background:#0E0E10;"></div>
   <div style="position:absolute;left:120px;top:120px;width:8px;height:8px;border-radius:50%;background:#FBFBF9;"></div>
   <div style="position:absolute;left:120px;right:120px;top:52%;font-family:Inter,sans-serif;font-weight:300;font-size:150px;line-height:.9;letter-spacing:-.05em;color:#FBFBF9;">35</div>
   <div style="position:absolute;left:120px;top:calc(52% + 170px);font-family:Inter,sans-serif;font-weight:400;font-size:22px;letter-spacing:.16em;color:#FBFBF9;opacity:.5;">SLIDES / MONTH</div>
   ${foot('#FBFBF9', .4, 'Inter,sans-serif')}`);

/* 2 MAXIMALISM ------------------------------------------------------------ */
S('Maximalism', 'Maximalism', FONTS('family=Archivo+Black&family=DM+Serif+Display:ital@0;1&family=Space+Grotesk:wght@700'),
  `<div style="position:absolute;inset:0;background:#FF3D6E;"></div>
   <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.14) 0 14px,transparent 14px 28px);"></div>
   <div style="position:absolute;left:-60px;top:180px;width:1200px;height:210px;background:#22D3EE;transform:rotate(-7deg);"></div>
   <div style="position:absolute;left:-40px;top:640px;width:1200px;height:150px;background:#FFE500;transform:rotate(5deg);"></div>
   <div style="position:absolute;right:40px;top:70px;width:210px;height:210px;border-radius:50%;background:#7C3AED;"></div>
   <div style="position:absolute;left:60px;top:206px;font-family:'Archivo Black',sans-serif;font-size:104px;line-height:.86;color:#0E0E10;transform:rotate(-7deg);">POST<br>LOUDER</div>
   <div style="position:absolute;left:70px;top:660px;font-family:'DM Serif Display',serif;font-style:italic;font-size:92px;color:#0E0E10;transform:rotate(5deg);">or don't post</div>
   <div style="position:absolute;left:62px;top:900px;right:62px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;line-height:1.3;color:#FFF;">35 slides. 4 platforms. 1 brand kit. Zero excuses left.</div>
   <div style="position:absolute;left:62px;top:1080px;display:flex;gap:10px;">
     <span style="background:#0E0E10;color:#FFE500;font-family:'Archivo Black',sans-serif;font-size:26px;padding:10px 18px;border-radius:999px;">FAST</span>
     <span style="background:#22D3EE;color:#0E0E10;font-family:'Archivo Black',sans-serif;font-size:26px;padding:10px 18px;border-radius:999px;">LOUD</span>
     <span style="background:#FFF;color:#FF3D6E;font-family:'Archivo Black',sans-serif;font-size:26px;padding:10px 18px;border-radius:999px;">PAID</span>
   </div>
   ${foot('#FFF', .9)}`,
  `<div style="position:absolute;inset:0;background:#7C3AED;"></div>
   <div style="position:absolute;inset:0;background-image:radial-gradient(#FFE500 3px,transparent 3px);background-size:34px 34px;opacity:.5;"></div>
   <div style="position:absolute;left:50px;top:120px;width:460px;height:460px;background:#22D3EE;transform:rotate(8deg);"></div>
   <div style="position:absolute;left:250px;top:300px;width:460px;height:460px;background:#FF3D6E;transform:rotate(-6deg);"></div>
   <div style="position:absolute;left:120px;top:400px;font-family:'Archivo Black',sans-serif;font-size:150px;line-height:.82;color:#0E0E10;">MORE<br>IS<br>MORE</div>
   <div style="position:absolute;left:62px;bottom:150px;right:62px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:32px;color:#FFE500;">Nobody ever saved a quiet carousel.</div>
   ${foot('#FFF', .9)}`);

/* 3 FUTURISTIC ------------------------------------------------------------ */
S('Futuristic', 'Futuristic', FONTS('family=Orbitron:wght@500;800&family=Space+Grotesk:wght@400;500'),
  `<div style="position:absolute;inset:0;background:radial-gradient(120% 90% at 50% 8%,#12213D 0%,#05060B 62%);"></div>
   <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(80,220,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(80,220,255,.09) 1px,transparent 1px);background-size:60px 60px;"></div>
   <div style="position:absolute;left:50%;top:300px;margin-left:-260px;width:520px;height:520px;border:1.5px solid rgba(80,220,255,.5);border-radius:50%;"></div>
   <div style="position:absolute;left:50%;top:360px;margin-left:-200px;width:400px;height:400px;border:1.5px solid rgba(80,220,255,.3);border-radius:50%;"></div>
   <div style="position:absolute;left:50%;top:500px;margin-left:-120px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(80,220,255,.9),rgba(80,220,255,0) 70%);"></div>
   ${tag('SYSTEM ONLINE', '#7FE9FF', 'rgba(80,220,255,.12)')}
   <div style="position:absolute;left:62px;right:62px;top:860px;text-align:center;font-family:Orbitron,sans-serif;font-weight:800;font-size:78px;line-height:.98;letter-spacing:.02em;color:#EAF6FF;">CAROUSEL<br>ENGINE</div>
   <div style="position:absolute;left:62px;right:62px;top:1030px;text-align:center;font-family:'Space Grotesk',sans-serif;font-size:24px;letter-spacing:.24em;color:#7FE9FF;">IDEA IN &nbsp;/&nbsp; SLIDES OUT</div>
   ${foot('#7FE9FF', .8)}${arrow('#7FE9FF')}`,
  `<div style="position:absolute;inset:0;background:#05060B;"></div>
   <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(80,220,255,.07) 1px,transparent 1px);background-size:100% 5px;"></div>
   <div style="position:absolute;left:62px;top:150px;font-family:Orbitron,sans-serif;font-weight:800;font-size:150px;line-height:.86;color:transparent;-webkit-text-stroke:2px #7FE9FF;">02:00</div>
   <div style="position:absolute;left:62px;top:430px;font-family:Orbitron,sans-serif;font-weight:500;font-size:34px;letter-spacing:.2em;color:#EAF6FF;">RENDER TIME</div>
   <div style="position:absolute;left:62px;right:62px;top:540px;height:1px;background:linear-gradient(90deg,#7FE9FF,transparent);"></div>
   <div style="position:absolute;left:62px;right:62px;top:600px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
     ${['FIT OK', 'RULES OK', 'SAFE OK'].map((t) => `<div style="border:1px solid rgba(80,220,255,.4);padding:20px;font-family:Orbitron,sans-serif;font-size:20px;letter-spacing:.1em;color:#7FE9FF;text-align:center;">${t}</div>`).join('')}
   </div>
   <div style="position:absolute;left:62px;right:62px;bottom:190px;font-family:'Space Grotesk',sans-serif;font-size:28px;line-height:1.44;color:rgba(234,246,255,.72);">Every slide is measured before it renders. Nothing ships that overflows its frame.</div>
   ${foot('#7FE9FF', .8)}`);

/* 4 VECTOR ART ------------------------------------------------------------ */
S('VectorArt', 'Vector art', FONTS('family=Poppins:wght@600;800'),
  `<div style="position:absolute;inset:0;background:#FFF3E0;"></div>
   <svg viewBox="0 0 1080 1350" style="position:absolute;inset:0;width:100%;height:100%;">
     <circle cx="880" cy="200" r="150" fill="#FFB020"/>
     <path d="M0 980 Q270 830 540 980 T1080 980 V1350 H0Z" fill="#2E9E6B"/>
     <path d="M0 1080 Q270 940 540 1080 T1080 1080 V1350 H0Z" fill="#1F7A52"/>
     <rect x="120" y="640" width="200" height="300" rx="24" fill="#E45B3C"/>
     <rect x="340" y="560" width="200" height="380" rx="24" fill="#2B4C7E"/>
     <rect x="560" y="700" width="200" height="240" rx="24" fill="#FFB020"/>
     <circle cx="220" cy="600" r="34" fill="#2B4C7E"/>
     <circle cx="440" cy="520" r="34" fill="#E45B3C"/>
     <circle cx="660" cy="660" r="34" fill="#2E9E6B"/>
   </svg>
   <div style="position:absolute;left:62px;top:150px;font-family:Poppins,sans-serif;font-weight:800;font-size:96px;line-height:.94;color:#2B4C7E;">Build the<br>whole week</div>
   <div style="position:absolute;left:62px;top:400px;font-family:Poppins,sans-serif;font-weight:600;font-size:28px;color:#1F7A52;">in one sitting</div>
   ${foot('#2B4C7E', .8, 'Poppins,sans-serif')}`,
  `<div style="position:absolute;inset:0;background:#2B4C7E;"></div>
   <svg viewBox="0 0 1080 1350" style="position:absolute;inset:0;width:100%;height:100%;">
     <path d="M540 300 L760 700 H320Z" fill="#FFB020"/>
     <circle cx="540" cy="760" r="150" fill="#E45B3C"/>
     <rect x="390" y="880" width="300" height="120" rx="60" fill="#2E9E6B"/>
   </svg>
   <div style="position:absolute;left:62px;right:62px;bottom:210px;text-align:center;font-family:Poppins,sans-serif;font-weight:800;font-size:70px;line-height:1;color:#FFF3E0;">Shapes beat<br>stock photos</div>
   ${foot('#FFF3E0', .75, 'Poppins,sans-serif')}`);

/* 5 COLLAGE --------------------------------------------------------------- */
S('Collage', 'Collage art', FONTS('family=Archivo+Black&family=Space+Grotesk:wght@400;700'),
  `<div style="position:absolute;inset:0;background:#EDE7DA;"></div>
   <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(0,0,0,.06) 1px,transparent 1px);background-size:6px 6px;"></div>
   <img src="c5.jpg" style="position:absolute;left:70px;top:250px;width:300px;transform:rotate(-8deg);border:9px solid #FFF;box-shadow:0 14px 30px rgba(0,0,0,.24);">
   <img src="c2.jpg" style="position:absolute;left:400px;top:190px;width:270px;transform:rotate(5deg);border:9px solid #FFF;box-shadow:0 14px 30px rgba(0,0,0,.24);">
   <img src="c7.jpg" style="position:absolute;left:680px;top:300px;width:290px;transform:rotate(-4deg);border:9px solid #FFF;box-shadow:0 14px 30px rgba(0,0,0,.24);">
   <div style="position:absolute;left:250px;top:200px;width:150px;height:40px;background:rgba(255,240,180,.86);transform:rotate(-6deg);"></div>
   <div style="position:absolute;left:620px;top:620px;width:150px;height:40px;background:rgba(255,240,180,.86);transform:rotate(8deg);"></div>
   <div style="position:absolute;left:62px;top:760px;right:62px;font-family:'Archivo Black',sans-serif;font-size:96px;line-height:.9;color:#1A1A1A;">CUT.<br>PASTE.<br><span style="background:#FF3D6E;color:#FFF;padding:0 12px;">POST.</span></div>
   ${foot('#1A1A1A', .7)}`,
  `<div style="position:absolute;inset:0;background:#1A1A1A;"></div>
   <img src="c3.jpg" style="position:absolute;left:60px;top:120px;width:340px;transform:rotate(4deg);border:8px solid #EDE7DA;">
   <img src="c6.jpg" style="position:absolute;right:60px;top:380px;width:340px;transform:rotate(-6deg);border:8px solid #EDE7DA;">
   <div style="position:absolute;left:70px;top:640px;width:420px;height:230px;background:#FFE500;transform:rotate(-3deg);"></div>
   <div style="position:absolute;left:96px;top:690px;width:380px;font-family:'Archivo Black',sans-serif;font-size:54px;line-height:.94;color:#1A1A1A;transform:rotate(-3deg);">TORN FROM<br>THE FEED</div>
   <div style="position:absolute;left:62px;right:62px;bottom:170px;font-family:'Space Grotesk',sans-serif;font-weight:400;font-size:27px;line-height:1.44;color:rgba(237,231,218,.8);">Scraps, screenshots and real objects beat one clean render every time.</div>
   ${foot('#EDE7DA', .7)}`);

/* 6 RETRO ----------------------------------------------------------------- */
S('Retro', 'Retro', FONTS('family=Bree+Serif&family=Space+Grotesk:wght@500;700'),
  `<div style="position:absolute;inset:0;background:#F3E2C7;"></div>
   <svg viewBox="0 0 1080 1350" style="position:absolute;inset:0;width:100%;height:100%;">
     ${Array.from({ length: 9 }, (_, i) => `<path d="M540 470 L${540 + Math.cos((i * 20 - 80) * Math.PI / 180) * 900} ${470 + Math.sin((i * 20 - 80) * Math.PI / 180) * 900} L${540 + Math.cos((i * 20 - 70) * Math.PI / 180) * 900} ${470 + Math.sin((i * 20 - 70) * Math.PI / 180) * 900}Z" fill="${i % 2 ? '#E9A23B' : '#D9642F'}" opacity=".5"/>`).join('')}
     <circle cx="540" cy="470" r="220" fill="#D9642F"/>
     <circle cx="540" cy="470" r="180" fill="#E9A23B"/>
   </svg>
   <div style="position:absolute;left:62px;right:62px;top:390px;text-align:center;font-family:'Bree Serif',serif;font-size:78px;line-height:.98;color:#5A2E17;">GOOD<br>MORNING</div>
   <div style="position:absolute;left:62px;right:62px;top:800px;text-align:center;font-family:'Bree Serif',serif;font-size:62px;line-height:1.02;color:#5A2E17;">Your week of<br>content is done</div>
   <div style="position:absolute;left:62px;right:62px;top:1010px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:25px;letter-spacing:.16em;color:#8A5230;">EST. TWO MINUTES</div>
   ${foot('#5A2E17', .65)}`,
  `<div style="position:absolute;inset:0;background:#5A2E17;"></div>
   <div style="position:absolute;inset:40px;border:5px solid #E9A23B;border-radius:26px;"></div>
   <div style="position:absolute;left:100px;right:100px;top:240px;text-align:center;font-family:'Bree Serif',serif;font-size:130px;line-height:.9;color:#F3E2C7;">35</div>
   <div style="position:absolute;left:100px;right:100px;top:410px;text-align:center;font-family:'Bree Serif',serif;font-size:46px;color:#E9A23B;">slides a month</div>
   <div style="position:absolute;left:180px;right:180px;top:520px;height:4px;background:#E9A23B;"></div>
   <div style="position:absolute;left:100px;right:100px;top:580px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:27px;line-height:1.5;color:rgba(243,226,199,.82);">No filming day. No designer. No waiting on a brief that never comes back.</div>
   ${foot('#F3E2C7', .6)}`);

/* 7 CYBERPUNK ------------------------------------------------------------- */
S('Cyberpunk', 'Cyberpunk', FONTS('family=Rajdhani:wght@600;700&family=Space+Grotesk:wght@500'),
  `<div style="position:absolute;inset:0;background:#07020F;"></div>
   <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:100% 4px;"></div>
   <div style="position:absolute;left:-100px;top:420px;width:1300px;height:8px;background:#FF2E88;box-shadow:0 0 30px #FF2E88;"></div>
   <div style="position:absolute;left:-100px;top:900px;width:1300px;height:4px;background:#00F0FF;box-shadow:0 0 24px #00F0FF;"></div>
   ${tag('// NIGHT SHIFT', '#00F0FF', 'rgba(0,240,255,.1)')}
   <div style="position:absolute;left:62px;top:480px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:126px;line-height:.9;color:#F2E9FF;text-transform:uppercase;">POST<br>WHILE<br>THEY<br>SLEEP</div>
   <div style="position:absolute;left:66px;top:484px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:126px;line-height:.9;color:#FF2E88;opacity:.55;text-transform:uppercase;mix-blend-mode:screen;">POST<br>WHILE<br>THEY<br>SLEEP</div>
   <div style="position:absolute;left:62px;right:62px;bottom:150px;font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:26px;color:#00F0FF;">QUEUE 35 · RENDER 00:02 · DRIFT 00.0%</div>
   ${foot('#F2E9FF', .6)}`,
  `<div style="position:absolute;inset:0;background:#07020F;"></div>
   <div style="position:absolute;left:0;right:0;top:0;height:56%;background:linear-gradient(180deg,rgba(255,46,136,.28),transparent);"></div>
   <div style="position:absolute;left:50%;top:180px;margin-left:-230px;width:460px;height:460px;border:2px solid #FF2E88;transform:rotate(45deg);box-shadow:0 0 40px rgba(255,46,136,.6),inset 0 0 40px rgba(255,46,136,.3);"></div>
   <div style="position:absolute;left:50%;top:300px;margin-left:-110px;width:220px;height:220px;background:#00F0FF;transform:rotate(45deg);opacity:.9;"></div>
   <div style="position:absolute;left:62px;right:62px;top:760px;text-align:center;font-family:Rajdhani,sans-serif;font-weight:700;font-size:92px;line-height:.94;color:#F2E9FF;text-transform:uppercase;">One kit.<br><span style="color:#FF2E88;">Zero drift.</span></div>
   <div style="position:absolute;left:62px;right:62px;top:1010px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:500;font-size:24px;letter-spacing:.2em;color:#00F0FF;">LOCKED AT CAMPAIGN LEVEL</div>
   ${foot('#F2E9FF', .55)}`);

/* 8 POP ART --------------------------------------------------------------- */
S('PopArt', 'Pop art', FONTS('family=Archivo+Black&family=Space+Grotesk:wght@700'),
  `<div style="position:absolute;inset:0;background:#FFE500;"></div>
   <div style="position:absolute;inset:0;background-image:radial-gradient(#E8232A 5px,transparent 5px);background-size:30px 30px;opacity:.35;"></div>
   <div style="position:absolute;left:60px;top:150px;right:60px;background:#FFF;border:7px solid #0E0E10;border-radius:26px;padding:34px 32px;box-shadow:14px 14px 0 #0E0E10;">
     <div style="font-family:'Archivo Black',sans-serif;font-size:82px;line-height:.92;color:#0E0E10;">POW!<br>35 SLIDES</div>
     <div style="margin-top:16px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:28px;color:#E8232A;">…in the time it took to read this</div>
   </div>
   <svg viewBox="0 0 400 300" style="position:absolute;left:50%;bottom:190px;margin-left:-200px;width:400px;">
     <path d="M40 40 L360 20 L340 200 L120 210 L60 260Z" fill="#00A8E8" stroke="#0E0E10" stroke-width="8" stroke-linejoin="round"/>
     <text x="200" y="120" text-anchor="middle" font-family="Archivo Black" font-size="54" fill="#FFF">BOOM</text>
   </svg>
   ${foot('#0E0E10', .8)}`,
  `<div style="position:absolute;inset:0;background:#00A8E8;"></div>
   <div style="position:absolute;inset:0;background-image:radial-gradient(#0E0E10 4px,transparent 4px);background-size:26px 26px;opacity:.25;"></div>
   <div style="position:absolute;left:0;right:0;top:300px;height:280px;background:#E8232A;border-top:8px solid #0E0E10;border-bottom:8px solid #0E0E10;"></div>
   <div style="position:absolute;left:62px;right:62px;top:350px;text-align:center;font-family:'Archivo Black',sans-serif;font-size:110px;line-height:.9;color:#FFE500;-webkit-text-stroke:5px #0E0E10;">SAVE IT</div>
   <div style="position:absolute;left:62px;right:62px;top:680px;text-align:center;font-family:'Archivo Black',sans-serif;font-size:60px;line-height:1;color:#FFF;">then steal the<br>whole system</div>
   ${foot('#FFF', .85)}${arrow('#FFE500')}`);

/* 9 GLASSMORPHISM --------------------------------------------------------- */
S('Glass', 'Glass morphism', FONTS('family=Manrope:wght@400;600;800'),
  `<div style="position:absolute;inset:0;background:linear-gradient(150deg,#5B2BE0 0%,#C02BA8 46%,#FF7A45 100%);"></div>
   <div style="position:absolute;left:-80px;top:120px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.28);filter:blur(10px);"></div>
   <div style="position:absolute;right:-60px;top:520px;width:360px;height:360px;border-radius:50%;background:rgba(255,220,120,.4);filter:blur(14px);"></div>
   <div style="position:absolute;left:70px;right:70px;top:330px;background:rgba(255,255,255,.16);border:1.5px solid rgba(255,255,255,.4);border-radius:30px;backdrop-filter:blur(24px);padding:44px 40px;">
     <div style="font-family:Manrope,sans-serif;font-weight:800;font-size:74px;line-height:.98;color:#FFF;letter-spacing:-.03em;">Clear enough<br>to see through</div>
     <div style="margin-top:22px;font-family:Manrope,sans-serif;font-weight:400;font-size:26px;line-height:1.45;color:rgba(255,255,255,.85);">Every rule the campaign set, checked and shown before you post.</div>
   </div>
   <div style="position:absolute;left:70px;right:70px;top:760px;display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">
     ${['HANDLE', 'CLAIMS', 'CANVAS'].map((t) => `<div style="background:rgba(255,255,255,.14);border:1.5px solid rgba(255,255,255,.34);border-radius:18px;backdrop-filter:blur(18px);padding:22px 16px;text-align:center;font-family:Manrope,sans-serif;font-weight:600;font-size:20px;color:#FFF;">${t}<div style="margin-top:8px;font-size:26px;">✓</div></div>`).join('')}
   </div>
   ${foot('#FFF', .8, 'Manrope,sans-serif')}`,
  `<div style="position:absolute;inset:0;background:linear-gradient(200deg,#0B1B3F 0%,#2B1B6B 55%,#7A2BA8 100%);"></div>
   <div style="position:absolute;left:120px;top:180px;width:340px;height:340px;border-radius:50%;background:rgba(120,200,255,.5);filter:blur(20px);"></div>
   <div style="position:absolute;left:60px;right:60px;top:420px;background:rgba(255,255,255,.1);border:1.5px solid rgba(255,255,255,.3);border-radius:34px;backdrop-filter:blur(28px);padding:56px 44px;text-align:center;">
     <div style="font-family:Manrope,sans-serif;font-weight:800;font-size:132px;line-height:.9;color:#FFF;">2:00</div>
     <div style="margin-top:14px;font-family:Manrope,sans-serif;font-weight:600;font-size:24px;letter-spacing:.16em;color:rgba(255,255,255,.7);">IDEA TO EXPORT</div>
   </div>
   ${foot('#FFF', .75, 'Manrope,sans-serif')}`);

/* 10 CLAY ----------------------------------------------------------------- */
S('Clay', 'Clay style', FONTS('family=Baloo+2:wght@600;800'),
  `<div style="position:absolute;inset:0;background:#F0E9FF;"></div>
   <div style="position:absolute;left:110px;top:210px;width:300px;height:300px;border-radius:80px;background:#B9A6FF;box-shadow:18px 18px 40px rgba(120,90,200,.35),inset -10px -10px 20px rgba(90,60,180,.28),inset 10px 10px 20px rgba(255,255,255,.6);transform:rotate(-8deg);"></div>
   <div style="position:absolute;left:420px;top:330px;width:260px;height:260px;border-radius:50%;background:#FFB3C7;box-shadow:16px 16px 34px rgba(200,110,140,.32),inset -8px -8px 18px rgba(190,90,120,.3),inset 8px 8px 18px rgba(255,255,255,.7);"></div>
   <div style="position:absolute;left:660px;top:200px;width:280px;height:280px;border-radius:70px;background:#9BE7C4;box-shadow:16px 16px 34px rgba(80,170,130,.32),inset -8px -8px 18px rgba(60,150,110,.3),inset 8px 8px 18px rgba(255,255,255,.7);transform:rotate(10deg);"></div>
   <div style="position:absolute;left:62px;right:62px;top:700px;text-align:center;font-family:'Baloo 2',cursive;font-weight:800;font-size:92px;line-height:1;color:#4A3B7A;">Soft on you,<br>hard on the feed</div>
   <div style="position:absolute;left:62px;right:62px;top:940px;text-align:center;font-family:'Baloo 2',cursive;font-weight:600;font-size:30px;color:#7A6BA8;">Set the brand once. Squash out 35 slides.</div>
   ${foot('#4A3B7A', .6, "'Baloo 2',cursive")}`,
  `<div style="position:absolute;inset:0;background:#FFF0E6;"></div>
   <div style="position:absolute;left:50%;top:260px;margin-left:-210px;width:420px;height:420px;border-radius:120px;background:#FF9E6B;box-shadow:22px 22px 46px rgba(210,120,70,.35),inset -12px -12px 24px rgba(200,100,50,.3),inset 12px 12px 24px rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;font-family:'Baloo 2',cursive;font-weight:800;font-size:150px;color:#FFF;">2</div>
   <div style="position:absolute;left:62px;right:62px;top:790px;text-align:center;font-family:'Baloo 2',cursive;font-weight:800;font-size:76px;line-height:1.02;color:#7A4A2E;">minutes, start<br>to finished set</div>
   ${foot('#7A4A2E', .6, "'Baloo 2',cursive")}`);

/* 11 PIXEL ---------------------------------------------------------------- */
S('Pixel', 'Pixel art', FONTS('family=Press+Start+2P&family=Space+Grotesk:wght@500'),
  `<div style="position:absolute;inset:0;background:#0B1021;"></div>
   <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:24px 24px;"></div>
   <div style="position:absolute;left:62px;top:130px;font-family:'Press Start 2P',monospace;font-size:44px;line-height:1.5;color:#7CF77C;">PRESS<br>POST</div>
   <svg viewBox="0 0 240 240" style="position:absolute;left:50%;top:400px;margin-left:-120px;width:300px;image-rendering:pixelated;">
     ${[[4, 2, '#FFD93D'], [5, 2, '#FFD93D'], [3, 3, '#FFD93D'], [4, 3, '#FF6B6B'], [5, 3, '#FF6B6B'], [6, 3, '#FFD93D'], [3, 4, '#FF6B6B'], [4, 4, '#FF6B6B'], [5, 4, '#FF6B6B'], [6, 4, '#FF6B6B'], [2, 5, '#4D96FF'], [3, 5, '#FF6B6B'], [4, 5, '#FF6B6B'], [5, 5, '#FF6B6B'], [6, 5, '#FF6B6B'], [7, 5, '#4D96FF'], [3, 6, '#4D96FF'], [4, 6, '#4D96FF'], [5, 6, '#4D96FF'], [6, 6, '#4D96FF'], [4, 7, '#4D96FF'], [5, 7, '#4D96FF']].map(([x, y, c]) => `<rect x="${x * 26}" y="${y * 26}" width="26" height="26" fill="${c}"/>`).join('')}
   </svg>
   <div style="position:absolute;left:62px;right:62px;top:820px;font-family:'Press Start 2P',monospace;font-size:19px;line-height:2;color:#FFF;">SLIDES ....... 35<br>TIME ......... 02:00<br>DRIFT ........ 00.0%</div>
   <div style="position:absolute;left:62px;right:62px;bottom:140px;font-family:'Press Start 2P',monospace;font-size:15px;color:#7CF77C;">&gt; INSERT IDEA TO CONTINUE</div>
   ${foot('#7CF77C', .7)}`,
  `<div style="position:absolute;inset:0;background:#7CF77C;"></div>
   <div style="position:absolute;left:60px;right:60px;top:200px;background:#0B1021;border:8px solid #0B1021;padding:50px 40px;box-shadow:18px 18px 0 rgba(11,16,33,.35);">
     <div style="font-family:'Press Start 2P',monospace;font-size:34px;line-height:1.7;color:#FFD93D;">LEVEL UP</div>
     <div style="margin-top:26px;font-family:'Press Start 2P',monospace;font-size:17px;line-height:2.1;color:#FFF;">FROM 4 SLIDES<br>TO 35 SLIDES<br>PER HOUR</div>
   </div>
   <div style="position:absolute;left:60px;right:60px;top:760px;display:flex;gap:10px;flex-wrap:wrap;">
     ${Array.from({ length: 24 }, (_, i) => `<div style="width:64px;height:64px;background:${i < 20 ? '#0B1021' : 'rgba(11,16,33,.2)'};"></div>`).join('')}
   </div>
   ${foot('#0B1021', .7)}`);

/* 12 EDITORIAL ------------------------------------------------------------ */
S('Editorial', 'Editorial', FONTS('family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Inter:wght@400;600'),
  `<div style="position:absolute;inset:0;background:#F7F5F0;"></div>
   <div style="position:absolute;left:62px;right:62px;top:56px;display:flex;justify-content:space-between;font-family:Inter,sans-serif;font-weight:600;font-size:15px;letter-spacing:.22em;color:#8A867C;border-bottom:1px solid #D8D4C8;padding-bottom:14px;"><span>THE FUTURE CLIPS</span><span>ISSUE 01</span></div>
   <div style="position:absolute;left:62px;right:62px;top:170px;font-family:'Playfair Display',serif;font-weight:900;font-size:124px;line-height:.9;letter-spacing:-.03em;color:#141310;">The quiet<br>case for<br><span style="font-style:italic;font-weight:700;">volume</span></div>
   <div style="position:absolute;left:62px;right:62px;top:660px;height:1px;background:#D8D4C8;"></div>
   <div style="position:absolute;left:62px;top:700px;width:47%;font-family:Inter,sans-serif;font-size:23px;line-height:1.62;color:#3A3833;">You are paid per thousand views, which means the only variable you control is how many honest attempts you get to make this month.</div>
   <div style="position:absolute;right:62px;top:700px;width:41%;font-family:Inter,sans-serif;font-size:23px;line-height:1.62;color:#3A3833;">Four carefully made posts lose to thirty-five that are merely good. That is not an argument for slop. It is an argument for a system.</div>
   ${foot('#141310', .55, 'Inter,sans-serif')}`,
  `<div style="position:absolute;inset:0;background:#141310;"></div>
   <div style="position:absolute;left:62px;right:62px;top:220px;font-family:'Playfair Display',serif;font-style:italic;font-weight:700;font-size:96px;line-height:1.04;color:#F7F5F0;">“The craft floor<br>is low. The idea<br>ceiling is<br>everything.”</div>
   <div style="position:absolute;left:62px;top:800px;width:80px;height:2px;background:#C9A227;"></div>
   <div style="position:absolute;left:62px;top:840px;font-family:Inter,sans-serif;font-weight:600;font-size:21px;letter-spacing:.14em;color:#C9A227;">WHAT WE BUILD AROUND</div>
   ${foot('#F7F5F0', .5, 'Inter,sans-serif')}`);

/* 13 Y2K ------------------------------------------------------------------ */
S('Y2K', 'Y2K', FONTS('family=Bungee&family=Space+Grotesk:wght@500;700'),
  `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#C9F7FF 0%,#E8C8FF 44%,#FFD6EC 100%);"></div>
   <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.7) 2px,transparent 2px);background-size:40px 40px;opacity:.6;"></div>
   <div style="position:absolute;left:50%;top:210px;margin-left:-250px;width:500px;height:500px;border-radius:50%;background:conic-gradient(#FF6BD6,#6BE8FF,#FFF07A,#B36BFF,#FF6BD6);filter:blur(2px);"></div>
   <div style="position:absolute;left:50%;top:290px;margin-left:-170px;width:340px;height:340px;border-radius:50%;background:linear-gradient(160deg,#FFF,#D8F6FF 40%,#FFD9F2);"></div>
   <div style="position:absolute;left:62px;right:62px;top:400px;text-align:center;font-family:Bungee,sans-serif;font-size:82px;line-height:1;color:#7B2BD6;text-shadow:4px 4px 0 #FFF,8px 8px 0 rgba(123,43,214,.28);">CTRL<br>+ POST</div>
   <div style="position:absolute;left:62px;right:62px;top:820px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:32px;color:#7B2BD6;">35 slides ★ zero design skills ★ no cap</div>
   <div style="position:absolute;left:62px;right:62px;top:920px;display:flex;justify-content:center;gap:16px;">
     ${['★', '✿', '☆', '✧'].map((s) => `<span style="font-size:44px;color:#FF6BD6;">${s}</span>`).join('')}
   </div>
   ${foot('#7B2BD6', .7)}`,
  `<div style="position:absolute;inset:0;background:#0B0B14;"></div>
   <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,107,214,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(107,232,255,.16) 1px,transparent 1px);background-size:44px 44px;"></div>
   <div style="position:absolute;left:62px;right:62px;top:300px;text-align:center;font-family:Bungee,sans-serif;font-size:132px;line-height:.92;background:linear-gradient(180deg,#FFF,#6BE8FF 45%,#FF6BD6);-webkit-background-clip:text;background-clip:text;color:transparent;">2K25<br>MODE</div>
   <div style="position:absolute;left:62px;right:62px;top:700px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:28px;letter-spacing:.14em;color:#6BE8FF;">NOW LOADING YOUR WHOLE WEEK</div>
   <div style="position:absolute;left:140px;right:140px;top:790px;height:26px;border:3px solid #FF6BD6;border-radius:999px;overflow:hidden;"><div style="width:82%;height:100%;background:linear-gradient(90deg,#FF6BD6,#6BE8FF);"></div></div>
   ${foot('#FFF', .6)}`);

/* 14 SWISS ---------------------------------------------------------------- */
S('Swiss', 'Swiss design', FONTS('family=Archivo:wght@400;600;700'),
  `<div style="position:absolute;inset:0;background:#F2F2F0;"></div>
   <div style="position:absolute;left:0;top:0;width:36%;height:100%;background:#E03127;"></div>
   <div style="position:absolute;left:62px;top:62px;font-family:Archivo,sans-serif;font-weight:700;font-size:15px;letter-spacing:.2em;color:#FFF;">FUTURE<br>CLIPS</div>
   <div style="position:absolute;left:38%;right:62px;top:62px;font-family:Archivo,sans-serif;font-weight:700;font-size:15px;letter-spacing:.2em;color:#0E0E10;text-align:right;">01</div>
   <div style="position:absolute;left:38%;right:62px;top:300px;font-family:Archivo,sans-serif;font-weight:700;font-size:104px;line-height:.92;letter-spacing:-.04em;color:#0E0E10;">Order<br>beats<br>output</div>
   <div style="position:absolute;left:38%;right:62px;top:700px;height:3px;background:#0E0E10;"></div>
   <div style="position:absolute;left:38%;right:62px;top:730px;font-family:Archivo,sans-serif;font-weight:400;font-size:23px;line-height:1.52;color:#3A3A38;">A grid you never break is worth more than a good idea you cannot repeat.</div>
   <div style="position:absolute;left:62px;bottom:120px;width:36%;padding-right:62px;box-sizing:border-box;font-family:Archivo,sans-serif;font-weight:600;font-size:20px;line-height:1.5;color:#FFF;">35 slides<br>4 platforms<br>1 brand kit</div>
   ${foot('#0E0E10', .55, 'Archivo,sans-serif')}`,
  `<div style="position:absolute;inset:0;background:#F2F2F0;"></div>
   <div style="position:absolute;left:62px;right:62px;top:62px;bottom:62px;display:grid;grid-template-columns:repeat(6,1fr);grid-template-rows:repeat(8,1fr);gap:2px;">
     <div style="grid-column:1/4;grid-row:1/3;background:#0E0E10;"></div>
     <div style="grid-column:4/7;grid-row:1/2;background:#E03127;"></div>
     <div style="grid-column:1/3;grid-row:3/6;background:#E03127;"></div>
     <div style="grid-column:5/7;grid-row:4/8;background:#0E0E10;"></div>
     <div style="grid-column:3/5;grid-row:6/9;background:#E03127;"></div>
   </div>
   <div style="position:absolute;left:96px;top:200px;font-family:Archivo,sans-serif;font-weight:700;font-size:96px;line-height:.9;letter-spacing:-.04em;color:#FFF;">35</div>
   <div style="position:absolute;left:400px;top:640px;width:300px;font-family:Archivo,sans-serif;font-weight:600;font-size:26px;line-height:1.34;color:#0E0E10;">Every slide sits on the same grid, whatever the campaign.</div>
   ${foot('#0E0E10', .55, 'Archivo,sans-serif')}`);

/* 15 SURREAL -------------------------------------------------------------- */
S('Surreal', 'Surreal design', FONTS('family=DM+Serif+Display:ital@0;1&family=Space+Grotesk:wght@500'),
  `<div style="position:absolute;inset:0;background:linear-gradient(180deg,#8FC7F0 0%,#CFE7F5 58%,#F3E2C7 100%);"></div>
   <div style="position:absolute;left:50%;top:180px;margin-left:-180px;width:360px;height:360px;border-radius:50%;background:#F5E6A8;box-shadow:0 0 90px rgba(245,230,168,.85);"></div>
   <img src="c5.jpg" style="position:absolute;left:120px;top:420px;width:250px;transform:rotate(-14deg);box-shadow:0 30px 50px rgba(0,0,0,.28);">
   <img src="c3.jpg" style="position:absolute;right:110px;top:340px;width:230px;transform:rotate(12deg);box-shadow:0 30px 50px rgba(0,0,0,.28);">
   <img src="c7.jpg" style="position:absolute;left:420px;top:620px;width:240px;transform:rotate(-4deg);box-shadow:0 30px 50px rgba(0,0,0,.28);">
   <div style="position:absolute;left:62px;right:62px;bottom:230px;text-align:center;font-family:'DM Serif Display',serif;font-style:italic;font-size:88px;line-height:1.02;color:#22303F;">Content that<br>floats out on<br>its own</div>
   ${foot('#22303F', .6)}`,
  `<div style="position:absolute;inset:0;background:#1B1035;"></div>
   <div style="position:absolute;left:-140px;bottom:-140px;width:700px;height:700px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#FF9E6B,#B4436C 60%,#4A1F52);"></div>
   <div style="position:absolute;right:80px;top:160px;width:220px;height:220px;border-radius:50%;border:3px solid #F5E6A8;"></div>
   <div style="position:absolute;right:130px;top:210px;width:220px;height:220px;border-radius:50%;background:#F5E6A8;opacity:.85;"></div>
   <div style="position:absolute;left:62px;right:62px;top:520px;font-family:'DM Serif Display',serif;font-size:104px;line-height:.98;color:#F3E9FF;">A week of<br>posts, made<br><span style="font-style:italic;color:#F5E6A8;">before lunch</span></div>
   ${foot('#F3E9FF', .55)}`);

/* 16 BOHEMIAN ------------------------------------------------------------- */
S('Bohemian', 'Bohemian', FONTS('family=Cormorant+Garamond:ital,wght@0,600;1,600&family=Karla:wght@400;600'),
  `<div style="position:absolute;inset:0;background:#E8DCC8;"></div>
   <div style="position:absolute;left:50%;top:140px;margin-left:-220px;width:440px;height:640px;border-radius:220px 220px 0 0;background:#C9743F;"></div>
   <div style="position:absolute;left:50%;top:200px;margin-left:-170px;width:340px;height:540px;border-radius:170px 170px 0 0;background:#E8DCC8;"></div>
   <div style="position:absolute;left:50%;top:300px;margin-left:-110px;width:220px;height:220px;border-radius:50%;background:#7C8A5A;"></div>
   <div style="position:absolute;left:62px;right:62px;top:830px;text-align:center;font-family:'Cormorant Garamond',serif;font-weight:600;font-size:88px;line-height:1.04;color:#4A3625;">Slow brand,<br><span style="font-style:italic;">fast output</span></div>
   <div style="position:absolute;left:120px;right:120px;top:1050px;text-align:center;font-family:Karla,sans-serif;font-size:24px;line-height:1.5;color:#6B5540;">One considered look, repeated until people recognise it without the handle.</div>
   ${foot('#4A3625', .55, 'Karla,sans-serif')}`,
  `<div style="position:absolute;inset:0;background:#7C8A5A;"></div>
   <div style="position:absolute;inset:44px;border:2px solid rgba(232,220,200,.6);"></div>
   <div style="position:absolute;left:62px;right:62px;top:300px;text-align:center;font-family:'Cormorant Garamond',serif;font-weight:600;font-style:italic;font-size:110px;line-height:1;color:#F2EADB;">thirty five</div>
   <div style="position:absolute;left:200px;right:200px;top:470px;height:1px;background:rgba(242,234,219,.6);"></div>
   <div style="position:absolute;left:62px;right:62px;top:520px;text-align:center;font-family:Karla,sans-serif;font-weight:600;font-size:23px;letter-spacing:.22em;color:#E8DCC8;">SLIDES A MONTH</div>
   <div style="position:absolute;left:120px;right:120px;top:640px;text-align:center;font-family:'Cormorant Garamond',serif;font-size:34px;line-height:1.5;color:rgba(242,234,219,.86);">Enough to be everywhere, few enough to still mean something.</div>
   ${foot('#F2EADB', .6, 'Karla,sans-serif')}`);

/* 17 VICTORIAN ------------------------------------------------------------ */
S('Victorian', 'Victorian style', FONTS('family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=EB+Garamond:ital,wght@0,400;1,400'),
  `<div style="position:absolute;inset:0;background:#F0E7D2;"></div>
   <div style="position:absolute;inset:40px;border:4px double #4A3418;"></div>
   <div style="position:absolute;inset:58px;border:1px solid #8A6C3E;"></div>
   <svg viewBox="0 0 200 60" style="position:absolute;left:50%;top:110px;margin-left:-100px;width:200px;"><path d="M10 30 Q50 0 100 30 T190 30" stroke="#8A6C3E" stroke-width="2" fill="none"/><circle cx="100" cy="30" r="7" fill="#8A6C3E"/><path d="M40 40 Q70 55 100 40 T160 40" stroke="#8A6C3E" stroke-width="1.4" fill="none"/></svg>
   <div style="position:absolute;left:100px;right:100px;top:230px;text-align:center;font-family:'EB Garamond',serif;font-size:24px;letter-spacing:.34em;color:#8A6C3E;">ESTABLISHED THIS YEAR</div>
   <div style="position:absolute;left:80px;right:80px;top:300px;text-align:center;font-family:'Playfair Display',serif;font-weight:900;font-size:96px;line-height:1;color:#2E2013;">The Compleat<br>Carousel<br>Engine</div>
   <div style="position:absolute;left:190px;right:190px;top:660px;height:2px;background:#8A6C3E;"></div>
   <div style="position:absolute;left:110px;right:110px;top:700px;text-align:center;font-family:'EB Garamond',serif;font-style:italic;font-size:30px;line-height:1.55;color:#4A3418;">Whereby one idea, plainly stated, is rendered into five and thirty slides — without the retaining of a draughtsman.</div>
   ${foot('#4A3418', .6, "'EB Garamond',serif")}`,
  `<div style="position:absolute;inset:0;background:#2E2013;"></div>
   <div style="position:absolute;inset:44px;border:3px double #C9A227;"></div>
   <div style="position:absolute;left:62px;right:62px;top:260px;text-align:center;font-family:'Playfair Display',serif;font-weight:900;font-size:170px;line-height:.9;color:#C9A227;">XXXV</div>
   <div style="position:absolute;left:62px;right:62px;top:470px;text-align:center;font-family:'EB Garamond',serif;font-size:26px;letter-spacing:.3em;color:#E8D9B0;">SLIDES PER MONTH</div>
   <svg viewBox="0 0 240 40" style="position:absolute;left:50%;top:560px;margin-left:-120px;width:240px;"><path d="M0 20 H90 M150 20 H240" stroke="#C9A227" stroke-width="1.6"/><circle cx="120" cy="20" r="9" fill="none" stroke="#C9A227" stroke-width="1.6"/><circle cx="120" cy="20" r="3" fill="#C9A227"/></svg>
   <div style="position:absolute;left:120px;right:120px;top:640px;text-align:center;font-family:'EB Garamond',serif;font-style:italic;font-size:30px;line-height:1.55;color:rgba(232,217,176,.86);">Not one of which shall breach the terms your campaign has set down.</div>
   ${foot('#E8D9B0', .55, "'EB Garamond',serif")}`);

/* 18 GRAFFITI ------------------------------------------------------------- */
S('Graffiti', 'Graffiti', FONTS('family=Bungee+Shade&family=Bungee&family=Space+Grotesk:wght@700'),
  `<div style="position:absolute;inset:0;background:#2A2A2A;"></div>
   <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0 2px,transparent 2px 46px),repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 2px,transparent 2px 96px);"></div>
   <div style="position:absolute;left:40px;top:200px;right:40px;font-family:Bungee,sans-serif;font-size:112px;line-height:.94;color:#39FF6A;transform:rotate(-4deg);text-shadow:6px 6px 0 #0E0E10,10px 10px 0 #FF2E88;">GO<br>LOUD<br>OR GO<br>HOME</div>
   <svg viewBox="0 0 300 200" style="position:absolute;right:50px;top:120px;width:260px;opacity:.9;">
     <path d="M40 30 C 90 0 200 20 250 60 C 280 90 250 150 180 160 C 110 170 40 140 30 100 C 24 74 30 50 40 30Z" fill="none" stroke="#FF2E88" stroke-width="8"/>
   </svg>
   ${Array.from({ length: 7 }, (_, i) => `<div style="position:absolute;left:${90 + i * 130}px;top:${790 + (i % 3) * 22}px;width:8px;height:${40 + (i % 4) * 26}px;border-radius:0 0 6px 6px;background:#39FF6A;opacity:.8;"></div>`).join('')}
   <div style="position:absolute;left:50px;right:50px;bottom:150px;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:30px;color:#FFF;">35 slides. Same tag every time. They know it's you before they read it.</div>
   ${foot('#39FF6A', .85)}`,
  `<div style="position:absolute;inset:0;background:#B8352A;"></div>
   <div style="position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 3px,transparent 3px 48px),repeating-linear-gradient(90deg,rgba(0,0,0,.14) 0 3px,transparent 3px 100px);"></div>
   <div style="position:absolute;left:0;right:0;top:340px;background:#0E0E10;padding:36px 0;transform:rotate(-2.5deg);">
     <div style="text-align:center;font-family:'Bungee Shade',sans-serif;font-size:96px;color:#FFE500;">TAGGED</div>
   </div>
   <div style="position:absolute;left:62px;right:62px;top:640px;text-align:center;font-family:Bungee,sans-serif;font-size:56px;line-height:1.06;color:#FFF;text-shadow:5px 5px 0 #0E0E10;">every slide,<br>same hand</div>
   <div style="position:absolute;left:80px;right:80px;bottom:180px;text-align:center;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:27px;color:rgba(255,255,255,.9);">A brand kit is just a tag you can't forget to use.</div>
   ${foot('#FFE500', .9)}`);

/* 19 AURORA --------------------------------------------------------------- */
S('Aurora', 'Aurora', FONTS('family=Outfit:wght@300;500;700'),
  `<div style="position:absolute;inset:0;background:#050A18;"></div>
   <div style="position:absolute;left:-200px;top:80px;width:1500px;height:520px;background:radial-gradient(60% 50% at 30% 50%,rgba(80,255,190,.55),transparent 70%),radial-gradient(50% 60% at 65% 40%,rgba(120,140,255,.5),transparent 70%),radial-gradient(40% 50% at 85% 60%,rgba(255,110,220,.42),transparent 70%);filter:blur(30px);"></div>
   <div style="position:absolute;left:-100px;top:300px;width:1300px;height:300px;background:radial-gradient(50% 60% at 40% 50%,rgba(120,255,220,.35),transparent 70%);filter:blur(40px);transform:rotate(-6deg);"></div>
   ${Array.from({ length: 40 }, (_, i) => `<div style="position:absolute;left:${(i * 137) % 1040 + 20}px;top:${(i * 271) % 1200 + 40}px;width:${i % 4 === 0 ? 3 : 2}px;height:${i % 4 === 0 ? 3 : 2}px;border-radius:50%;background:#FFF;opacity:${0.25 + (i % 5) * 0.14};"></div>`).join('')}
   <div style="position:absolute;left:62px;right:62px;top:740px;font-family:Outfit,sans-serif;font-weight:300;font-size:96px;line-height:1;letter-spacing:-.03em;color:#EAF4FF;">Post while<br>the feed is<br><span style="font-weight:700;background:linear-gradient(90deg,#7CFFCB,#8AA0FF,#FF7ADC);-webkit-background-clip:text;background-clip:text;color:transparent;">still dark</span></div>
   ${foot('#EAF4FF', .55, 'Outfit,sans-serif')}`,
  `<div style="position:absolute;inset:0;background:#050A18;"></div>
   <div style="position:absolute;left:50%;top:50%;margin:-420px 0 0 -420px;width:840px;height:840px;border-radius:50%;background:conic-gradient(from 200deg,rgba(124,255,203,.5),rgba(138,160,255,.5),rgba(255,122,220,.5),rgba(124,255,203,.5));filter:blur(70px);"></div>
   <div style="position:absolute;left:62px;right:62px;top:44%;text-align:center;font-family:Outfit,sans-serif;font-weight:700;font-size:180px;line-height:.86;letter-spacing:-.05em;color:#EAF4FF;">35</div>
   <div style="position:absolute;left:62px;right:62px;top:calc(44% + 200px);text-align:center;font-family:Outfit,sans-serif;font-weight:300;font-size:30px;letter-spacing:.22em;color:rgba(234,244,255,.72);">SLIDES A MONTH</div>
   ${foot('#EAF4FF', .5, 'Outfit,sans-serif')}`);

/* 20 HANDWRITTEN ---------------------------------------------------------- */
S('Handwritten', 'Handwritten', FONTS('family=Caveat:wght@500;700&family=Kalam:wght@400;700'),
  `<div style="position:absolute;inset:0;background:#FDFBF3;"></div>
   <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(60,90,160,.14) 1px,transparent 1px);background-size:100% 44px;"></div>
   <div style="position:absolute;left:130px;top:0;width:2px;height:100%;background:rgba(220,90,80,.42);"></div>
   <div style="position:absolute;left:170px;right:70px;top:150px;font-family:Caveat,cursive;font-weight:700;font-size:104px;line-height:1.06;color:#1F2937;">my whole<br>content week,<br>on one page</div>
   <svg viewBox="0 0 300 120" style="position:absolute;left:520px;top:430px;width:300px;"><path d="M10 20 C 90 10 180 40 230 90" stroke="#DC5A50" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M210 70 L235 95 L200 100" stroke="#DC5A50" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
   <div style="position:absolute;left:170px;right:70px;top:580px;font-family:Kalam,cursive;font-size:29px;line-height:1.75;color:#374151;">
     ✓ &nbsp;pick the campaign<br>
     ✓ &nbsp;drop one line of an idea<br>
     ✓ &nbsp;check the rules pass<br>
     ✓ &nbsp;download and post
   </div>
   <div style="position:absolute;left:170px;top:900px;background:#FFE79E;padding:14px 22px;transform:rotate(-2deg);font-family:Kalam,cursive;font-weight:700;font-size:27px;color:#1F2937;">takes about 2 min</div>
   ${foot('#1F2937', .5, 'Kalam,cursive')}`,
  `<div style="position:absolute;inset:0;background:#1F2937;"></div>
   <div style="position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.05) 1px,transparent 1px);background-size:22px 22px;"></div>
   <div style="position:absolute;left:70px;right:70px;top:240px;font-family:Caveat,cursive;font-weight:700;font-size:120px;line-height:1;color:#FDFBF3;transform:rotate(-1.5deg);">stop editing<br>video for<br>25 minutes</div>
   <svg viewBox="0 0 400 60" style="position:absolute;left:80px;top:700px;width:400px;"><path d="M6 40 C 120 10 260 52 394 22" stroke="#FFE79E" stroke-width="7" fill="none" stroke-linecap="round"/></svg>
   <div style="position:absolute;left:70px;right:70px;top:780px;font-family:Kalam,cursive;font-size:32px;line-height:1.6;color:rgba(253,251,243,.8);">a slideshow that takes two gets you paid on the same views.</div>
   ${foot('#FDFBF3', .5, 'Kalam,cursive')}`);

/* ------------------------------------------------------------------------- */
const artboards = [];
STYLES.forEach((st, i) => {
  const col = i % 4, row = Math.floor(i / 4);
  const x = col * 2620, y = row * 1600;
  for (const [n, body] of [['A', st.a], ['B', st.b]]) {
    const file = `${st.id}${n}.dc.html`;
    fs.writeFileSync(file, wrap(st.fonts, body));
    artboards.push({ file, x: x + (n === 'B' ? 1240 : 0), y, w: 1080, h: 1350,
      title: `${String(i + 1).padStart(2, '0')} ${st.name} ${n}` });
  }
});
// Main must exist as the entry artboard
fs.copyFileSync('MinimalismA.dc.html', 'Main.dc.html');
artboards.unshift({ file: 'Main.dc.html', x: -1400, y: 0, w: 1080, h: 1350, title: '00 Entry' });

fs.writeFileSync('canvas.json', JSON.stringify({ artboards, launch: { view: 'canvas' } }, null, 2));
console.log(`${STYLES.length} styles -> ${artboards.length} artboards`);
console.log(artboards.map((a) => a.file).join(' '));
