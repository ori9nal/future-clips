-- 0032: a brief owned by a workspace you belong to can be generated against
-- from any workspace of yours — and a picker shows only those.
--
-- The admins' own briefs live in the platform workspace ("Future Clips") so
-- that all three admins see them and nobody else does. Two things had to
-- follow. The gate accepted only a brief owned by nobody or by the very
-- workspace generating, so an admin's personal workspace was refused; it now
-- accepts a brief of any workspace the caller belongs to — "a brief you can
-- see, you can use", the read policy's own rule. And a platform owner could
-- READ every brief (0029, for /admin), so their picker showed the demo's
-- sixteen fixtures too; lib/db/campaigns.ts listSpecs now takes the viewer's
-- memberships and the picker shows platform briefs plus their own.
create or replace function public.fc_campaign_usable(p_campaign text)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.campaigns c
     where c.id = p_campaign and c.status = 'live'
       and (c.org_id is null or c.org_id in (select public.my_org_ids()))
  );
$$;
revoke all on function public.fc_campaign_usable(text) from public, anon;
grant execute on function public.fc_campaign_usable(text) to authenticated, service_role;

-- fc_reserve_set's campaign check becomes
--   if not public.fc_campaign_usable(p_campaign) then raise exception 'FC_NO_CAMPAIGN'; end if;
-- (applied as `reserve_set_uses_campaign_usable`; the body is otherwise 0031's)
