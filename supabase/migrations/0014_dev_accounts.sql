-- 0014: the two local test accounts. Invite rows so the sign-up gate lets
-- them in, and a paid test workspace for the tester (Pro, capped spend).
-- The users themselves are created by `node tools/dev-users.mjs` (password
-- sign-in, laptops only: /api/auth/dev with FC_DEV_LOGIN=1).
insert into public.orgs (id, name, plan, seat_limit, spend_cap_usd)
values ('0d3e0000-0000-4000-8000-000000000002', 'Product test workspace', 'grind', 5, 10.00)
on conflict (id) do nothing;

insert into public.allowed_emails (email, org_id, role, note)
values
  ('demo@thefutureclips.com',   '0d3e0000-0000-4000-8000-000000000001', 'member', 'the demo viewer (read-only showcase); local dev login'),
  ('tester@thefutureclips.com', '0d3e0000-0000-4000-8000-000000000002', 'owner',  'the Product chat''s test account (Pro, $10 spend cap); local dev login')
on conflict (email) do nothing;
