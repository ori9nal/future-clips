-- Owner decision 2026-09-12: allowances are metered and shown in SLIDES, not
-- sets, and the customer-facing word for the instant lane is "priority".
-- Internal mode names (queued | instant) are unchanged in sets.mode.
-- Conversion: the table's set counts x 7 (the measured average set, the
-- number the per-set COGS was built on). Per-slide COGS: batch $0.025,
-- realtime $0.05 - the same allowances as the per-set table at 7 slides.
alter table public.plans rename column queued_per_month  to slides_per_month;
alter table public.plans rename column instant_per_month to priority_slides_per_month;
alter table public.plans rename column extra_queued_usd  to extra_slide_usd;
alter table public.plans rename column extra_instant_usd to extra_priority_slide_usd;
alter table public.plans rename column hd_price_usd      to hd_per_slide_usd;

update public.plans set slides_per_month = 0,    priority_slides_per_month = 0,   extra_slide_usd = null, extra_priority_slide_usd = null, hd_per_slide_usd = null where id = 'free';
update public.plans set slides_per_month = 350,  priority_slides_per_month = 0,   extra_slide_usd = 0.06, extra_priority_slide_usd = 0.10, hd_per_slide_usd = null where id = 'solo';
update public.plans set slides_per_month = 840,  priority_slides_per_month = 84,  extra_slide_usd = 0.06, extra_priority_slide_usd = 0.10, hd_per_slide_usd = 0.35 where id = 'grind';
update public.plans set slides_per_month = 4200, priority_slides_per_month = 350, extra_slide_usd = 0.06, extra_priority_slide_usd = 0.10, hd_per_slide_usd = 0.30 where id = 'agency';

alter table public.usage rename column queued_used  to slides_used;
alter table public.usage rename column instant_used to priority_slides_used;
alter table public.usage rename column hd_used      to hd_slides_used;
alter table public.usage rename column extras_purchased_queued  to extra_slides_purchased;
alter table public.usage rename column extras_purchased_instant to extra_priority_slides_purchased;
alter table public.usage rename column extras_purchased_hd      to extra_hd_slides_purchased;
