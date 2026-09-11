-- Advisor fix-ups after 0001 (applied through the MCP as `product_hardening`,
-- 2026-09-11). citext moves out of public; trigger functions stop being
-- callable over /rest/v1/rpc; every function pins its search_path.
alter extension citext set schema extensions;

revoke execute on function public.gate_new_user() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.invites_respect_seats() from public, anon, authenticated;
revoke execute on function public.orgs_protect_billing() from public, anon, authenticated;
revoke execute on function public.my_org_ids() from anon;
revoke execute on function public.is_platform_owner() from anon;
revoke execute on function public.is_org_owner(uuid) from anon;

-- (the four function bodies were re-created with `set search_path = public`
--  or `public, extensions` and `::extensions.citext` casts; bodies otherwise
--  identical to 0001 - see the migration in the dashboard for the exact text)
