# Fresh Look — barbershop & braids booking site

Next.js 15 (App Router) + Tailwind v4 + Supabase + Vercel. Spec: [`docs/FRESH_LOOK_SPEC.md`](docs/FRESH_LOOK_SPEC.md).
Prices and services come from [`data/services-seed.json`](data/services-seed.json) (never retyped by hand).

## Run locally

```bash
cp .env.example .env.local   # fill in the Supabase keys
npm install
npm run dev                  # http://localhost:3000
npm test                     # price + availability tests (spec section 10)
```

## Database

- Schema + RLS: `supabase/migrations/20261030000000_init.sql` (tables, no-overlap exclusion constraint, policies).
- Seed: `npm run seed` (upsert, overwrites seeded rows) or `npm run seed:sql` (writes `supabase/seed.sql`).
- `npm run build` runs `scripts/seed.ts --build` first: it only **adds missing rows**, skips if keys are missing,
  and never fails the deploy. So a fresh Supabase project is filled on the first Vercel deploy.

## Where things live

| What | File |
|---|---|
| Catalog (from the seed JSON, stable ids) | `lib/catalog.ts` |
| Price estimate | `lib/pricing.ts` |
| Duration rule (2–3h by size) | `lib/duration.ts` → `getDurationMinutes` |
| Free start times | `lib/availability.ts` |
| All UI text (en + fr) | `lib/i18n.ts` |
| API | `app/api/availability`, `app/api/bookings` |
| Booking stepper | `components/booking/BookingStepper.tsx` |

## Deploy (Vercel)

1. vercel.com → Add New → Project → import `josh3311/fresh-look-barbershop`.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Settings → Git → Production Branch = the branch with this code (until it is merged to `main`).
4. Deploy. The build seeds the database.
