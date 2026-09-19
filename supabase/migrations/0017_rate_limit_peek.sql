-- 0017: read a limiter without consuming a slot (R16), so the demo can tell a
-- visitor how many carousels they have left today. Same hashed keys as
-- fc_rate_limit; service role only, like the limiter itself.
create or replace function public.fc_rate_limit_peek(p_key text, p_limit integer, p_window_s integer)
returns integer language sql stable security definer set search_path = public as $$
  select greatest(0, p_limit - coalesce((
    select r.count from public.rate_limits r
     where r.key = p_key and r.window_start >= now() - make_interval(secs => p_window_s)
  ), 0))
$$;
revoke all on function public.fc_rate_limit_peek(text, integer, integer) from public, anon, authenticated;
grant execute on function public.fc_rate_limit_peek(text, integer, integer) to service_role;
