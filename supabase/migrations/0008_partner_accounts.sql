-- 0008: partner accounts — the second kind of agency.
--
-- A Studio-plan agency USES the product for its roster (5 seats). A partner
-- only REFERS: it has a referral link, referred accounts, commissions and
-- payouts, and no generation at all. Same orgs row, one flag; the app renders
-- the partner dashboard instead of the product for these workspaces, and the
-- quota gate refuses them outright.
alter table public.orgs add column is_partner boolean not null default false;

-- invites can create a partner workspace directly (admin → Invites → Access: Partner)
alter table public.allowed_emails add column as_partner boolean not null default false;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; personal uuid;
begin
  select * into a from public.allowed_emails where email = lower(new.email)::citext;
  insert into public.orgs (name, is_partner) values (coalesce(nullif(split_part(new.email, '@', 1), ''), 'My workspace'), coalesce(a.as_partner, false))
    returning id into personal;
  insert into public.members (org_id, user_id, role) values (personal, new.id, 'owner');
  if found and a.org_id is not null then
    insert into public.members (org_id, user_id, role) values (a.org_id, new.id, a.role)
      on conflict (org_id, user_id) do update set role = excluded.role;
  end if;
  return new;
end $$;

-- a partner never reserves slides
create or replace function public.fc_partner_guard()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.orgs where id = new.org_id and is_partner) then
    raise exception 'FC_PARTNER' using detail = 'partner workspaces refer, they do not generate';
  end if;
  return new;
end $$;
create trigger sets_partner_guard before insert on public.sets for each row execute function public.fc_partner_guard();

-- payout details the partner sets once (paid by hand until a payout provider exists)
create table public.partner_payouts (
  org_id uuid primary key references public.orgs(id),
  method text not null check (method in ('paypal', 'bank', 'wise')),
  details jsonb not null default '{}'::jsonb,     -- {email} for paypal, {iban, name} / {account, routing, name} for bank, {email} for wise
  updated_at timestamptz not null default now()
);
alter table public.partner_payouts enable row level security;
create policy partner_payouts_own on public.partner_payouts for all to authenticated
  using (org_id in (select public.my_org_ids())) with check (org_id in (select public.my_org_ids()));
create policy partner_payouts_admin on public.partner_payouts for select to authenticated using (public.is_platform_owner());
