-- 0015: the demo workspace may generate short sets. The gate accepts a
-- 4-slide range for demo orgs only (everyone else stays 5–10, D-007), the
-- demo org has no priority allowance to hit, and it gets a firm monthly
-- spend cap. Applied 2026-09-19 as `demo_generation`; the function body is
-- 0010's fc_reserve_set with the org row read before the range check,
-- `v_floor := case when v_org.is_demo then 4 else 5 end`, and the priority
-- allowance checks skipped for demo orgs (the spend cap is their limit).
update public.orgs set spend_cap_usd = 15.00 where is_demo;
-- (see the dashboard migration `demo_generation` for the exact function text)
