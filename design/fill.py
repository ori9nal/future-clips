# -*- coding: utf-8 -*-
"""Fill the supplied Future Clips design with the real carousel stills.

The incoming artboard ships striped placeholders driven by <sc-for> loops.
Asset references in a Design Component resolve by LITERAL filename substitution,
so a bound src="{{ g.img }}" would never resolve — the loops are unrolled into
literal markup with literal filenames instead.

Two other things are corrected on the way through, both because they state
things that are not true:
  * campaign cards claimed "12 live" / "8 live" / "15 live" campaigns — no
    brand partners are signed, and the page's own status section says so;
  * gallery captions carried invented view counts (1.2M, 840k, ...).
"""
import io, os, re, shutil

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "incoming", "Future Clips.dc.html")
DST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Main.dc.html")

s = io.open(SRC, encoding="utf-8").read()
before = len(s)

# ── 1. logo: the helper stores images under their basename ────────────
n_logo = s.count('src="assets/logo.png"')
s = s.replace('src="assets/logo.png"', 'src="logo.png"')
assert n_logo == 2, "expected 2 logo references, found %d" % n_logo

# ── 2. hero reel — five striped figures become five real covers ───────
HERO = ["running.webp", "finance-rules.webp", "hit-muscle.webp", "not-ugly.webp", "golden-six.webp"]
HERO_ALT = ["Running carousel cover", "Finance carousel cover", "Calisthenics carousel cover",
            "Self-improvement carousel cover", "Longevity carousel cover"]

hero_re = re.compile(
    r'<figure style="margin:0;flex:0 1 224px[^"]*"><span[^>]*>.*?</span></figure>')
hero_found = hero_re.findall(s)
assert len(hero_found) == 5, "expected 5 hero figures, found %d" % len(hero_found)

def hero_fig(name, alt):
    return (f'<figure style="margin:0;flex:0 1 224px;min-width:150px;border-radius:14px;'
            f'overflow:hidden;aspect-ratio:4/5;background:#EFEDE6">'
            f'<img src="{name}" alt="{alt}" style="width:100%;height:100%;object-fit:cover;'
            f'object-position:top center;display:block"></figure>')

for fig, name, alt in zip(hero_found, HERO, HERO_ALT):
    s = s.replace(fig, hero_fig(name, alt), 1)

# ── 3. campaign cards — unroll the loop with real covers and honest copy ──
CAMPS = [
    ("finance-rules.webp", "Finance creators",   "Typical rate &middot; per view", "$1.10"),
    ("golden-six.webp",    "Longevity &amp; health", "Typical rate &middot; per view", "$0.95"),
    ("info-power.webp",    "Business &amp; mindset", "Typical rate &middot; per view", "$1.40"),
]
camp_block = re.search(r'<sc-for list="\{\{ camps \}\}".*?</sc-for>', s, re.S)
assert camp_block, "campaign loop not found"
tpl = camp_block.group(0)
inner = re.sub(r'^<sc-for[^>]*>|</sc-for>$', '', tpl.strip(), flags=re.S).strip()

cards = []
for img, name, sub, rate in CAMPS:
    c = inner
    # the striped cover div -> a real still
    c = re.sub(
        r'<div style="border-radius:11px;aspect-ratio:16/10;background:repeating-linear-gradient[^"]*"[^>]*>.*?</div>',
        f'<div style="border-radius:11px;aspect-ratio:16/10;overflow:hidden;background:#EFEDE6">'
        f'<img src="{img}" alt="{name} campaign example" style="width:100%;height:100%;'
        f'object-fit:cover;object-position:top center;display:block"></div>',
        c, count=1, flags=re.S)
    c = c.replace("{{ c.name }}", name).replace("{{ c.sub }}", sub)
    c = c.replace("{{ c.tag }}", "Per view").replace("{{ c.rate }}", rate)
    cards.append(c)
s = s.replace(tpl, "\n".join(cards))

# ── 4. gallery — unroll to the full fifteen, captions without fake numbers ──
GALLERY = [
    ("finance-rules.webp", "Finance"),     ("golden-six.webp", "Longevity"),
    ("running.webp", "Running"),           ("hit-muscle.webp", "Calisthenics"),
    ("lazy-habits.webp", "Athletics"),     ("ufc.webp", "Combat sports"),
    ("photoshoot.webp", "Brand / DTC"),    ("info-power.webp", "Mindset"),
    ("premium.webp", "Design"),            ("bad-vs-viral.webp", "Design"),
    ("same-carousel.webp", "Marketing"),   ("teach.webp", "Education"),
    ("fonts.webp", "Design"),              ("not-ugly.webp", "Self-improvement"),
    ("running-3.webp", "Running"),
]
gal_block = re.search(r'<sc-for list="\{\{ gallery \}\}".*?</sc-for>', s, re.S)
assert gal_block, "gallery loop not found"
gtpl = gal_block.group(0)
ginner = re.sub(r'^<sc-for[^>]*>|</sc-for>$', '', gtpl.strip(), flags=re.S).strip()

tiles = []
for img, label in GALLERY:
    t = ginner
    t = re.sub(
        r'<div style="border-radius:14px;aspect-ratio:4/5;background:repeating-linear-gradient[^"]*"[^>]*>.*?</div>',
        f'<div style="border-radius:14px;aspect-ratio:4/5;overflow:hidden;background:#EFEDE6">'
        f'<img src="{img}" alt="{label} carousel cover" style="width:100%;height:100%;'
        f'object-fit:cover;object-position:top center;display:block"></div>',
        t, count=1, flags=re.S)
    t = t.replace("{{ g }}", label)
    tiles.append(t)
s = s.replace(gtpl, "\n".join(tiles))

# ── 5. drop the now-unused data from renderVals ───────────────────────
s = re.sub(r'\n\s*camps: \[.*?\],\n', "\n", s, flags=re.S)
s = re.sub(r'\n\s*gallery: \[[^\]]*\],\n', "\n", s, flags=re.S)

# ── 6. the campaign pays the clipper, not us ──────────────────────────
copy_fix = [
    ("Post and cash out", "Post and get paid"),
    ("From campaign to cash out.", "Everything between brief and payout."),
    ("Get paid per verified view, same as video.",
     "The campaign pays you per verified view, same as video."),
]
for old, new in copy_fix:
    s = s.replace(old, new)

io.open(DST, "w", encoding="utf-8").write(s)

# carry the logo in beside the carousels
shutil.copy(os.path.join(os.path.dirname(SRC), "assets", "logo.png"),
            os.path.join(os.path.dirname(DST), "logo.png"))

print("Main.dc.html written  (%d -> %d bytes)" % (before, len(s)))
print("  hero covers      : %d" % len(HERO))
print("  campaign cards   : %d" % len(CAMPS))
print("  gallery tiles    : %d" % len(GALLERY))
print("  logo refs fixed  : %d" % n_logo)
leftover = s.count("repeating-linear-gradient(135deg,#EFEDE6")
print("  placeholders left: %d" % leftover)
for probe in ("{{ c.", "{{ g", "sc-for", "assets/logo"):
    print("  contains %-14s: %s" % (probe, probe in s))
