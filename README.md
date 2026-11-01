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
| Duration rule (from data: barber services per service, stylists 60 min) | `lib/duration.ts` → `getDurationMinutes` |
| Free start times | `lib/availability.ts` |
| All UI text (en + fr) | `lib/i18n.ts` |
| API | `app/api/availability`, `app/api/bookings` |
| Booking stepper | `components/booking/BookingStepper.tsx` |
| Booking validation (Zod) | `lib/booking-schema.ts`, `lib/phone.ts` |
| Create booking + emails | `lib/server/create-booking.ts`, `lib/server/email.ts` |
| Staff login + dashboard | `app/staff/*`, `app/auth/callback`, `lib/server/staff-auth.ts`, `middleware.ts` |

## Deploy (Vercel)

1. vercel.com → Add New → Project → import `josh3311/fresh-look-barbershop`.
2. Environment variables: see the table below and `.env.example`.
3. Settings → Git → Production Branch = the branch with this code (until it is merged to `main`).
4. Deploy. The build seeds the database.

## Environment variables

Vercel → Project → Settings → Environment Variables. "Sensitive" = tick **Sensitive** (value hidden after saving).

| Name | Type | Environments | Value / where to get it |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Plain (public, in the browser bundle) | Production, Preview | Supabase → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Plain (public by design, RLS protects data) | Production, Preview | Supabase → Project Settings → API Keys → `anon` / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sensitive** | Production, Preview | Supabase → Project Settings → API Keys → `service_role` / secret key |
| `RESEND_API_KEY` | **Sensitive** | Production (Preview only if previews should send real emails) | resend.com → API Keys → Create (Sending access) |
| `SALON_NOTIFY_EMAIL` | Plain | Production, Preview | `freshlook.Ottawa@gmail.com` (the default when unset) |
| `STAFF_EMAILS` | **Sensitive** (private addresses) | Production, Preview | Comma-separated staff logins, e.g. Aubin's email |
| `RESEND_FROM` | Plain, optional | Production, Preview | `Fresh Look <bookings@your-verified-domain>` once the domain is verified in Resend; leave unset until then |

Redeploy after changing a variable (the `NEXT_PUBLIC_` ones are built into the page).

## Emails (Resend)

After a booking is saved, three emails go out (`lib/server/email.ts`): a copy to `SALON_NOTIFY_EMAIL`, a confirmation
to the customer (service, person, date, time, price estimate, address, "Pay in salon"), and one to the chosen
barber/stylist (or whoever "Anyone available" assigned). The staff address is read on the server from
`staff.email` (private column). A failed email never fails the booking; logs show only the booking id and a reason code.

- **The sender domain must be verified** to reach customers and staff. Without `RESEND_FROM`, mail is sent from
  `onboarding@resend.dev`, which Resend only delivers to the Resend account owner's own address.
  Resend → Domains → Add domain → add the DNS records → then set `RESEND_FROM`.
- Staff emails are placeholders (`barber.a@example.invalid` ...) until Aubin sends the real ones. Any `.invalid`
  address is skipped without calling Resend. Set real ones **in the database only** (never in this repo):
  Supabase SQL Editor → `update public.staff set email = 'name@domain' where name = 'Barber A';`

## Staff login (Supabase Auth)

- Supabase → Authentication → URL Configuration: **Site URL** = the live site, and add
  `https://<live-domain>/auth/callback` to **Redirect URLs**.
- Recommended: Authentication → Emails → **Magic Link** template link =
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`
  (works even when the email app opens the link in a different browser).
- Supabase's built-in mailer only delivers to members of the Supabase organization. For other staff
  emails, set Authentication → Emails → SMTP to Resend (`smtp.resend.com`, port 465, user `resend`,
  password = Resend API key, sender on a verified domain).
