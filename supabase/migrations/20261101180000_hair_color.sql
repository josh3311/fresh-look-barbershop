-- Hair Color (Aubin, Nov 1): a new men's barber service, done by Noël only.
--   Color only       $50 (5000 cents), blocks 30 min
--   Color + haircut  $75 (7500 cents), blocks 60 min (any cut; the customer names it in the notes)
--   Colour required: White, Orange, Purple, Burgundy red
-- No schema change: each kind x colour is one size (8 service_variants, e.g. "Color only · White"),
-- each with its own price_cents and duration_minutes. services.base_duration_minutes = 30 (the
-- shortest kind); every variant carries its own minutes, which win (getDurationMinutes).
--
-- Ids are the deterministic ids of the catalog (lib/catalog.ts stableId), so the seed and this file
-- describe the same rows. Noël = 2f834e1c-72d7-5604-bd77-b724c9d21a3a (seed key barber-a).
--
-- Safe to run twice: inserts skip what exists, updates only touch rows that still differ, the
-- delete only finds rows that should not be there. A second run changes 0 rows.
-- Never touches bookings. The only delete is the targeted Hair Color clean-up below.
-- No drop, no truncate.
-- A paste-ready copy (with read-only checks) is in supabase/manual/hair_color.sql.

-- ---------------------------------------------------------------- category (third men's tab)
insert into public.categories (id, side, name_en, name_fr, sort_order)
values ('a7ff07b6-b18d-50fb-915c-701d9d9c822d', 'men', 'Hair Color', 'Coloration', 3)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- service
insert into public.services (id, category_id, side, team, slug, name_en, name_fr, image_url,
  base_duration_minutes, length_based, is_active, sort_order)
values ('07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'a7ff07b6-b18d-50fb-915c-701d9d9c822d', 'men', 'barber',
  'hair-color', 'Hair Color', 'Coloration', null, 30, false, true, 0)
on conflict (id) do nothing;

-- Repair only: a later re-run of the CR2 file (20261031120000) would make Hair Color a stylist
-- service with a 60 min base block (its barber list is the 5 haircut slugs). Put it back.
update public.services
set team = 'barber', base_duration_minutes = 30
where id = '07e5f5ba-f8fb-5efb-a96c-90347134a49f'
  and (team, base_duration_minutes) is distinct from ('barber', 30);

-- ---------------------------------------------------------------- 8 sizes: kind x colour
insert into public.service_variants (id, service_id, label, price_cents, is_consult, duration_minutes, sort_order)
values
  ('9588db47-27fa-502f-85ec-2fb7c1ac12de', '07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'Color only · White',             5000, false, 30, 0),
  ('785819ca-665a-59fa-a276-e9a202100554', '07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'Color only · Orange',            5000, false, 30, 1),
  ('707906a7-b015-5f67-bb7a-16564825a046', '07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'Color only · Purple',            5000, false, 30, 2),
  ('b9ffd5fd-ab73-5ef7-9896-f62777da2678', '07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'Color only · Burgundy red',      5000, false, 30, 3),
  ('f2c857ec-46fe-55f9-8381-f3afa80996f2', '07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'Color + haircut · White',        7500, false, 60, 4),
  ('06fa9aa7-ed84-5c1f-805f-aae2aa1b63af', '07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'Color + haircut · Orange',       7500, false, 60, 5),
  ('8a96be22-3287-5556-93c1-62a48ed4fedd', '07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'Color + haircut · Purple',       7500, false, 60, 6),
  ('f56947db-cfe4-5821-9e29-6e26fcdc82e1', '07e5f5ba-f8fb-5efb-a96c-90347134a49f', 'Color + haircut · Burgundy red', 7500, false, 60, 7)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- who does it: Noël only
-- Targeted clean-up: remove Hair Color pairs for anyone who is not Noël (a later re-run of the
-- CR2 or roster file maps every person of the service's team to it). Nothing else is deleted.
delete from public.staff_services
where service_id = '07e5f5ba-f8fb-5efb-a96c-90347134a49f'
  and staff_id <> '2f834e1c-72d7-5604-bd77-b724c9d21a3a';

-- Noël does it (only if Noël exists: a fresh database gets this pair from the seed).
insert into public.staff_services (staff_id, service_id)
select st.id, '07e5f5ba-f8fb-5efb-a96c-90347134a49f'::uuid
from public.staff st
where st.id = '2f834e1c-72d7-5604-bd77-b724c9d21a3a'
on conflict (staff_id, service_id) do nothing;
