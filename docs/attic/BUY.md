# BUY.md — exactly what to buy, and what each thing fixes

You rated it 37/100 with three named failures. Two are **self-inflicted and free
to fix**. Only one needs money. Here is the whole list.

---

## The shopping list

| # | what | cost | fixes |
|---|---|---|---|
| 1 | **Anthropic API key** | ~$0.03 per carousel, pay-as-you-go | **"no hook"** — the biggest one |
| 2 | **Higgsfield ULTRA** | $70/mo billed annually (or $99/mo) | real people in frame, mascot consistency, hero images |
| 3 | **A real campaign's assets** | free — you send them | **"not a real campaign thing"** |

**That is everything.** Nothing else is needed:

| already solved | how |
|---|---|
| backgrounds | free keyless endpoint — tested, ~2.5s, $0 |
| fonts | Google Fonts, downloaded, commercially licensed |
| matting | BiRefNet self-hosted, $0 |
| pose control | ControlNet OpenPose, Apache 2.0, $0 |
| composition | the engine, CPU only |
| database / auth | Supabase free tier until real users |
| payments | Stripe takes a cut, no upfront |

One thing that is **not** optional later: **Vercel Pro before you take a single
payment.** The Hobby plan prohibits commercial use.

---

## Ongoing cost at steady state

| per carousel (7 slides) | |
|---|---|
| hooks + copy (`claude-haiku-4-5`) | $0.025 |
| QC vision pass (`claude-sonnet-5`) | $0.042 |
| backgrounds | $0.00 |
| render + storage | $0.0006 |
| **total** | **≈ $0.068** |

| per campaign, once | |
|---|---|
| mascot pose sheet, 28 poses on Nano Banana Pro | ~$1.30 (or **$0** inside ULTRA's 7-day unlimited window) |
| hero images, ~12 | ~$0.55 |
| **setup** | **≈ $1.85** |

At **$20 / 35 slides** on the worst case (agency takes 25%): $14.12 available,
~$0.34 of generation, ~$0.02 amortised setup → **≈ 68% net margin**.

Higgsfield ULTRA at $70/mo is a **fixed cost, not per-user** — it pays for itself
at four subscribers and stops mattering entirely after that.

---

## Why "no hook" is the expensive failure, and what fixes it

I looked at @growithalex's actual grid. **Every hook is an offer, not a claim:**

> steal my **content system** for posting weekly
> steal my **carousel layouts**
> **color combos** that make designs stand out
> CAROUSEL — *100k saves*

The pattern is **"steal my X"** — a transferable asset the viewer can take, often
with a number as proof (*100k saves*, *17 Claude skills*).

Mine were: *"You are not undertrained."* *"Sleep is a session."* Those are
**claims**. Nobody swipes for a claim. They swipe for a thing they can have.

That is a copy problem, not a design problem, and it is why the Anthropic key is
item 1 — the hooks are currently hand-written by me, and a hook generator scored
against the corpus distribution is the single highest-leverage thing left.

## Why "no good colours" is free to fix

Self-inflicted. I literally prompted the backgrounds with *"muted desaturated
colour grade, cool shadows"*. growithalex runs **deep cobalt skies, orange
desert, saturated blue** with white serif over the top. High saturation, high
contrast.

Changing that is a one-line prompt edit and costs nothing. I made the set dull
on purpose and then showed it to you.

## Why "not a real campaign" needs you, not money

MERIDIAN is invented. I built its palette, voice and product out of nothing, so
of course it reads as a mock. **Send me one real thing** and it stops being a
mock:

- a **Whop campaign** you would actually clip for — the brief, the rules, the CPM
- the brand's **logo, colours, product shots**
- a **source video or clip** if the campaign has one
- the handle to tag

Even a screenshot of a live campaign page plus the brand's Instagram is enough
to start.

---

## What I would do the moment each arrives

| you send | I do, same session |
|---|---|
| Anthropic key | hook generator scored on gap-opening + word count against the corpus; regenerate all copy; add the per-slide QC pass |
| Higgsfield ULTRA | mascot pose sheet inside the unlimited window; real people in frame; hero images per campaign |
| a real campaign | rebuild the whole set against its actual brand kit and rules, and validate for payout |

**Cheapest possible start: just the Anthropic key.** It fixes the failure you
ranked first, costs pennies per carousel, and needs no subscription. The colour
fix is free and I will do it regardless.
