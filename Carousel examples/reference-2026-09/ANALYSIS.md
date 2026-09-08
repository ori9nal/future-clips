# What these 15 sets actually are

Extracted 2026-09-08 from the snaptik downloads. This corrects several things the
engine had wrong.

## Two families

**Wealth / trading** — sets 01, 02, 03, 04, 06, 11, 12, 14
Aspirational lifestyle photography: supercars, yachts, pools at night, palm trees at
sunset, penthouse windows, multi-monitor trading desks. The subject is *the life*, not a
person. Several sets never show a face at all.

**Gym / physique** — sets 05, 07, 08, 09, 10, 13, 15
Real gym footage and mirror selfies. Body-part close-ups — an arm mid-curl, a back, abs.
Phone visible in the mirror. Slightly messy, clearly shot on a phone.

## What is universal

| | |
|---|---|
| Aspect | varies: 3:4 (1080×1440), 4:5 (1200×1500), 9:16 (1080×1918) |
| Structure | numbered countdown, 4–9 slides |
| Ratings | `x/10` under the heading is common (set 08: 8/10, 3/10, 5/10, 1000/10) |
| App slide | the tracked app appears as a real phone screenshot, usually LAST |
| Caption | small, centred, thin outline — not a heavy stroke |

## Three things the engine had wrong

**1. Text is small.** On a 1080-wide canvas the heading is ~44px and body ~36px, sitting
in a compact block. The engine was setting 84–104px and filling the frame. At thumbnail
size the reference still reads because the block is tight, not because it is big.

**2. The stroke is a thin outline, not a slab.** Roughly 0.045 of the type size — enough
to separate the letterform from the photo. The engine used 0.155, which reads as a
CapCut default rather than a considered one.

**3. Character consistency was solving a problem these sets do not have.** The imagery is
aspirational or anatomical: a Ferrari, a pool, a close-up of a bicep. Different scene
every slide, often no recognisable person. Holding one face across eight frames is
effort spent on the wrong axis — and a first-person story told over one repeated model
reads as staged, which is what "same pose same person" was pointing at.

## The device the engine is missing

**App icon over lifestyle photo.** Sets 01, 04 and 14 all do it:

- full-bleed aspirational photo
- the app icon as a large rounded square, upper-centre, ~28% of canvas width
- a white pill directly under it with black text — `1. Webull`, `4. Forex Factory`
- one small caption line below, thin outline

It is the cleanest way to feature an app without a screenshot, and it is what the
trading niche runs.

## Best of the fifteen

1. **set-08** — "Top 5 PEAK exercises for BICEPS". Cleanest structure in the batch: hook,
   five rated items counting down, app screenshot last. The `x/10` ratings do the work.
2. **set-13** — "7 muscles I regret skipping". Nine slides, real physique detail shots,
   each with a genuine reason rather than a caption.
3. **set-01** — "4 trading apps I'll never uninstall". The app-icon format executed
   cleanly over sneakers, a dog, a boat, a desk.
4. **set-14** — same format, four slides, tighter. Better hook photo (a black supercar).
5. **set-11** — "How I would structure the first year". Eight slides, month-by-month, the
   most substantive copy of the batch.
