# Fresh Look — Project rules (read before changing anything)

Source of truth: `docs/FRESH_LOOK_SPEC.md`, `data/services-seed.json`, Change Requests #1 and #2.
If a rule here and your own idea disagree, the rule wins. If something is unclear, stop and ask.

## Shop facts
- Fresh Look Barbershop, 478 Rideau St, Ottawa, ON K1N 5Z4 (no unit number). Phone (418) 255-2571.
- Open **every day 10:00–20:00**. Nothing may end after 20:00.
- Time zone **America/Toronto**. Store times as `timestamptz`. DST: Sunday Nov 1, 2026 still opens at 10:00 local.

## Booking rules
- Minimum notice **60 minutes**. Maximum **60 days** ahead.
- **No double booking per person**: enforced by the `no_overlap` exclusion constraint (status `booked`), not only the UI.
- One booking at a time (no cart).
- **No payments, deposits or card fields.** Customers pay in the salon. Prices are "estimated".
- The server recalculates the price; it never trusts the page.

## Teams (Change Request #2)
| Team | People | Services | Block | Start times |
|---|---|---|---|---|
| Barbers | Noël, Jackson, Joshua, Duckel | Classic Haircut, Haircut & Beard Trim, Kids, Beard, Outline; Hair Color (**Noël only**) | 35 / 45 / 30 / 15 / 15 min; Hair Color 30 (Color only) / 60 (Color + haircut) | every 5 min |
| Stylists | Reine, Olga | every Braids / Twists / Locs / French Curls / Cornrows service, **both sides** | 60 min (Aubin confirmed) | on the hour |

- "Anyone available" picks only from the service's team.
- A service can be limited to some people of its team with `"only_staff": [<staff keys>]` in `data/services-seed.json` (keys like `barber-a`, never names or emails). Hair Color = Noël (`barber-a`) only: seed, stepper and `staff_services` follow it.
- Roster from Aubin (Nov 1). Each person keeps a fixed seed `key` (barber-a … barber-f), so a rename never changes their database id. Real staff emails live in the database only, never in the repo.
- Duration lives in one function: `getDurationMinutes`.

## Prices
- Money in **cents**. Prices come from `data/services-seed.json`, never retyped.
- Classic Haircut **$30**, Haircut & Beard Trim **$35**. Kids $25, Beard $20, Outline $20. No other price changes.
- Hair Color (Nov 1): Color only **$50**, Color + haircut **$75** (any cut); colour required (White, Orange, Purple, Burgundy red). 8 sizes = kind x colour, no schema change.
- Extensions add-on: **not added** until Aubin gives the price (TODO in `services-seed.json` flags and spec 12).
- Extra length: +$15 per step past mid-back, women's long styles only (not Bob/Short styles, not men's).
- "To discuss" / blank prices still book ("Price to discuss in the salon" / "Ask in salon").

## Sides
- Men page and Women page stay as they are. A men's braid service is on the Men page but booked with stylists.

## Security
- RLS on every table. Customers never read `bookings`; the server uses the service role key only in server code.
- Staff emails are private (never readable with the anon key).
- Never commit secrets. Never log customer details.
- No destructive SQL ("delete all", "drop", "truncate"). Never touch real bookings; test data uses `TEST-` and is deleted by id.
- Database changes = migration in `supabase/migrations/` + paste-ready copy in `supabase/manual/`.

## Quality
- Every page works at 375px with no sideways scroll, light and dark mode. Text contrast ≥ 4.5:1.
- All UI text in `lib/i18n.ts` (en + fr).
- Do not edit a failing test to make it pass. A test changes only when a requirement changed (say which).
