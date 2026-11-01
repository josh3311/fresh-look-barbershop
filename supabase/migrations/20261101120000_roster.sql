-- Roster (Nov 1): real first names for the staff, two more barbers.
--   Barbers  (side men,   team barber):  Noël, Jackson, Joshua, Duckel
--   Stylists (side women, team stylist): Reine, Olga
--
-- Existing people keep their database id (stableId of their seed key), so their bookings,
-- hours and services stay attached: Barber A -> Noël, Barber B -> Jackson,
-- Barber C -> Reine, Barber D -> Olga. Joshua (key barber-e) and Duckel (key barber-f) are new.
--
-- Safe to run twice: updates only touch rows that still differ, inserts skip what exists.
-- Never touches bookings. No delete, no drop, no truncate.
-- Emails here are .invalid placeholders. Real emails are set in the Supabase SQL editor only,
-- never in this repo (it is public).

-- ---------------------------------------------------------------- names, sides, teams, order
update public.staff s
set name = x.name, side = x.side, team = x.team, sort_order = x.sort_order
from (values
  ('2f834e1c-72d7-5604-bd77-b724c9d21a3a'::uuid, 'Noël',    'men',   'barber',  0),
  ('a55a3a35-2276-51c8-9712-b566ab96d744'::uuid, 'Jackson', 'men',   'barber',  1),
  ('c458bd2f-b0fa-5e66-91b2-ab5275a2541a'::uuid, 'Reine',   'women', 'stylist', 4),
  ('36b78c9f-4271-5678-8ed8-6b4a8a989fd4'::uuid, 'Olga',    'women', 'stylist', 5)
) as x (id, name, side, team, sort_order)
where s.id = x.id
  and (s.name, s.side, s.team, s.sort_order) is distinct from (x.name, x.side, x.team, x.sort_order);

-- ---------------------------------------------------------------- two new barbers
-- Only on a database that already has the original staff (a fresh database gets everyone
-- from the seed instead).
insert into public.staff (id, name, side, team, role, is_active, sort_order, email)
select x.id, x.name, 'men', 'barber', 'staff', true, x.sort_order, x.email
from (values
  ('468fc139-7e8e-531a-9519-df966c566626'::uuid, 'Joshua', 2, 'barber.e@example.invalid'),
  ('9c8647a2-4c53-5cf6-bfb7-ee84ea6ea1f8'::uuid, 'Duckel', 3, 'barber.f@example.invalid')
) as x (id, name, sort_order, email)
where exists (select 1 from public.staff where id = '2f834e1c-72d7-5604-bd77-b724c9d21a3a')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- hours: 10:00-20:00, every day
-- Adds only the missing (person, weekday) rows; existing hours are left as they are.
insert into public.working_hours (staff_id, weekday, start_time, end_time)
select s.id, d.weekday, time '10:00', time '20:00'
from public.staff s
cross join generate_series(0, 6) as d (weekday)
where not exists (
  select 1 from public.working_hours w where w.staff_id = s.id and w.weekday = d.weekday
);

-- ---------------------------------------------------------------- services of their own team
insert into public.staff_services (staff_id, service_id)
select st.id, sv.id
from public.staff st
join public.services sv on sv.team = st.team
on conflict (staff_id, service_id) do nothing;
