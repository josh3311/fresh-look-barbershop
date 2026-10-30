-- Fresh Look: schema (spec 6.3) + Row Level Security (spec 6.5)
-- Money is stored in cents. Times are timestamptz; the salon zone is America/Toronto.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- settings
create table public.settings (
  id smallint primary key default 1 check (id = 1), -- one row only
  shop_name text not null,
  address text not null,
  email text not null,
  phone text not null,
  timezone text not null default 'America/Toronto',
  slot_interval_minutes int not null default 15,
  min_notice_minutes int not null default 60,
  max_days_ahead int not null default 60,
  extra_length_price_cents int not null default 1500,
  opening_hours jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------- staff
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  bio text,
  side text not null check (side in ('men', 'women', 'both')),
  role text not null default 'staff' check (role in ('owner', 'staff')),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------- catalog
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  side text not null check (side in ('men', 'women')),
  name_en text not null,
  name_fr text not null,
  sort_order int not null default 0
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  side text not null check (side in ('men', 'women')),
  slug text not null unique,
  name_en text not null,
  name_fr text not null,
  description text,
  image_url text,
  base_duration_minutes int,
  length_based boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table public.service_variants (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  label text not null,
  price_cents int check (price_cents >= 0),
  is_consult boolean not null default false,
  duration_minutes int,
  sort_order int not null default 0
);

create table public.service_addons (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  name text not null,
  price_cents int check (price_cents >= 0),
  is_from boolean not null default false,
  is_consult boolean not null default false,
  extra_minutes int not null default 0
);

create table public.staff_services (
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (staff_id, service_id)
);

-- ---------------------------------------------------------------- schedule
create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

create table public.time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);

-- ---------------------------------------------------------------- bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id),
  service_id uuid not null references public.services (id),
  variant_id uuid not null references public.service_variants (id),
  addon_ids uuid[] not null default '{}',
  length_label text,
  customer_name text not null check (char_length(customer_name) between 1 and 80),
  customer_phone text not null,
  customer_email text not null,
  notes text check (notes is null or char_length(notes) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  price_estimate_cents int,
  status text not null default 'booked'
    check (status in ('booked', 'completed', 'cancelled', 'no_show')),
  cancel_token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- The no-overlap lock: one person, one client at a time (spec 6.3).
alter table public.bookings add constraint no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'booked');

create index bookings_staff_starts_idx on public.bookings (staff_id, starts_at);
create index bookings_phone_created_idx on public.bookings (customer_phone, created_at);
create index working_hours_staff_idx on public.working_hours (staff_id, weekday);
create index time_off_staff_idx on public.time_off (staff_id, starts_at);
create index services_category_idx on public.services (category_id);
create index variants_service_idx on public.service_variants (service_id);
create index addons_service_idx on public.service_addons (service_id);
create index staff_services_service_idx on public.staff_services (service_id);

-- ---------------------------------------------------------------- RLS helpers
create or replace function public.current_staff_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.staff where auth_user_id = (select auth.uid()) and is_active limit 1
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.staff
    where auth_user_id = (select auth.uid()) and role = 'owner' and is_active
  )
$$;

revoke execute on function public.current_staff_id() from public, anon;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.current_staff_id() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.settings enable row level security;
alter table public.staff enable row level security;
alter table public.categories enable row level security;
alter table public.services enable row level security;
alter table public.service_variants enable row level security;
alter table public.service_addons enable row level security;
alter table public.staff_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.time_off enable row level security;
alter table public.bookings enable row level security;

-- Hallway posters: everyone reads, only the owner writes.
create policy "public read" on public.settings for select to anon, authenticated using (true);
create policy "public read" on public.categories for select to anon, authenticated using (true);
create policy "public read" on public.services for select to anon, authenticated using (true);
create policy "public read" on public.service_variants for select to anon, authenticated using (true);
create policy "public read" on public.service_addons for select to anon, authenticated using (true);
create policy "public read" on public.staff_services for select to anon, authenticated using (true);
create policy "public read active" on public.staff for select to anon, authenticated
  using (is_active or (select public.is_owner()));

create policy "owner insert" on public.settings for insert to authenticated with check ((select public.is_owner()));
create policy "owner update" on public.settings for update to authenticated using ((select public.is_owner()));
create policy "owner insert" on public.staff for insert to authenticated with check ((select public.is_owner()));
create policy "owner update" on public.staff for update to authenticated using ((select public.is_owner()));
create policy "owner delete" on public.staff for delete to authenticated using ((select public.is_owner()));
create policy "owner insert" on public.categories for insert to authenticated with check ((select public.is_owner()));
create policy "owner update" on public.categories for update to authenticated using ((select public.is_owner()));
create policy "owner delete" on public.categories for delete to authenticated using ((select public.is_owner()));
create policy "owner insert" on public.services for insert to authenticated with check ((select public.is_owner()));
create policy "owner update" on public.services for update to authenticated using ((select public.is_owner()));
create policy "owner delete" on public.services for delete to authenticated using ((select public.is_owner()));
create policy "owner insert" on public.service_variants for insert to authenticated with check ((select public.is_owner()));
create policy "owner update" on public.service_variants for update to authenticated using ((select public.is_owner()));
create policy "owner delete" on public.service_variants for delete to authenticated using ((select public.is_owner()));
create policy "owner insert" on public.service_addons for insert to authenticated with check ((select public.is_owner()));
create policy "owner update" on public.service_addons for update to authenticated using ((select public.is_owner()));
create policy "owner delete" on public.service_addons for delete to authenticated using ((select public.is_owner()));
create policy "owner insert" on public.staff_services for insert to authenticated with check ((select public.is_owner()));
create policy "owner delete" on public.staff_services for delete to authenticated using ((select public.is_owner()));

-- Staff room: each person manages their own schedule; the owner manages all.
create policy "own or owner" on public.working_hours for all to authenticated
  using (staff_id = (select public.current_staff_id()) or (select public.is_owner()))
  with check (staff_id = (select public.current_staff_id()) or (select public.is_owner()));
create policy "own or owner" on public.time_off for all to authenticated
  using (staff_id = (select public.current_staff_id()) or (select public.is_owner()))
  with check (staff_id = (select public.current_staff_id()) or (select public.is_owner()));

-- Bookings: never public. Staff read/update their own, the owner all.
-- Customers only create bookings through POST /api/bookings (service role).
create policy "own or owner read" on public.bookings for select to authenticated
  using (staff_id = (select public.current_staff_id()) or (select public.is_owner()));
create policy "own or owner update" on public.bookings for update to authenticated
  using (staff_id = (select public.current_staff_id()) or (select public.is_owner()))
  with check (staff_id = (select public.current_staff_id()) or (select public.is_owner()));

revoke all on public.bookings from anon;
revoke all on public.working_hours from anon;
revoke all on public.time_off from anon;
