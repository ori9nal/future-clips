-- 0018: the allowances the measured cost supports (D-044, Product's P-20).
-- The prices do not move. At $0.027 a batch slide and $0.0582 a priority
-- slide (Product, 18 sets, 138 slides) these hold the owner's rule — 50%
-- margin after 15% to the agency and about 5% payment fees — at the measured
-- 60% utilisation, and stay above 35% for a customer who uses everything.
-- Before: Pro 500 + 50 (29% at full use), Studio 1,500 + 150 (18%).
update public.plans set slides_per_month = 200,  priority_slides_per_month = 0   where id = 'solo';
update public.plans set slides_per_month = 400,  priority_slides_per_month = 50  where id = 'grind';
update public.plans set slides_per_month = 1000, priority_slides_per_month = 100 where id = 'agency';

-- the default spend cap follows the allowance (the 0010 rule: reserve rates x 1.5)
update public.plans
   set cogs_allowance_usd = round((slides_per_month * 0.03 + priority_slides_per_month * 0.06) * 1.5, 2)
 where id <> 'free';
