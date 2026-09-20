-- 0029: the main product shows only the briefs the owner puts there.
--
-- Every brief in the table was a platform row (org_id null), and the read
-- policy shows platform rows to every signed-in customer — so a paying
-- customer's picker offered twenty-one fictional campaigns. They are the
-- demo's material: they move to the demo workspace, where its visitors keep
-- generating against them (fc_reserve_set accepts c.org_id = p_org) and
-- nobody else can see them. Real briefs arrive through /admin as platform
-- rows, as before; lib/db/campaigns.ts saveSpec now keeps a row's org_id on
-- edit, so touching a demo brief in /admin cannot hand it back to everyone.

-- platform owners see and manage every brief, whichever workspace holds it —
-- otherwise the demo's briefs would vanish from /admin the moment they moved
drop policy if exists campaigns_platform_write on public.campaigns;
create policy campaigns_platform_write on public.campaigns
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns
  for select to authenticated
  using (org_id is null or org_id in (select public.my_org_ids()) or public.is_platform_owner());

-- the fixture briefs are the demo's
update public.campaigns
   set org_id = '0d3e0000-0000-4000-8000-000000000001', updated_at = now()
 where org_id is null and kind = 'spec';

-- the five brand-kit fixtures of the older model: no sets, no samples, not in
-- the demo manifest, shown nowhere but /admin
delete from public.campaigns where org_id is null and kind = 'campaign';
