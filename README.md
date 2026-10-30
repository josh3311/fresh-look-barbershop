# Fresh Look — barbershop & braids booking site

Next.js 15 (App Router) + Tailwind v4 + Supabase + Vercel. Spec: [`docs/FRESH_LOOK_SPEC.md`](docs/FRESH_LOOK_SPEC.md).
Prices and services come from [`data/services-seed.json`](data/services-seed.json) (never retyped by hand).

## Run locally

```bash
cp .env.example .env.local   # fill in the Supabase keys
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests (price, availability, validation, emails, /staff access)
LIVE_SUPABASE_TESTS=1 npm test   # + live RLS checks against Supabase (TEST- data, deleted by id)
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
| Booking validation (Zod) | `lib/booking-schema.ts`, `lib/phone.ts` |
| Create booking + emails | `lib/server/create-booking.ts`, `lib/server/email.ts` |
| Staff login + dashboard | `app/staff/*`, `app/auth/callback`, `lib/server/staff-auth.ts`, `middleware.ts` |

## Deploy (Vercel)

1. vercel.com → Add New → Project → import `josh3311/fresh-look-barbershop`.
2. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `RESEND_API_KEY`, `SALON_NOTIFY_EMAIL`, `STAFF_EMAILS` (+ optional `RESEND_FROM`). See `.env.example`.
3. Settings → Git → Production Branch = the branch with this code (until it is merged to `main`).
4. Deploy. The build seeds the database.

## Staff login (Supabase Auth)

- Supabase → Authentication → URL Configuration: **Site URL** = the live site, and add
  `https://<live-domain>/auth/callback` to **Redirect URLs**.
- Recommended: Authentication → Emails → **Magic Link** template link =
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`
  (works even when the email app opens the link in a different browser).
- Supabase's built-in mailer only delivers to members of the Supabase organization. For other staff
  emails, set Authentication → Emails → SMTP to Resend (`smtp.resend.com`, port 465, user `resend`,
  password = Resend API key, sender on a verified domain).
