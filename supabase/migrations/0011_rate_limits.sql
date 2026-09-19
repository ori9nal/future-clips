-- 0011: a fixed-window rate limiter the app calls from the server (service
-- role only). Keys are sha256 hashes of what is being limited (an IP, an
-- email), so the table never holds a plain address. Public sign-in routes
-- use it so nobody can burn the mailer quota or hammer a victim's inbox.
create table public.rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- true while the key is under p_limit hits in the last p_window_s seconds
create or replace function public.fc_rate_limit(p_key text, p_limit integer, p_window_s integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare c integer;
begin
  insert into public.rate_limits (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_s) then 1 else public.rate_limits.count + 1 end,
    window_start = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_s) then now() else public.rate_limits.window_start end
  returning count into c;
  -- keep the table small: drop rows whose window closed more than a day ago (cheap, occasional)
  if random() < 0.01 then delete from public.rate_limits where window_start < now() - interval '1 day'; end if;
  return c <= p_limit;
end $$;
revoke all on function public.fc_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.fc_rate_limit(text, integer, integer) to service_role;
