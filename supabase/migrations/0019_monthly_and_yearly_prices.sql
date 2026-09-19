-- 0019: two prices per plan (D-013 answered by the owner, 2026-09-19).
-- `price_usd_month` is the monthly list price; `price_usd_year` is what a
-- year costs when it is paid in one go (the site shows it as a lower monthly
-- rate: $16, $32, $79). Allowances were sized against that lower rate, so
-- they hold on either billing (D-044).
alter table public.plans add column if not exists price_usd_year numeric(8,2);

update public.plans set price_usd_month = 19.99, price_usd_year = 192 where id = 'solo';
update public.plans set price_usd_month = 49.99, price_usd_year = 384 where id = 'grind';
update public.plans set price_usd_month = 99.99, price_usd_year = 948 where id = 'agency';
update public.plans set price_usd_month = 0,     price_usd_year = null where id = 'free';
