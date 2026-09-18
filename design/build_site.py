# -*- coding: utf-8 -*-
"""Turn the Design Component into a real, deployable static page.

The .dc.html is a Design Component: <x-dc>/<helmet>, {{ holes }} and a DCLogic
class the design runtime resolves. A browser can't run any of that, so this:

  * lifts <helmet><style> into <head>
  * unrolls the four <sc-for> loops from their data
  * swaps every {{ styleHole }} for a real class, and the JS-driven `mobile`
    breakpoint for CSS media queries — which is strictly better: the right
    layout paints before JS runs, with no flash
  * rewires the events (burger, pricing cycle, form) as plain JS
  * wires the waitlist to Supabase directly (anon key, RLS is insert-only)

Then it adds what was asked for: the hero cards drop in and fan out, the view
counter rolls up from zero, and sections reveal on scroll.
"""
import os as _os, sys as _sys
if _os.environ.get("FC_OLD_SITE") != "1":
    _sys.exit("build_site.py is superseded: the homepage is design/site.html, copied verbatim to "
              "future-clips-site/index.html (see README). Set FC_OLD_SITE=1 to build the old design anyway.")
import io, os, re, json, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "Main.dc.html")
DIST = os.path.join(os.path.dirname(HERE), "future-clips-site")

SUPA_URL = "https://waipwmyncpsgoglmkhdz.supabase.co"
SUPA_KEY = "sb_publishable_2umi_LTrNfOy9baqGUXgog_ID60SYNT"
# The hero badge rolls up to this figure. It is the owner's number, restored at
# the owner's request on 2026-09-11 after being removed; it is not a measured
# view count (see OPEN-DECISIONS.md #2).
VIEWS_TARGET = 1304895

s = io.open(SRC, encoding="utf-8").read()

def unesc(t):
    return re.sub(r'\\u([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), t)

# ── pull the data out of the logic class ──────────────────────────────
def strings(name):
    blk = re.search(name + r': \[(.*?)\]', s, re.S).group(1)
    return [unesc(x) for x in re.findall(r'"((?:[^"\\]|\\.)*)"', blk)]

def objects(name, keys):
    blk = re.search(name + r': \[(.*?)\n      \]', s, re.S).group(1)
    out = []
    for row in re.findall(r'\{([^{}]*)\}', blk):
        item = {}
        for k in keys:
            m = re.search(k + r': "((?:[^"\\]|\\.)*)"', row)
            item[k] = unesc(m.group(1)).replace('\\"', '"') if m else ""
        out.append(item)
    return out

OLD = strings("oldWay")
NEW = strings("newWay")
FEATURES = objects("features", ["icon", "title", "body"])
FAQS = objects("faqs", ["q", "a"])
assert len(OLD) == 6 and len(NEW) == 6 and len(FEATURES) == 6 and len(FAQS) >= 5, \
    "data extraction: %d/%d/%d/%d" % (len(OLD), len(NEW), len(FEATURES), len(FAQS))

# ── strip the component shell ─────────────────────────────────────────
helmet = re.search(r'<helmet>(.*?)</helmet>', s, re.S).group(1)
css = re.search(r'<style>(.*?)</style>', helmet, re.S).group(1)
fonts = "\n".join(re.findall(r'<link[^>]*fonts\.googleapis[^>]*>', helmet))

body = s[s.find("</helmet>") + 9: s.find("</x-dc>")]

# ── unroll the loops ──────────────────────────────────────────────────
def unroll(name, items, render):
    global body
    m = re.search(r'<sc-for list="\{\{ %s \}\}".*?</sc-for>' % name, body, re.S)
    assert m, "loop %s not found" % name
    tpl = m.group(0)
    inner = re.sub(r'^<sc-for[^>]*>|</sc-for>$', '', tpl.strip(), flags=re.S).strip()
    body = body.replace(tpl, "\n".join(render(inner, it, i) for i, it in enumerate(items)))

esc = lambda t: (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

unroll("oldWay", OLD, lambda t, o, i: t.replace("{{ o }}", esc(o)))
unroll("newWay", NEW, lambda t, w, i: t.replace("{{ w }}", esc(w)))
def feature_row(t, f, i):
    # No icon glyph: a lime rule carries the accent instead, matching the
    # eyebrow bullets already used elsewhere in the design.
    row = re.sub(r'<span style="display:grid;place-items:center;width:44px[^>]*>.*?</span>',
                 '<span class="fc-rule"></span>', t, count=1, flags=re.S)
    row = row.replace("{{ f.title }}", esc(f["title"]))
    row = row.replace("{{ f.body }}", esc(f["body"]))
    # flat hairline-separated rows instead of six bordered cards
    row = re.sub(r'<div style="background:#fff;border:1px solid #E9E6DE;border-radius:16px;[^"]*">',
                 '<div class="fc-feat fc-reveal" style="--i:%d">' % i, row, count=1)
    return row

unroll("features", FEATURES, feature_row)
unroll("faqs", FAQS, lambda t, q, i: (
    t.replace("{{ q.q }}", esc(q["q"])).replace("{{ q.a }}", esc(q["a"]))))

# ── holes -> real classes, ids and handlers ───────────────────────────
swaps = [
    ('style="{{ navStyle }}"',        'class="fc-navlinks"'),
    ('style="{{ headerCtaStyle }}"',  'class="fc-navcta"'),
    ('style="{{ burgerStyle }}"',     'class="fc-burger" id="fcBurger"'),
    ('style="{{ burgerTopStyle }}"',  ''),
    ('style="{{ burgerMidStyle }}"',  ''),
    ('style="{{ burgerBotStyle }}"',  ''),
    ('style="{{ mobileMenuStyle }}"', 'class="fc-mobile" id="fcMobile"'),
    ('style="{{ monthlyStyle }}"',    'class="fc-pill fc-on" id="fcMonthly"'),
    ('style="{{ yearlyStyle }}"',     'class="fc-pill" id="fcYearly"'),
    ('aria-expanded="{{ menuOpen }}"','aria-expanded="false"'),
    ('onClick="{{ toggleMenu }}"',    'onclick="fcToggle()"'),
    ('onClick="{{ closeMenu }}"',     'onclick="fcClose()"'),
    ('onClick="{{ pickMonthly }}"',   'onclick="fcCycle(\'monthly\')"'),
    ('onClick="{{ pickYearly }}"',    'onclick="fcCycle(\'yearly\')"'),
    ('onSubmit="{{ submit }}"',       'onsubmit="return fcSubmit(event)"'),
    ('{{ msg }}',                     '<span id="fcMsg">Founding price locked when you join.</span>'),
]
# Pricing holes. The table is priced monthly, so monthly is the default state
# and the yearly toggle (2 months free = 10x monthly) is the alternative.
D = "·"
for k, mo in (("solo", "$19"), ("grind", "$59"), ("agency", "$249")):
    for part, dflt in (("Price", mo), ("Suffix", "/mo"),
                       ("Billing", "Billed monthly %s cancel anytime" % D)):
        swaps.append(("{{ %s%s }}" % (k, part), '<span data-p="%s%s">%s</span>' % (k, part, dflt)))

for old, new in swaps:
    assert old in body, "hole not found: " + old
    body = body.replace(old, new)

# ── hero: cards drop in and fan out, with slide chrome ────────────────
CARDS = [
    ("golden-six.webp",    "Longevity carousel",   "-405px", "-13deg", ".10s", 190, 0),
    ("running.webp",       "Running carousel",     "-208px", "-6.5deg", ".20s", 200, 1),
    ("finance-rules.webp", "Finance carousel",     "0px",     "0deg",   ".30s", 286, 3),
    ("hit-muscle.webp",    "Calisthenics carousel","208px",   "6.5deg", ".40s", 200, 1),
    ("not-ugly.webp",      "Habits carousel",      "405px",   "13deg",  ".50s", 190, 0),
]
dots = "".join('<i%s></i>' % (' class="on"' if i == 0 else "") for i in range(9))
cards_html = []
for i, (img, alt, x, r, d, w, z) in enumerate(CARDS):
    chrome = ""
    if i == 2:
        chrome = ('<span class="fc-idx">01 / 09</span>'
                  '<span class="fc-dots">%s</span>' % dots)
    cards_html.append(
        '<figure class="fc-card%s" style="--x:%s;--r:%s;--d:%s;--w:%dpx;z-index:%d">'
        '<img src="carousels/%s" alt="%s" width="500" height="625">%s</figure>'
        % (" fc-card-lead" if i == 2 else "", x, r, d, w, z, img, alt, chrome))

stage = ('<div class="fc-stage">' + "".join(cards_html) +
         '<div class="fc-badge"><span class="fc-dot"></span><div>'
         '<b id="fcViews">0</b><span>Views</span></div></div></div>')

hero = re.search(r'<div style="position:relative;width:100%;max-width:1240px;margin-inline:auto;'
                 r'padding-inline:clamp\(18px,4vw,36px\);margin-top:clamp\(40px,7vw,64px\)">.*?\n  </div>',
                 body, re.S)
assert hero, "hero stage not found"
body = body.replace(hero.group(0),
    '<div class="fc-stagewrap">%s</div>' % stage)

# ── reveal-on-scroll for the section blocks ───────────────────────────
# features: from an auto-fit card grid to hairline-separated columns
body = body.replace(
    "grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr))",
    "grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr))", 1)
body = body.replace(
    "display:grid;gap:clamp(14px,2vw,20px);margin-top:clamp(36px,6vw,60px);",
    "display:grid;gap:0 clamp(30px,5vw,68px);margin-top:clamp(30px,5vw,48px);", 1)

# the credit line is removed at the owner's instruction
_credits = body.count("Posts by their respective creators")
assert _credits == 1, "expected 1 credit line, found %d" % _credits
body = re.sub(r'<p[^>]*>Posts by their respective creators.*?</p>', '', body, flags=re.S)
assert "Posts by their respective creators" not in body, "credit line removal failed"

body = re.sub(r'<section(\s)', r'<section class="fc-sec"\1', body)

EXTRA_CSS = """
/* ── responsive nav: CSS breakpoints, not a JS state flag ─────────── */
.fc-navlinks { display:flex; gap:clamp(18px,2.4vw,32px); font-size:15px; font-weight:500; color:#56544E; white-space:nowrap; }
.fc-navcta { display:flex; align-items:center; gap:14px; }
.fc-burger { display:none; flex-direction:column; justify-content:center; gap:4px; width:48px; height:48px; padding:0 14px; background:#fff; border:1px solid #E6E3DB; border-radius:10px; cursor:pointer; }
.fc-burger span { display:block; width:20px; height:2px; background:#0E0E10; border-radius:2px; transition:transform .2s, opacity .2s; }
.fc-burger.open span:nth-child(1) { transform:translateY(6px) rotate(45deg); }
.fc-burger.open span:nth-child(2) { opacity:0; }
.fc-burger.open span:nth-child(3) { transform:translateY(-6px) rotate(-45deg); }
.fc-mobile { display:none; margin-top:10px; background:rgba(253,252,248,.97); backdrop-filter:blur(18px); border:1px solid #E7E4DB; border-radius:16px; box-shadow:0 18px 40px -18px rgba(14,14,16,.22); overflow:hidden; }
@media (max-width:899px) {
  .fc-navlinks, .fc-navcta { display:none; }
  .fc-burger { display:flex; }
  .fc-mobile.open { display:block; }
}

/* ── pricing toggle ───────────────────────────────────────────────── */
.fc-pill { border:0; background:transparent; color:#6E6B63; font-family:'IBM Plex Mono',monospace; font-size:11px; letter-spacing:.07em; text-transform:uppercase; padding:12px 16px; min-height:46px; border-radius:8px; cursor:pointer; white-space:nowrap; transition:background .18s, color .18s; }
.fc-pill.fc-on { background:#0E0E10; color:#fff; }

/* ── pricing: the spec rows inside each tier card ─────────────────── */
.fc-rows { margin:18px 0 0; padding:0; display:flex; flex-direction:column; }
.fc-rows > div { display:flex; justify-content:space-between; align-items:baseline; gap:12px; padding:9px 0; border-top:1px solid #EFECE4; }
.fc-rows dt { margin:0; font-family:'IBM Plex Mono',monospace; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color:#8A867C; white-space:nowrap; }
.fc-rows dd { margin:0; font-size:14px; font-weight:600; color:#0E0E10; text-align:right; }
.fc-rows dd.fc-no { color:#B9B5AB; font-weight:400; }
@media (min-width:1100px) { .fc-tiers { grid-template-columns:repeat(4,1fr) !important; } }

/* ── hero: the deck drops in and spreads ──────────────────────────── */
.fc-stagewrap { position:relative; width:100%; margin-top:clamp(36px,6vw,60px); overflow:hidden; padding-bottom:clamp(64px,9vw,92px); }
.fc-stage { position:relative; height:clamp(300px,44vw,430px); display:flex; align-items:center; justify-content:center; }
.fc-card { position:absolute; margin:0; width:var(--w); border-radius:16px; overflow:hidden; background:#EFEDE6; border:1px solid rgba(14,14,16,.07); box-shadow:0 22px 50px -26px rgba(14,14,16,.42); animation:fcDrop .95s cubic-bezier(.18,.86,.24,1) both; animation-delay:var(--d); }
.fc-card img { width:100%; height:auto; aspect-ratio:4/5; object-fit:cover; object-position:top center; display:block; }
.fc-card-lead { border-radius:20px; box-shadow:0 34px 70px -30px rgba(14,14,16,.55); }
@keyframes fcDrop {
  from { opacity:0; transform:translate3d(0,-140px,0) rotate(0deg) scale(.86); }
  to   { opacity:1; transform:translate3d(var(--x),0,0) rotate(var(--r)) scale(1); }
}
.fc-idx { position:absolute; top:10px; left:12px; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.1em; color:rgba(255,255,255,.92); background:rgba(14,14,16,.55); backdrop-filter:blur(6px); padding:4px 8px; border-radius:6px; }
.fc-dots { position:absolute; left:0; right:0; bottom:12px; display:flex; gap:5px; justify-content:center; }
.fc-dots i { width:5px; height:5px; border-radius:50%; background:rgba(255,255,255,.45); display:block; }
.fc-dots i.on { background:#fff; width:16px; border-radius:3px; }
.fc-badge { position:absolute; left:50%; bottom:-6px; transform:translateX(-50%); z-index:20; display:flex; align-items:center; gap:14px; background:#0E0E10; border-radius:14px; padding:14px 24px; box-shadow:0 18px 44px -14px rgba(14,14,16,.55); white-space:nowrap; animation:fcBadge .9s cubic-bezier(.18,.86,.24,1) both; animation-delay:.62s; }
@keyframes fcBadge {
  from { opacity:0; transform:translateX(-50%) translateY(-46px) scale(.9); }
  to   { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
}
.fc-dot { width:9px; height:9px; border-radius:50%; background:#D8FF47; flex:0 0 auto; animation:fcPulse 1.8s ease-in-out infinite; }
.fc-badge b { display:block; font-family:'Archivo',sans-serif; font-stretch:112%; font-weight:700; font-size:clamp(24px,5.6vw,34px); color:#fff; letter-spacing:-.02em; line-height:1.05; font-variant-numeric:tabular-nums; }
.fc-badge span:last-child { display:block; margin-top:3px; font-family:'IBM Plex Mono',monospace; font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:#8F8D87; }
@media (max-width:900px) {
  .fc-card { --w:150px !important; }
  .fc-card-lead { --w:200px !important; }
  .fc-card:nth-child(1) { --x:-232px; --r:-11deg; }
  .fc-card:nth-child(2) { --x:-124px; --r:-6deg; }
  .fc-card:nth-child(4) { --x:124px;  --r:6deg; }
  .fc-card:nth-child(5) { --x:232px;  --r:11deg; }
}
@media (max-width:560px) {
  .fc-card:nth-child(1), .fc-card:nth-child(5) { display:none; }
  .fc-card { --w:120px !important; }
  .fc-card-lead { --w:168px !important; }
  .fc-card:nth-child(2) { --x:-104px; --r:-8deg; }
  .fc-card:nth-child(4) { --x:104px;  --r:8deg; }
}

/* footer links sit at 21px tall — under the 24px target-size minimum.
   Pad them out on touch widths without touching desktop rhythm. */
@media (max-width:899px) {
  footer a { display:inline-block; padding-block:9px; }
  header .mark, header a[aria-label] { min-height:44px; display:flex; align-items:center; }
}

/* ── features: flat rows, hairline separated, no icon glyphs ──────── */
.fc-feat { padding:clamp(24px,3.6vw,34px) 0; border-top:1px solid #E9E6DE; }
.fc-feat .fc-rule { display:block; width:30px; height:4px; border-radius:2px; background:#D8FF47; }
.fc-feat h3 { margin-top:18px !important; }

/* ── reveal on scroll ─────────────────────────────────────────────── */
.fc-js .fc-reveal { opacity:0; transform:translateY(24px); transition:opacity .75s cubic-bezier(.2,.8,.25,1), transform .75s cubic-bezier(.2,.8,.25,1); transition-delay:calc(var(--i,0) * 70ms); }
.fc-js .fc-reveal.fc-in { opacity:1; transform:none; }

@media (prefers-reduced-motion: reduce) {
  .fc-card, .fc-badge { animation:none !important; opacity:1 !important; transform:translate3d(var(--x),0,0) rotate(var(--r)) !important; }
  .fc-badge { transform:translateX(-50%) !important; animation:none !important; opacity:1 !important; }
  .fc-js .fc-reveal { opacity:1 !important; transform:none !important; transition:none !important; }
}
"""

SCRIPT = """
var FC_TARGET = %d, FC_URL = "%s", FC_KEY = "%s";
var fcCycleState = "monthly", fcRef = "";

var FC_PRICES = {
  monthly: { soloPrice:"$19",  soloSuffix:"/mo", soloBilling:"Billed monthly \u00b7 cancel anytime",
             grindPrice:"$59", grindSuffix:"/mo", grindBilling:"Billed monthly \u00b7 cancel anytime",
             agencyPrice:"$249", agencySuffix:"/mo", agencyBilling:"Billed monthly \u00b7 cancel anytime" },
  yearly:  { soloPrice:"$190",  soloSuffix:"/yr", soloBilling:"2 months free \u00b7 billed yearly",
             grindPrice:"$590", grindSuffix:"/yr", grindBilling:"2 months free \u00b7 billed yearly",
             agencyPrice:"$2,490", agencySuffix:"/yr", agencyBilling:"2 months free \u00b7 billed yearly" }
};

function fcToggle(){
  var b=document.getElementById("fcBurger"), m=document.getElementById("fcMobile");
  var open=!m.classList.contains("open");
  m.classList.toggle("open",open); b.classList.toggle("open",open);
  b.setAttribute("aria-expanded",open?"true":"false");
}
function fcClose(){
  var b=document.getElementById("fcBurger"), m=document.getElementById("fcMobile");
  m.classList.remove("open"); b.classList.remove("open"); b.setAttribute("aria-expanded","false");
}
function fcCycle(c){
  fcCycleState=c;
  document.getElementById("fcYearly").classList.toggle("fc-on", c==="yearly");
  document.getElementById("fcMonthly").classList.toggle("fc-on", c==="monthly");
  var vals=FC_PRICES[c];
  Object.keys(vals).forEach(function(k){
    var el=document.querySelector('[data-p="'+k+'"]');
    if(el) el.textContent=vals[k];
  });
}

/* the counter rolls up from zero, holds, then runs again */
(function(){
  var el=document.getElementById("fcViews"); if(!el) return;
  var fmt=function(n){ return n.toLocaleString("en-US"); };
  if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches){ el.textContent=fmt(FC_TARGET); return; }
  var DUR=4200, HOLD=2600, start=null;
  function tick(t){
    if(start===null) start=t;
    var e=t-start;
    if(e<=DUR){ el.textContent=fmt(Math.round(FC_TARGET*(1-Math.pow(1-e/DUR,3)))); }
    else if(e<DUR+HOLD){ el.textContent=fmt(FC_TARGET); }
    else { start=t; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* reveal sections on scroll */
(function(){
  document.documentElement.classList.add("fc-js");
  var els=[].slice.call(document.querySelectorAll(".fc-sec, .fc-reveal"));
  if(!els.length) return;
  els.forEach(function(e){ if(!e.classList.contains("fc-reveal")) e.classList.add("fc-reveal"); });
  var showAll=function(){ els.forEach(function(e){ e.classList.add("fc-in"); }); };
  var show=function(e){ e.classList.add("fc-in"); };
  var sweep=function(){
    var n=0;
    els.forEach(function(e){
      if(e.classList.contains("fc-in")) { n++; return; }
      if(e.getBoundingClientRect().top < innerHeight*0.92){ show(e); n++; }
    });
    if(n===els.length){ window.removeEventListener("scroll",sweep); window.removeEventListener("resize",sweep); }
  };
  if("IntersectionObserver" in window){
    var io=new IntersectionObserver(function(rows){
      rows.forEach(function(r){ if(r.isIntersecting){ show(r.target); io.unobserve(r.target); } });
    },{rootMargin:"0px 0px -8%% 0px"});
    els.forEach(function(e){ io.observe(e); });
  }
  /* belt and braces: scroll/resize sweep, plus a hard deadline */
  window.addEventListener("scroll",sweep,{passive:true});
  window.addEventListener("resize",sweep,{passive:true});
  sweep();
  setTimeout(sweep,600);
  setTimeout(showAll,4000);
})();

/* revenue-share attribution survives the visit */
(function(){
  try{
    var u=new URLSearchParams(location.search).get("ref")||"";
    var clean=u.replace(/[^A-Za-z0-9_-]/g,"").slice(0,64);
    if(clean){ localStorage.setItem("fc_ref",clean); fcRef=clean; }
    else { fcRef=localStorage.getItem("fc_ref")||""; }
  }catch(_){}
})();

function fcSubmit(e){
  e.preventDefault();
  var msg=document.getElementById("fcMsg");
  var email=(document.getElementById("email").value||"").trim().toLowerCase();
  if(!/^[^@\\s]+@[^@\\s.]+\\.[^@\\s]+$/.test(email)){ msg.textContent="That email doesn't look right."; return false; }
  msg.textContent="Saving\\u2026";
  fetch(FC_URL+"/rest/v1/signups",{
    method:"POST",
    headers:{ apikey:FC_KEY, Authorization:"Bearer "+FC_KEY, "Content-Type":"application/json", Prefer:"return=minimal" },
    body:JSON.stringify({ email:email, role:"clipper", agency_code:fcRef||null })
  }).then(function(r){
    if(r.ok) msg.textContent="You're in. Founding price locked.";
    else if(r.status===409) msg.textContent="You're already on the list.";
    else msg.textContent="Couldn't save that. Try again in a second.";
  }).catch(function(){ msg.textContent="Couldn't save that. Try again in a second."; });
  return false;
}
""" % (VIEWS_TARGET, SUPA_URL, SUPA_KEY)

TITLE = "The Future Clips — Turn any idea into a viral slideshow"
DESC = ("The Future Clips turns any idea into a scroll-stopping slideshow in minutes. "
        "Consistent character, viral hooks, no visible watermark.")

out = (
    '<!doctype html>\n<html lang="en">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    '<title>' + TITLE + '</title>\n'
    '<meta name="description" content="' + DESC + '">\n'
    '<meta property="og:title" content="' + TITLE + '">\n'
    '<meta property="og:description" content="' + DESC + '">\n'
    '<link rel="icon" href="logo.png">\n'
    + fonts + '\n<style>\n' + css + EXTRA_CSS + '\n</style>\n</head>\n<body>\n'
    + body.strip() + '\n<script>\n' + SCRIPT + '\n</script>\n</body>\n</html>\n'
)

# logo lives at the root of the deploy
out = out.replace('src="logo.png"', 'src="logo.png"')

# overwrite in place rather than rmtree — a preview server or open tab can
# hold the directory on Windows and the whole build then fails
os.makedirs(os.path.join(DIST, "carousels"), exist_ok=True)
io.open(os.path.join(DIST, "index.html"), "w", encoding="utf-8").write(out)
shutil.copy(os.path.join(HERE, "logo.png"), os.path.join(DIST, "logo.png"))

used = sorted(set(re.findall(r'carousels/([\w-]+\.webp)', out)) |
              set(re.findall(r'src="([\w-]+\.webp)"', out)))
src_dir = os.path.join(os.path.dirname(HERE), "public", "carousels")
for f in used:
    shutil.copy(os.path.join(src_dir, f), os.path.join(DIST, "carousels", f))

# any image still referenced bare (from the gallery) needs the folder prefix
out2 = re.sub(r'src="([\w-]+\.webp)"', r'src="carousels/\1"', out)
io.open(os.path.join(DIST, "index.html"), "w", encoding="utf-8").write(out2)

kb = os.path.getsize(os.path.join(DIST, "index.html")) / 1024
imgkb = sum(os.path.getsize(os.path.join(DIST, "carousels", f))
            for f in os.listdir(os.path.join(DIST, "carousels"))) / 1024
print("future-clips-site/index.html  %.0f KB" % kb)
print("future-clips-site/carousels   %d files, %.0f KB" % (len(used), imgkb))
print("data: old=%d new=%d features=%d faqs=%d" % (len(OLD), len(NEW), len(FEATURES), len(FAQS)))
print("holes left: %s" % sorted(set(re.findall(r'\{\{[^}]*\}\}', out2))))
print("sc-for left: %d" % out2.count("<sc-for"))
