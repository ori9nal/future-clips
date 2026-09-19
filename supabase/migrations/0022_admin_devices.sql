-- 0022: the admin surface is limited to devices that have been trusted once.
--
-- Being a platform owner is one factor (a mailbox). A second one that does not
-- depend on the mailbox: a long random token in an http-only cookie, whose
-- SHA-256 is the only thing stored here. A stolen database row cannot be
-- replayed as a cookie, and a lost laptop is revoked by deleting its row.
--
-- Enrolment asks for FC_ADMIN_SECRET (lib/adminDevice.ts). Where that variable
-- is not set the gate stays OFF, so a host without it behaves exactly as
-- before rather than locking the owner out of their own admin.
create table if not exists public.admin_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  token_sha256  text not null unique,
  label         text,
  agent         text,
  created_ip    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  revoked_at    timestamptz
);
create index if not exists admin_devices_user on public.admin_devices (user_id, revoked_at);
alter table public.admin_devices enable row level security;
revoke all on public.admin_devices from anon, authenticated;

-- a platform owner reads and revokes only their own devices; nothing may be
-- inserted directly (the token hash arrives through the gate below)
drop policy if exists admin_devices_self on public.admin_devices;
drop policy if exists admin_devices_revoke on public.admin_devices;
create policy admin_devices_self on public.admin_devices for select to authenticated
  using (user_id = auth.uid() and public.is_platform_owner());
create policy admin_devices_revoke on public.admin_devices for update to authenticated
  using (user_id = auth.uid() and public.is_platform_owner())
  with check (user_id = auth.uid());
grant select, update on public.admin_devices to authenticated;

/** Trust this device. Returns the new row's id; raises when there are already too many. */
create or replace function public.fc_trust_device(p_hash text, p_label text, p_agent text, p_ip text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_live integer;
begin
  if not public.is_platform_owner() then raise exception 'FC_FORBIDDEN' using errcode = '42501'; end if;
  if p_hash is null or length(p_hash) <> 64 then raise exception 'FC_BAD_TOKEN'; end if;
  select count(*) into v_live from public.admin_devices where user_id = auth.uid() and revoked_at is null;
  if v_live >= 5 then raise exception 'FC_TOO_MANY_DEVICES' using detail = 'revoke one first'; end if;
  insert into public.admin_devices (user_id, token_sha256, label, agent, created_ip, last_seen_at)
  values (auth.uid(), p_hash, nullif(left(coalesce(p_label, ''), 60), ''), nullif(left(coalesce(p_agent, ''), 200), ''), nullif(left(coalesce(p_ip, ''), 60), ''), now())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.fc_trust_device(text, text, text, text) from public, anon;
grant execute on function public.fc_trust_device(text, text, text, text) to authenticated;

/** Is this cookie a live device of the caller? Marks it seen when it is. */
create or replace function public.fc_device_ok(p_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  if not public.is_platform_owner() then return false; end if;
  update public.admin_devices set last_seen_at = now()
    where token_sha256 = p_hash and user_id = auth.uid() and revoked_at is null
    returning true into v_ok;
  return coalesce(v_ok, false);
end $$;
revoke all on function public.fc_device_ok(text) from public, anon;
grant execute on function public.fc_device_ok(text) to authenticated;
