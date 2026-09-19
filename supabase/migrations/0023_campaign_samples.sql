-- 0023: every live campaign carries a sample — three slides, the same three
-- for everyone, so someone without a plan can see what a brief turns into
-- before they pay.
--
-- The sample is a REAL set the engine rendered at the brief's own minimum
-- (a three-slide set cannot pass compliance: most briefs ask for five or six),
-- and the sample is its first three slides. They are copied into a public
-- bucket, because a sample with a signed URL is not a sample.
alter table public.sets add column if not exists is_sample boolean not null default false;
alter table public.campaigns add column if not exists sample jsonb;
comment on column public.campaigns.sample is 'the three public slide URLs and the caption, written by the worker when a sample set finishes';

insert into storage.buckets (id, name, public) values ('samples', 'samples', true)
on conflict (id) do update set public = true;

drop policy if exists samples_public_read on storage.objects;
drop policy if exists samples_owner_write on storage.objects;
create policy samples_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'samples');
create policy samples_owner_write on storage.objects for all to authenticated
  using (bucket_id = 'samples' and public.is_platform_owner())
  with check (bucket_id = 'samples' and public.is_platform_owner());

/**
 * Queue a campaign's sample. Platform owners only; the platform org pays for
 * it, and it never touches a customer's allowance or spend cap.
 */
create or replace function public.fc_queue_sample(p_campaign text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_min integer; v_style text; v_ask text; v_id uuid; v_data jsonb;
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN' using errcode = '42501'; end if;
  select id into v_org from public.orgs where is_platform limit 1;
  if v_org is null then raise exception 'FC_NO_PLATFORM_ORG'; end if;

  select c.data into v_data from public.campaigns c
   where c.id = p_campaign and c.kind = 'spec' and c.status = 'live';
  if v_data is null then raise exception 'FC_NO_CAMPAIGN' using detail = 'no live brief with that id'; end if;

  v_min := greatest(coalesce((v_data->'requirements'->>'min_slides')::integer, 5), 5);
  v_style := coalesce(v_data->'content'->>'style', 'native');
  -- the first angle the brief suggests, else something the brief can answer
  v_ask := coalesce(
    nullif(v_data->'guidance'->'angles'->>0, ''),
    'what ' || coalesce(v_data->>'brand', 'this') || ' changed for me');

  -- one live sample per campaign: an unfinished one is replaced
  update public.sets set status = 'failed', stage = 'failed', error = 'replaced by a newer sample'
   where campaign_id = p_campaign and is_sample and status in ('queued', 'rendering');

  insert into public.sets (org_id, user_id, campaign_id, style, ask, slides_min, slides_max,
                           reserved_slides, quality, lane, hd, status, stage, is_sample, reserve_usd, from_balance)
  values (v_org, auth.uid(), p_campaign, v_style, v_ask, v_min, v_min,
          v_min, 'medium', 'priority', false, 'queued', 'copy:submit', true, 0, 0)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.fc_queue_sample(text) from public, anon;
grant execute on function public.fc_queue_sample(text) to authenticated;
