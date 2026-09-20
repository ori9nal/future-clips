-- 0028: every new account gets a workspace again.
--
-- 0024 rewrote handle_new_user from 0008's text, and 0008 was never applied
-- (D-017 keeps the partner schema dormant), so the trigger inserted an
-- orgs.is_partner that does not exist. Every sign-up since — invited or not —
-- died with "Database error saving new user", which the app then showed as
-- "not on the invite list" (lib/login.ts mapped the two together; it no
-- longer does). The same function, referencing only columns that are there;
-- personal_plan (0024) stays.
--
-- Sign-up is also open from today (owner, 2026-09-20): app_settings.signup
-- is {"mode":"open"}, so gate_new_user no longer consults allowed_emails and
-- a stranger's email gets its own free workspace to buy a plan from.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare a record; personal uuid;
begin
  select * into a from public.allowed_emails where email = lower(new.email)::extensions.citext;
  insert into public.orgs (name, plan)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My workspace'),
          coalesce(a.personal_plan, 'free'))
    returning id into personal;
  insert into public.members (org_id, user_id, role) values (personal, new.id, 'owner');
  -- an invite may also seat them in an existing workspace (how an admin is made)
  if a.org_id is not null then
    insert into public.members (org_id, user_id, role) values (a.org_id, new.id, a.role)
      on conflict (org_id, user_id) do update set role = excluded.role;
  end if;
  return new;
end $$;

update public.app_settings set value = jsonb_build_object('mode', 'open'), updated_at = now() where key = 'signup';
