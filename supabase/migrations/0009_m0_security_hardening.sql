-- 0009: M0 security hardening. Applied 2026-09-18 through the Supabase MCP as
-- `m0_security_hardening`. File numbers are the record, not the apply order:
-- 0005-0008 are still unapplied drafts (see docs/DATABASE.md).
--
-- S2 (audit §15): the public `site` bucket accepted anonymous uploads of HTML
-- and JS with the publishable key, and the site build pulled its homepage from
-- that bucket by name. Public read stays; writes are service role / dashboard.
drop policy if exists site_anon_insert on storage.objects;

-- S5: the waitlist form no longer exists on the site; nothing inserts here.
drop policy if exists signups_anon_insert on public.signups;

-- S6: anon held ALL table privileges (TRUNCATE included) on every public
-- table with RLS as the only barrier. Take them back; keep one read so the
-- keepalive/health anon request still reaches Postgres (RLS returns no rows).
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.plans to anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- and stop Supabase's default grants from handing new objects to anon
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- S7: the member update guard listed 19 columns; caption, content_json,
-- compliance_json, error, storage_prefix, cost_json, batch_ids, creator_id,
-- pairing_id, look, is_extra, started_at, finished_at were left writable on a
-- member's own queued rows. Compare the whole row except the one column a
-- member may flip, so a column added later is protected by construction.
create or replace function public.sets_member_update_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() = 'authenticated' then
    if (to_jsonb(new) - 'cancel_requested' - 'updated_at') is distinct from (to_jsonb(old) - 'cancel_requested' - 'updated_at') then
      raise exception 'FC_READ_ONLY' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.sets_member_update_guard() from public, anon, authenticated;
