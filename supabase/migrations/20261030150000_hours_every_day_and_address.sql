-- Change request #1 (Oct 30): open every day 10:00-20:00, and drop the unit number from the address.

-- Every staff member works Mon-Sun 10:00-20:00: exactly 7 rows each (weekday 0 = Sunday).
delete from public.working_hours where staff_id in (select id from public.staff);
insert into public.working_hours (staff_id, weekday, start_time, end_time)
select s.id, d.weekday, time '10:00', time '20:00'
from public.staff s
cross join generate_series(0, 6) as d (weekday);

update public.settings
set
  address = '478 Rideau St, Ottawa, ON K1N 5Z4',
  opening_hours = '{"sun":["10:00","20:00"],"mon":["10:00","20:00"],"tue":["10:00","20:00"],"wed":["10:00","20:00"],"thu":["10:00","20:00"],"fri":["10:00","20:00"],"sat":["10:00","20:00"]}'::jsonb
where id = 1;
