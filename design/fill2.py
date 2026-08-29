# -*- coding: utf-8 -*-
"""Fill the second Future Clips design and apply the four requested changes.

Asset refs in a Design Component resolve by LITERAL filename substitution, so
bound srcs never resolve — the examples loop is unrolled into literal markup.

Also corrected: the example tiles carried invented view counts (1.2M, 840K...)
and the hero had a counter animating up to an invented view total. Those would
sit on other people's real posts once the images went in.
"""
import io, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "incoming2", "Future Clips.dc.html")
DST = os.path.join(HERE, "Main.dc.html")

s = io.open(SRC, encoding="utf-8").read()
report = []

def sub1(pattern, repl, label, flags=re.S):
    global s
    new, n = re.subn(pattern, repl, s, count=1, flags=flags)
    assert n == 1, "MISS: " + label
    s = new
    report.append(label)

def rep(old, new, label, expect=1):
    global s
    n = s.count(old)
    assert n == expect, "%s: expected %d, found %d" % (label, expect, n)
    s = s.replace(old, new)
    report.append(label)

# ── 1. logo resolves by basename ──────────────────────────────────────
rep('src="assets/logo.png"', 'src="logo.png"', "logo path -> basename", expect=2)

# ── 2. nav becomes a floating island ──────────────────────────────────
rep('<header style="position:sticky;top:0;z-index:60;background:rgba(250,249,246,.78);backdrop-filter:blur(16px);border-bottom:1px solid #EAE7DE">',
    '<header style="position:sticky;top:0;z-index:60;padding:clamp(10px,2vw,16px) clamp(12px,3vw,22px) 0;background:transparent">\n'
    '  <div style="width:100%;max-width:1180px;margin-inline:auto">',
    "header -> transparent shell + island wrapper")

rep('<div style="width:100%;max-width:1240px;margin-inline:auto;padding-inline:clamp(18px,4vw,36px);display:flex;align-items:center;justify-content:space-between;height:clamp(66px,8vw,78px);gap:16px">',
    '<div style="width:100%;padding-inline:clamp(14px,2.6vw,22px);display:flex;align-items:center;'
    'justify-content:space-between;height:clamp(58px,8vw,68px);gap:16px;background:rgba(253,252,248,.86);'
    'backdrop-filter:blur(18px) saturate(160%);border:1px solid #E7E4DB;border-radius:16px;'
    'box-shadow:0 10px 30px -14px rgba(14,14,16,.18)">',
    "inner bar -> rounded floating island")

# close the wrapper we opened
rep('</header>', '  </div>\n</header>', "close island wrapper")

# the mobile panel floats under the island instead of being a full-bleed drawer
sub1(r'mobileMenuStyle: mobile && menuOpen\s*\?\s*\{[^}]*\}',
     'mobileMenuStyle: mobile && menuOpen\n        ? { display: "block", marginTop: "10px", background: "rgba(253,252,248,.97)", '
     'backdropFilter: "blur(18px)", border: "1px solid #E7E4DB", borderRadius: "16px", '
     'boxShadow: "0 18px 40px -18px rgba(14,14,16,.22)", overflow: "hidden" }',
     "mobile menu -> floating card")

# ── 3. hero stills ────────────────────────────────────────────────────
def still(name, alt, radius=14):
    return (f'<div style="border-radius:{radius}px;overflow:hidden;aspect-ratio:4/5;background:#EFEDE6">'
            f'<img src="{name}" alt="{alt}" style="width:100%;height:100%;object-fit:cover;'
            f'object-position:top center;display:block"></div>')

# left and right small stills
side = re.compile(r'<div style="flex:0 1 200px;min-width:132px;max-width:230px;border-radius:14px;'
                  r'overflow:hidden;aspect-ratio:4/5;background:repeating-linear-gradient[^"]*"[^>]*>.*?</div>',
                  re.S)
sides = side.findall(s)
assert len(sides) == 2, "expected 2 side stills, found %d" % len(sides)
for fig, (nm, alt) in zip(sides, [("running.webp", "Running carousel, slide one"),
                                  ("hit-muscle.webp", "Calisthenics carousel, slide three")]):
    s = s.replace(fig,
        f'<div style="flex:0 1 200px;min-width:132px;max-width:230px">{still(nm, alt)}</div>', 1)
report.append("hero side stills x2")

# centre cover still
sub1(r'<div style="border-radius:18px;overflow:hidden;aspect-ratio:4/5;background:repeating-linear-gradient\(135deg,#EDEAE1[^"]*"[^>]*>.*?</div>',
     still("finance-rules.webp", "Finance carousel cover slide", radius=18),
     "hero centre cover still")

# ── 4. the hero badge stated an invented view total ───────────────────
rep('{{ viewsText }}', '2 min', "hero badge -> product figure, not a fake view count")
rep('>Views</span>', '>Per slideshow</span>', "hero badge label")

# ── 5. examples: unroll with real stills, drop invented view counts ───
EXAMPLES = [
    ("finance-rules.webp", "Finance"),   ("golden-six.webp", "Longevity"),
    ("running.webp", "Running"),         ("hit-muscle.webp", "Calisthenics"),
    ("lazy-habits.webp", "Athletics"),   ("ufc.webp", "Combat sports"),
    ("photoshoot.webp", "Brand / DTC"),  ("info-power.webp", "Mindset"),
    ("premium.webp", "Design"),          ("bad-vs-viral.webp", "Design"),
    ("same-carousel.webp", "Marketing"), ("teach.webp", "Education"),
    ("fonts.webp", "Design"),            ("not-ugly.webp", "Self-improvement"),
]
block = re.search(r'<sc-for list="\{\{ examples \}\}".*?</sc-for>', s, re.S)
assert block, "examples loop not found"
tpl = block.group(0)
inner = re.sub(r'^<sc-for[^>]*>|</sc-for>$', '', tpl.strip(), flags=re.S).strip()

tiles = []
for img, niche in EXAMPLES:
    t = inner
    # striped box + the "example slideshow" label + the view badge -> one still
    t = re.sub(r'<div style="position:relative;border-radius:14px;aspect-ratio:4/5;'
               r'background:repeating-linear-gradient[^"]*"[^>]*>.*?</div>',
               f'<div style="border-radius:14px;overflow:hidden;aspect-ratio:4/5;background:#EFEDE6">'
               f'<img src="{img}" alt="{niche} carousel cover" style="width:100%;height:100%;'
               f'object-fit:cover;object-position:top center;display:block"></div>',
               t, count=1, flags=re.S)
    t = t.replace("{{ e.niche }}", niche)
    tiles.append(t)
s = s.replace(tpl, "\n".join(tiles))
report.append("examples unrolled x%d (view badges removed)" % len(EXAMPLES))

# the caption no longer describes placeholders, and the posts need crediting
rep('Placeholder slots &mdash; drop your real exports in here.'
    if 'Placeholder slots &mdash;' in s else 'Placeholder slots — drop your real exports in here.',
    'Posts by their respective creators, shown with permission. Not produced by Future Clips.',
    "examples caption -> permission credit")

# drop the now-unused data + counter state
s = re.sub(r'\n\s*examples: \[.*?\],\n', "\n", s, flags=re.S)

io.open(DST, "w", encoding="utf-8").write(s)
shutil.copy(os.path.join(HERE, "incoming2", "assets", "logo.png"), os.path.join(HERE, "logo.png"))

print("Main.dc.html written (%d bytes)" % len(s))
for r in report:
    print("  + " + r)
print()
print("  striped placeholders left : %d" % (s.count("repeating-linear-gradient(135deg,#EFEDE6")
                                            + s.count("repeating-linear-gradient(135deg,#EDEAE1")))
for probe in ("{{ e.", "{{ viewsText", "sc-for list=\"{{ examples", "assets/logo", "1.2M", "840K", "2.1M"):
    print("  contains %-26s: %s" % (probe, probe in s))
