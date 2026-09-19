-- 0025: admin asks for a code every time.
--
-- 0022 trusted a device for three months, which is one code every quarter. The
-- owner asked for a code every time, so the gate is now a rotating six-digit
-- code from an authenticator app (RFC 6238) and an unlock that lasts hours,
-- not months. No email is involved: a code that arrives by mail is only as
-- good as the mailbox, which is the factor this is meant to be independent of.
create table if not exists public.admin_totp (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  secret       text not null,
  confirmed_at timestamptz,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  last_step    bigint                       -- the step already spent, so a code cannot be replayed
);
alter table public.admin_totp enable row level security;
revoke all on public.admin_totp from anon, authenticated;

create table if not exists public.admin_unlocks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  token_sha256 text not null unique,
  agent        text,
  ip           text,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  ended_at     timestamptz
);
create index if not exists admin_unlocks_user on public.admin_unlocks (user_id, expires_at desc);
alter table public.admin_unlocks enable row level security;
revoke all on public.admin_unlocks from anon;
grant select, update on public.admin_unlocks to authenticated;
drop policy if exists admin_unlocks_self on public.admin_unlocks;
create policy admin_unlocks_self on public.admin_unlocks for select to authenticated
  using (user_id = auth.uid() and public.is_platform_owner());
drop policy if exists admin_unlocks_end on public.admin_unlocks;
create policy admin_unlocks_end on public.admin_unlocks for update to authenticated
  using (user_id = auth.uid() and public.is_platform_owner()) with check (user_id = auth.uid());

create or replace function public.fc_totp_state()
returns table (enrolled boolean, confirmed boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN' using errcode = '42501'; end if;
  return query select exists (select 1 from public.admin_totp t where t.user_id = auth.uid()),
                      exists (select 1 from public.admin_totp t where t.user_id = auth.uid() and t.confirmed_at is not null);
end $$;
revoke all on function public.fc_totp_state() from public, anon;
grant execute on function public.fc_totp_state() to authenticated;

create or replace function public.fc_totp_begin(p_secret text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN' using errcode = '42501'; end if;
  if exists (select 1 from public.admin_totp t where t.user_id = auth.uid() and t.confirmed_at is not null) then
    raise exception 'FC_TOTP_SET' using detail = 'an authenticator is already confirmed for this account';
  end if;
  insert into public.admin_totp (user_id, secret) values (auth.uid(), p_secret)
    on conflict (user_id) do update set secret = excluded.secret, created_at = now(), confirmed_at = null, last_step = null;
end $$;
revoke all on function public.fc_totp_begin(text) from public, anon;
grant execute on function public.fc_totp_begin(text) to authenticated;

create or replace function public.fc_totp_secret()
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN' using errcode = '42501'; end if;
  select secret into v from public.admin_totp where user_id = auth.uid();
  return v;
end $$;
revoke all on function public.fc_totp_secret() from public, anon;
grant execute on function public.fc_totp_secret() to authenticated;

create or replace function public.fc_totp_unlock(p_step bigint, p_hash text, p_hours integer, p_agent text, p_ip text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_last bigint; v_id uuid;
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN' using errcode = '42501'; end if;
  if p_hash is null or length(p_hash) <> 64 then raise exception 'FC_BAD_TOKEN'; end if;
  select last_step into v_last from public.admin_totp where user_id = auth.uid() for update;
  if v_last is not null and p_step <= v_last then raise exception 'FC_CODE_USED' using detail = 'that code has already been used'; end if;
  update public.admin_totp set confirmed_at = coalesce(confirmed_at, now()), last_used_at = now(), last_step = p_step
    where user_id = auth.uid();
  insert into public.admin_unlocks (user_id, token_sha256, agent, ip, expires_at)
  values (auth.uid(), p_hash, nullif(left(coalesce(p_agent, ''), 200), ''), nullif(left(coalesce(p_ip, ''), 60), ''),
          now() + make_interval(hours => greatest(1, least(coalesce(p_hours, 8), 24))))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.fc_totp_unlock(bigint, text, integer, text, text) from public, anon;
grant execute on function public.fc_totp_unlock(bigint, text, integer, text, text) to authenticated;

create or replace function public.fc_unlocked(p_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v boolean;
begin
  if not public.is_platform_owner() then return false; end if;
  select true into v from public.admin_unlocks
   where token_sha256 = p_hash and user_id = auth.uid() and ended_at is null and expires_at > now();
  return coalesce(v, false);
end $$;
revoke all on function public.fc_unlocked(text) from public, anon;
grant execute on function public.fc_unlocked(text) to authenticated;

/** Forget this owner's authenticator so a new one can be enrolled. */
create or replace function public.fc_totp_reset()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN' using errcode = '42501'; end if;
  delete from public.admin_totp where user_id = auth.uid();
  update public.admin_unlocks set ended_at = now() where user_id = auth.uid() and ended_at is null;
end $$;
revoke all on function public.fc_totp_reset() from public, anon;
grant execute on function public.fc_totp_reset() to authenticated;
