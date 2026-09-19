-- 0016: the sets table accepted 5..10 slides; the demo's short sets are 4.
-- The floor moves to 4 in the table, and fc_reserve_set stays the gate that
-- keeps 5 as the minimum for every workspace but the demo (migration 0015).
alter table public.sets drop constraint if exists sets_slides_min_check;
alter table public.sets drop constraint if exists sets_slides_max_check;
alter table public.sets add constraint sets_slides_min_check check (slides_min >= 4 and slides_min <= 10);
alter table public.sets add constraint sets_slides_max_check check (slides_max >= 4 and slides_max <= 10);
