-- 0030: there is no priority. Every set renders now, from one allowance.
--
-- Two lanes were sold: "within the day" from the monthly allowance, and
-- "priority" (made in minutes) from a separate allowance Pro and Studio got
-- (50 and 100 a month). The owner removed the tier on 2026-09-20. The slow
-- lane had rendered one set in the product's life; every set customers have
-- seen was the fast path. So the fast path is what everyone gets, and the
-- month's slides plus the balance are the one thing that limits it.
--
-- `lane` stays on the row and in the engine — it is how the renderer picks a
-- provider path (realtime vs the batch API) — but it no longer selects an
-- allowance, and the product never shows the word. The app sends 'priority'
-- for every set.
--
-- The plans lose their priority slides, and their spend caps are resized so
-- the whole allowance can be used at the fast path's reserve rate (0.06 a
-- slide, fc_reserve_rate): 200 → $12, 400 → $24, 1,000 → $60. The old caps
-- ($9 / $22.50 / $54) were sized for the slow lane and would have stopped a
-- Clipper at about 150 of the 200 slides they paid for.
--
-- Applied as `one_allowance_no_priority`: fc_reserve_set, fc_commit_set and
-- fc_release_set lose their `if v.lane = 'priority'` branches and always use
-- slides_used / slide_balance (the bodies are otherwise 0026's); the demo org
-- still skips the allowance check, its budget and spend cap being its limits.
-- No set was queued or rendering at the moment of the change, so no counter
-- was left half-moved. usage.priority_slides_used keeps its history.

update public.plans
   set priority_slides_per_month = 0,
       cogs_allowance_usd = round(slides_per_month * 0.06, 2)
 where id in ('solo', 'grind', 'agency');
