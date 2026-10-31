-- PASTE-READY COPY of supabase/migrations/20261031120000_cr2_teams_prices_durations.sql
-- Run it in the Supabase dashboard: SQL Editor -> New query -> paste this whole file -> Run.
-- Safe to run twice (the second run changes nothing). It never touches bookings.
-- Part 1 changes the database inside one transaction (all or nothing).
-- Part 2 only reads: compare each result with the "expected" comment above it.
-- Do not edit part 1 here: change the migration file and copy it again (a test checks they match).

-- =============================================================== PART 1: the change
begin;

-- Change request #2 (Oct 31): barber / stylist teams, new haircut prices, booking blocks,
-- private staff emails, slot settings.
--
-- Safe to run twice: columns use "if not exists", every update only touches rows that
-- still differ, inserts use "on conflict do nothing". A second run changes 0 rows.
-- Never touches bookings. No "delete all", no drop table, no truncate.
-- A paste-ready copy (with read-only checks) is in supabase/manual/cr2_teams_prices_durations.sql.

-- ---------------------------------------------------------------- services.team
-- Barbers (Barber A, B) do the 5 haircut services. Stylists (Barber C, D) do every other
-- service: all braids / twists / locs / French curls / cornrows, on the Men side too.
alter table public.services add column if not exists team text;

update public.services
set team = case
  when slug in ('classic-haircut', 'haircut-beard-trim', 'kids', 'beard', 'outline') then 'barber'
  else 'stylist'
end
where team is distinct from (case
  when slug in ('classic-haircut', 'haircut-beard-trim', 'kids', 'beard', 'outline') then 'barber'
  else 'stylist'
end);

alter table public.services alter column team set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_team_check' and conrelid = 'public.services'::regclass
  ) then
    alter table public.services add constraint services_team_check check (team in ('barber', 'stylist'));
  end if;
end
$$;

-- ---------------------------------------------------------------- staff.team
-- Live data: Barber A, B are side 'men' (barbers); Barber C, D are side 'women' (stylists).
-- 'side' stays: it only says which page shows the person. A 'both' person is left empty on
-- purpose, so "set not null" below stops the migration instead of guessing their team.
alter table public.staff add column if not exists team text;

update public.staff
set team = case side when 'men' then 'barber' when 'women' then 'stylist' end
where team is null and side in ('men', 'women');

alter table public.staff alter column team set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'staff_team_check' and conrelid = 'public.staff'::regclass
  ) then
    alter table public.staff add constraint staff_team_check check (team in ('barber', 'stylist'));
  end if;
end
$$;

-- ---------------------------------------------------------------- staff.email (private)
-- Where the "new booking" email for this barber / stylist goes.
-- Placeholders only (.invalid never receives mail), and only where the email is empty.
-- TODO Aubin: real names and emails are coming. Set the REAL emails directly in the
-- Supabase SQL editor (update public.staff set email = '...' where id = '...';).
-- NEVER put a real email in this repo: it is public.
alter table public.staff add column if not exists email text;

update public.staff
set email = case name
  when 'Barber A' then 'barber.a@example.invalid'
  when 'Barber B' then 'barber.b@example.invalid'
  when 'Barber C' then 'barber.c@example.invalid'
  when 'Barber D' then 'barber.d@example.invalid'
end
where email is null and name in ('Barber A', 'Barber B', 'Barber C', 'Barber D');

-- Staff emails must never be readable with the anon key. RLS filters rows, not columns, so
-- swap the table-wide SELECT for a column list without email (and without auth_user_id).
-- Server code uses the service role, which keeps full access.
-- If you add a public column to staff later, add it to this grant too.
revoke select on public.staff from anon, authenticated;
grant select (id, name, photo_url, bio, side, role, is_active, sort_order, team)
  on public.staff to anon, authenticated;

-- The "public read active" policy calls public.is_owner(), which anon may not execute, so
-- every anon read of staff failed with "permission denied for function is_owner".
-- Keep that policy for signed-in users and give anon its own policy without the function.
alter policy "public read active" on public.staff to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'staff' and policyname = 'anon read active'
  ) then
    create policy "anon read active" on public.staff for select to anon using (is_active);
  end if;
end
$$;

-- ---------------------------------------------------------------- settings: start-time steps
-- Barbers start every 5 min, stylists on the hour. slot_interval_minutes stays for now.
alter table public.settings
  add column if not exists barber_slot_minutes int not null default 5 check (barber_slot_minutes > 0);
alter table public.settings
  add column if not exists stylist_slot_minutes int not null default 60 check (stylist_slot_minutes > 0);

-- ---------------------------------------------------------------- prices (cents)
-- Only these two change: Classic Haircut $25 -> $30, Haircut & Beard Trim $30 -> $35.
update public.service_variants v
set price_cents = 3000
from public.services s
where v.service_id = s.id
  and s.slug = 'classic-haircut'
  and v.label = 'Standard'
  and v.price_cents is distinct from 3000;

update public.service_variants v
set price_cents = 3500
from public.services s
where v.service_id = s.id
  and s.slug = 'haircut-beard-trim'
  and v.label = 'Standard'
  and v.price_cents is distinct from 3500;

-- ---------------------------------------------------------------- booking blocks (minutes)
-- Barbers: Classic 35, Haircut & Beard Trim 45, Kids 30, Beard 15, Outline 15.
update public.services s
set base_duration_minutes = x.minutes
from (values
  ('classic-haircut', 35),
  ('haircut-beard-trim', 45),
  ('kids', 30),
  ('beard', 15),
  ('outline', 15)
) as x (slug, minutes)
where s.slug = x.slug
  and s.base_duration_minutes is distinct from x.minutes;

-- Stylists: every service blocks 60 min (Aubin, Oct 31). Replaces the 180/150/120 size rule.
update public.services
set base_duration_minutes = 60
where team = 'stylist'
  and base_duration_minutes is distinct from 60;

-- ---------------------------------------------------------------- who does what
-- Remove only the cross-team pairs (e.g. a barber mapped to Simple Cornrows)...
delete from public.staff_services ss
using public.staff st, public.services sv
where ss.staff_id = st.id
  and ss.service_id = sv.id
  and st.team <> sv.team;

-- ...then make sure everyone does every service of their own team.
insert into public.staff_services (staff_id, service_id)
select st.id, sv.id
from public.staff st
join public.services sv on sv.team = st.team
on conflict (staff_id, service_id) do nothing;

commit;

-- =============================================================== PART 2: read-only checks

-- 1. Haircut prices (cents).
-- expected: classic-haircut 3000 | haircut-beard-trim 3500 | kids 2500 | beard 2000 | outline 2000
select s.slug, v.label, v.price_cents
from public.services s
join public.service_variants v on v.service_id = s.id
where s.slug in ('classic-haircut', 'haircut-beard-trim', 'kids', 'beard', 'outline')
order by s.sort_order;

-- 2. Services per team.
-- expected: barber 5 | stylist 37
select team, count(*) as services from public.services group by team order by team;

-- 3. Booking blocks (minutes) per team.
-- expected: barber 15 -> 2 (beard, outline) | barber 30 -> 1 (kids) | barber 35 -> 1 (classic)
--           barber 45 -> 1 (haircut & beard) | stylist 60 -> 37
select team, base_duration_minutes, count(*) as services, string_agg(slug, ', ' order by slug) as slugs
from public.services
group by team, base_duration_minutes
order by team, base_duration_minutes;

-- 4. No size has its own duration that would override the 60 min stylist block.
-- expected: 0
select count(*) as variants_with_own_duration
from public.service_variants v
join public.services s on s.id = v.service_id
where s.team = 'stylist' and v.duration_minutes is not null;

-- 5. Staff (emails are placeholders until you set the real ones here, never in the repo).
-- expected: Barber A men barber barber.a@example.invalid | Barber B men barber barber.b@example.invalid
--           Barber C women stylist barber.c@example.invalid | Barber D women stylist barber.d@example.invalid
select name, side, team, email, is_active from public.staff order by sort_order;

-- 6. Who does what.
-- expected: Barber A 5 | Barber B 5 | Barber C 37 | Barber D 37 (total 84)
select st.name, st.team, count(*) as services
from public.staff_services ss
join public.staff st on st.id = ss.staff_id
group by st.name, st.team, st.sort_order
order by st.sort_order;

-- 7. Cross-team pairs (a barber on a braid style, a stylist on a haircut).
-- expected: 0
select count(*) as cross_team_pairs
from public.staff_services ss
join public.staff st on st.id = ss.staff_id
join public.services sv on sv.id = ss.service_id
where st.team <> sv.team;

-- 8. Simple Cornrows (Men page) is done by the stylists only; Classic Haircut by the barbers only.
-- expected: simple-cornrows -> Barber C, Barber D | classic-haircut -> Barber A, Barber B
select sv.slug, string_agg(st.name, ', ' order by st.sort_order) as staff
from public.staff_services ss
join public.staff st on st.id = ss.staff_id
join public.services sv on sv.id = ss.service_id
where sv.slug in ('simple-cornrows', 'classic-haircut')
group by sv.slug
order by sv.slug;

-- 9. Start-time steps.
-- expected: barber_slot_minutes 5 | stylist_slot_minutes 60 | slot_interval_minutes 15 (old column, kept)
select barber_slot_minutes, stylist_slot_minutes, slot_interval_minutes from public.settings;

-- 10. Staff emails are hidden from the public (anon) key.
-- expected: anon_can_read_email false | anon_can_read_name true | anon_can_read_team true
--           signed_in_can_read_email false
select
  has_column_privilege('anon', 'public.staff', 'email', 'select') as anon_can_read_email,
  has_column_privilege('anon', 'public.staff', 'name', 'select') as anon_can_read_name,
  has_column_privilege('anon', 'public.staff', 'team', 'select') as anon_can_read_team,
  has_column_privilege('authenticated', 'public.staff', 'email', 'select') as signed_in_can_read_email;

-- 11. Staff read policies.
-- expected: "anon read active" {anon} | "public read active" {authenticated}
select policyname, roles, qual from pg_policies
where schemaname = 'public' and tablename = 'staff' and cmd = 'SELECT'
order by policyname;
