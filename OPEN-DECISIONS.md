# OPEN-DECISIONS.md

Decisions only the owner can make. Each entry says what was done in the
meantime so nothing is blocked on the answer. Newest at the bottom.

## 1. Agency referral share — not in the pricing table

The admin UI and the old marketing page both carried a "25% share" for agency
referral codes (`?ref=CODE` is still persisted to `signups.agency_code`). The
pricing table has no such row, so **it is not implemented**: an Agency-tier
customer pays $249/mo and gets 10 seats, and that is the whole relationship in
the code today.

**Decide:** does an Agency customer also earn a share on referred accounts, or
is $249 the entire relationship? If a share exists, it needs a ledger, a
payout method, and tax handling — a separate phase, not a toggle.

## 2. View counter — removed

The hero badge rolled up to a pinned `1,304,895` views. Future Clips has no
measured view figure: the example carousels are other creators' posts shown
with permission, and the product has shipped no sets to a public account. A
payment-provider reviewer would read the counter as a claim.

**Done (2026-09-11):** the counter is gone. The badge now says `5–10 · slides
per set`, which is a spec fact from the table. `VIEWS_TARGET` is removed from
`design/build_site.py`.

**Decide:** whether to restore a counter once there is a measured figure
(e.g. views on sets rendered by paying customers, reported by them), or leave
the badge as a spec fact.

## 3. Marketing copy that contradicted the table — changed

Beyond the price cards, the page claimed "2 free slideshows", "Make two, then
decide", "About 2 minutes" per slideshow, and an FAQ promise that "unused
slideshows roll over for one month". None of those are in the table. Changed
to: free tier = one ready-made set per live campaign; queued ≈ 1 hour, instant
≈ 5 minutes; extras at $0.40 / $0.70; **no rollover**.

**Decide:** rollover is a real policy choice with a real cost (quota debt
carried into the next month). The page now says allowances reset on the
billing date. If you want rollover, say so and the quota gate will carry it.

## 4. Yearly pricing — set to 10× monthly

The table gives monthly prices only. The page had a yearly toggle with "2
months free", so yearly is Solo $190, Grind $590, Agency $2,490. Monthly is
the default view because that is what the table specifies.

**Decide:** keep the yearly option at 10× (or drop the toggle). Phase 5 creates
the annual products; it is one line to remove.
