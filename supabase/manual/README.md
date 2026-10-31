# Manual SQL (paste-ready)

Each file here is a copy of a migration in `supabase/migrations/`, for running by hand.

How to run:
1. Open the Supabase dashboard -> **SQL Editor** -> **New query**.
2. Paste the **whole** file and click **Run**.
3. Scroll through the results of the read-only checks at the end and compare each one with
   the `expected:` comment above it.

Every file is **safe to run twice**: the second run changes nothing. They never touch
`bookings` and never delete everything, drop or truncate a table.

| File | What it does |
|---|---|
| `cr2_teams_prices_durations.sql` | Change Request #2 (Oct 31): barber/stylist teams, Classic $30 and Haircut & Beard $35, 35/45/30/15/15 min barber blocks and 60 min stylist blocks, who does what (`staff_services`), private `staff.email` (placeholders), 5 / 60 min start-time settings. |

Staff emails: the files only put placeholders (`barber.a@example.invalid` ...). Set the real
emails here in the SQL Editor, never in the repo (it is public), for example:

```sql
update public.staff set email = 'real.person@example.com' where name = 'Barber A';
```
