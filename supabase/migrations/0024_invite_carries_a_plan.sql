-- 0024: an invite can put the new account's own workspace on a plan.
--
-- allowed_emails.org_id already says "join this org with this role" — that is
-- how a platform admin is made. But a team member invited to run the product
-- still landed on `free` in their personal workspace and could make nothing.
-- This adds the other half: the plan their OWN workspace starts on, applied by
-- the same trigger, once, at sign-up.
alter table public.allowed_emails add column if not exists personal_plan text
  references public.plans(id);
comment on column public.allowed_emails.personal_plan is 'plan for the personal workspace created at sign-up; null leaves it free';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; personal uuid;
begin
  select * into a from public.allowed_emails where email = lower(new.email)::citext;
  insert into public.orgs (name, is_partner, plan)
  values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My workspace'),
          coalesce(a.as_partner, false),
          coalesce(a.personal_plan, 'free'))
    returning id into personal;
  insert into public.members (org_id, user_id, role) values (personal, new.id, 'owner');
  if found and a.org_id is not null then
    insert into public.members (org_id, user_id, role) values (a.org_id, new.id, a.role)
      on conflict (org_id, user_id) do update set role = excluded.role;
  end if;
  return new;
end $$;

-- the three admins run the product as customers too
update public.allowed_emails set personal_plan = 'solo'
 where email::text in ('earnfromwhop07@gmail.com', 'aghnetworks3@gmail.com', 'jeevankrishnamohan@gmail.com');

-- and the one who has already signed in gets it now rather than never
update public.orgs o set plan = 'solo'
 where o.plan = 'free' and not o.is_platform and exists (
   select 1 from public.members m join auth.users u on u.id = m.user_id
    where m.org_id = o.id and m.role = 'owner'
      and lower(u.email) in ('aghnetworks3@gmail.com', 'jeevankrishnamohan@gmail.com'));
