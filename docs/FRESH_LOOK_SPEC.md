# Fresh Look — Website Spec (v1)

> **Who reads this:** Claude Code (the builder) and Josh (the owner of the build).
> **Written like we are explaining to a 10-year-old:** short steps, real examples, and the technical name next to every idea.
> **Golden rule:** if something says `TODO`, do NOT guess. Use the placeholder and keep going.

---

## 0. The recommendation in one paragraph

Build one website for **Fresh Look** (barbershop + braiding salon, 478 Rue Rideau, Ottawa) with **two doors**: a **Men** side and a **Women** side. Customers pick a service, pick a person, pick a day and time, type their name and phone, and they are booked. **No payment, no deposit** (Aubin asked for $0 before the appointment). The barbers and stylists log in to a simple dashboard to see who booked and when. Stack: **Next.js + Supabase + Vercel**, because it is free to start, fast to build, and easy to hand over.

---

## 1. Background (one paragraph)

Aubin showed a Square booking page as a sample (it splits services into sections, each with a price, a time and a "Select" button) and asked us to copy its idea but with his name, his logo, and **no deposit**. He also wants the site to feel like **No Stress Cuts** (Gatineau): a clean barbershop site with **Services, Team, Portfolio (photos of cuts), About**, and service names in **English / French** like "Haircut & Beard Trim / Coupe Régulière & Barbe". Note: nostresscuts.ca blocks automated readers, so this structure comes from their public booking profile. Josh should send screenshots of their homepage if he wants a closer match.

---

## 2. Facts we already know (use exactly these)

| Thing | Value |
|---|---|
| Shop name | Fresh Look Barbershop |
| Tagline | "Votre style, notre priorité !" |
| Address | 478 Rideau St, Ottawa, ON K1N 5Z4 (no unit number: Uber could not find it) |
| Opening hours | Every day (Mon–Sun) 10:00–20:00 (confirmed Oct 30) |
| Phone | (418) 255-2571 (tap-to-call link: `tel:+14182552571`) |
| Salon email | freshlook.Ottawa@gmail.com |
| Deposit | $0. Pay in the salon. |
| Currency | CAD |
| Time zone | America/Toronto |
| Staff (Nov 1) | 6 people: **Noël, Jackson, Joshua, Duckel** (Men page, **barbers**) and **Reine, Olga** (Women page, **hairstylists**). Real emails are in the database only. |
| Teams (Oct 31) | **Barbers** do the 5 haircut services. **Stylists** do every braid / twist / loc / French curl / cornrow service, on **both** sides (see 6.4a). |
| Men's services | 5 cuts (Classic Haircut **$30**, Haircut & Beard Trim **$35**, Kids $25, Beard $20, Outline $20) + 4 braid/twist/loc styles (see `services-seed.json`) |
| Women's services | 33 styles from the Beaudy_By_Olga menus (see `services-seed.json`) |
| Removed | Locs Installation (crossed out on the flyer — never add it) |

**Facts we do NOT know yet** (use placeholders, marked `TODO`):

| Thing | Placeholder to use |
|---|---|
| Staff emails (for the "new booking" email) | Placeholders `barber.a@example.invalid` … in the database only. Real emails are set in the Supabase SQL editor, **never in the repo** (it is public). |
| Photos for most styles | neutral placeholder box (more photos come later) |
| Instagram / TikTok | hide the icons until we have links |

> This first version is a **concept demo**: it shows Aubin how the site works. Real names, hours and photos get swapped in later from the owner dashboard.

---

## 3. The look (design)

Think of the photo of the shop: **black chairs, white walls, light wood floor, gold handles and lamps.** The website should feel like walking into that room.

### 3.1 Colors (design tokens)

| Name | Hex | Used for |
|---|---|---|
| `ink` | `#111111` | Main text, header, buttons |
| `paper` | `#F7F5F0` | Page background (warm white, like the walls) |
| `gold` | `#B8935A` | Accents, lines, hover, prices |
| `oak` | `#D8C3A5` | Soft backgrounds for cards |
| `rose` | `#C99A9A` | Small accents on the **Women** side only |
| `line` | `#E4DFD6` | Borders |

Rules:
- MUST have a dark mode that swaps `paper` ↔ `ink`.
- Text on buttons must be readable (contrast at least 4.5:1).

### 3.2 Fonts
- Headings: **Playfair Display** (a serif, like the "FRESH LOOK" letters on the logo).
- Everything else: **Inter**.

### 3.3 Feel
- Lots of space. Big photos. Thin gold lines between sections (like the line under the scissors in the logo).
- Mobile first: most customers will book from their phone. Every page must work at 375px wide.

---

## 4. Pages (the front end)

Think of the website like a house. The **Home** page is the front hall. From there you walk into the **Men** room or the **Women** room. The **Book** page is the front desk.

| Page | URL | What it is |
|---|---|---|
| Home | `/` | Front hall |
| Men | `/men` | Men's room: services, photos, barbers |
| Women | `/women` | Women's room: styles, size guide, stylists |
| Book | `/book` | The front desk where you book |
| Booking done | `/book/confirmed/[id]` | "You're booked!" page |
| Cancel | `/booking/[token]/cancel` | Customer cancels from the email link |
| Staff login | `/staff/login` | Door with a lock |
| Dashboard | `/staff` | Staff room: today's bookings |

### 4.1 Home page — sections in this exact order

1. **Header** (sticks to top): logo left. Links: Men · Women · Team · Contact. A gold button **"Book / Réserver"** on the right. On phones, links go into a menu button.
2. **Hero**: the salon interior photo, full width, dark overlay. Big text: "Fresh Look". Small text: "Barbershop & Braids · Ottawa". Two big buttons side by side: **"Men / Hommes"** and **"Women / Femmes"**. Each goes to `/book?side=men` or `/book?side=women`.
3. **Two doors**: two big cards. Left card = Men (haircut photo), right card = Women (braids photo). Each card: 3 example services with "from $X", and a "See all" link.
4. **Portfolio**: a grid of photos (the 3 men's haircut photos + women's style photos). Tap a photo → it opens big.
5. **Team**: round photos, name, and "Men" or "Women" tag. Button under each: "Book with [name]".
6. **About**: 2–3 short sentences. Use: "Fresh Look is a barbershop and braiding salon on Rideau Street. Clean cuts, beautiful braids, and a relaxed place to wait. Book online or walk in." (Josh/Aubin can change it.)
7. **Visit us**: address (478 Rideau St), "Get directions" link, hours (Mon–Sun, 10:00–20:00), phone (418) 255-2571 as a tap-to-call link, email, and an embedded Google Map.
8. **Footer**: logo, address, email, "© Fresh Look", small link "Staff login".

✅ **You know it worked when:** on a phone, you can go from the Home page to the booking form in **one tap**.

### 4.2 Men page `/men`
1. Title: "Men / Hommes".
2. Two tabs: **Cuts / Coupes** and **Braids, Twists & Locs / Tresses, Twists & Locs**.
3. **Cuts** tab: service cards like the Square sample: name (English / French), time (e.g. "about 35 min"), price ("$30"), and a **Book** button. Classic Haircut ($30) goes first, with a gold "From $30" badge like the shop flyer.
4. **Braids, Twists & Locs** tab: Simple Cornrows, Stitch Cornrows, Barrel Twists, Locs Re-twist. Same card style as the women's styles (photo, "from $X", tap to see the price table and add-ons).
5. Portfolio strip: men's haircut photos.
6. Barbers: only staff whose side is `men` or `both`. (The page shows people by **side**; booking a braid / twist / loc service from this page still offers only the **stylists**, see 6.4a.)

### 4.3 Women page `/women`
1. Title: "Women / Femmes".
2. Category tabs: **Braids · Twists · French Curls · Locs**.
3. Each style is a card: photo, name, "from $X" (the smallest price), and a **Book** button.
4. Tap a card → it opens and shows the full price table (each size and its price) and the add-ons (e.g. "Beads at the ends +$20").
5. **Size guide** section: sizes XMicro → XLarge, with the notes:
   - XMicro is not available for Cornrows or Fulani.
   - Large / XLarge Cornrows and Fulani = 2 to 4 strands.
6. **Length guide**: "Normal length = armpit to mid-back. Each extra length is +$15."
7. Stylists: only staff whose side is `women` or `both`.

---

## 5. How booking works (the most important part)

### 5.1 The idea, like a 10-year-old

Booking is like signing up for a slot on the school's swing.
- The swing (a **staff member**) can only hold one kid at a time.
- Recess (the **working hours**) is from 10:00 to 20:00, every day.
- Each turn takes a certain time (the **service duration**).
- If Sam has the swing from 2:00 to 2:40, nobody else can take it from 2:00 to 2:40.

### 5.2 The steps the customer sees (a "stepper" with a progress bar)

**Step 1 — Men or Women.** Two big buttons. (Skip this step if the URL already says `?side=men` or `?side=women`.)

**Step 2 — Pick the service.**
- Men: a list of cards (name, time, price, Select).
- Women: pick the style, then pick the **size**, then pick the **length**, then tick any **add-ons**.
- A small box at the bottom always shows: **"Estimated price: $X"**.

**Step 3 — Pick the person.** Cards with photo and name. The first card is **"Anyone available"**. Only show people who do this service (the service's **team**: barbers for haircuts, stylists for every braid / twist / loc style, even from the Men side). "Anyone available" picks only from that team.

**Step 4 — Pick the day and time.**
- A row of the next 14 days (scroll to see up to 60 days).
- Under it: the free times as buttons (barbers every 5 minutes: 10:00, 10:05, 10:10…; stylists on the hour: 10:00, 11:00…).
- Days with no free time are greyed out.
- If the customer chose "Anyone available", show a time if **at least one** person is free.

**Step 5 — Your details.** Name (required), phone (required), email (required for confirmation), notes (optional, e.g. "I bring my own hair").

**Step 6 — Review and confirm.** Show everything: service, size, length, add-ons, person, date, time, estimated price. Big button **"Confirm booking"**. Under it, small text: "No deposit. You pay at the salon."

**Step 7 — Done page.** "You're booked! See you on Friday Nov 6 at 2:00 PM with Reine." Buttons: "Add to calendar" (downloads an `.ics` file) and "Back to home".

✅ **You know it worked when:** a customer can book a men's haircut in under 60 seconds on a phone.

### 5.3 Price rules (women's side)

Example: Knotless Braids, size Small ($185), length Hip, beads at the ends.

1. Start with the size price: **$185**.
2. Add the length: normal (armpit to mid-back) is free. Each step longer adds **$15**. Waist = +15, Hip = +30, Tailbone = +45, Classic butt = +60, Mid-thigh = +75, Knee = +90, Calf = +105. Hip → **+$30**. (Confirmed by Aubin.) This rule applies to every length-based style on **both** sides.
3. Add the add-ons: beads at the ends **+$20**.
4. Total estimate: 185 + 30 + 20 = **$235**.

Special cases:
- If a size or add-on says **"to discuss"** (`consult: true`), show "Price to discuss in the salon" and still let them book. The estimate shows "from $X".
- Shorter than normal (neck, shoulder) = same as normal price.
- A size with a **blank price** (Knotless Braids Large) shows **"Ask in salon"** and can still be booked.
- Prices are always called **"estimated"**. The stylist confirms the final price in the salon.

### 5.4 Rules the booking MUST follow

- MUST NOT let two bookings overlap for the same person. (Two kids on one swing = never.)
- MUST NOT show times in the past.
- MUST NOT allow a booking less than **60 minutes** from now (setting `min_notice_minutes`, default 60).
- MUST NOT allow a booking more than **60 days** ahead (setting `max_days_ahead`).
- MUST NOT show times outside the person's working hours or during their time off.
- MUST NOT ask for any payment or card.
- The service must **fit completely** before closing. A 35-min Classic Haircut cannot start after 19:25 if the barber ends at 20:00; a 15-min beard can start at 19:45; a 60-min stylist service starts at 19:00 at the latest.
- Start times (Change Request #2): **barbers every 5 minutes** (`settings.barber_slot_minutes` = 5: Noël booked at 10:00 for a Classic means the next free start is 10:35), **stylists on the hour** (`settings.stylist_slot_minutes` = 60). The old `slot_interval_minutes` (15) stays in the table for now.
- If two people click the same time at the same moment, only one wins. The other sees: "Sorry, this time was just booked. Please pick another." (The database enforces this, not the page. See 6.3.)

---

## 6. The back end (the kitchen)

### 6.1 The idea, like a 10-year-old

- The **database** is a filing cabinet with labeled drawers. Each drawer is a **table**.
- The **API** is the waiter: the page asks the waiter "what times are free?", the waiter checks the filing cabinet and comes back with the answer.
- **Login** is like showing your staff badge before entering the staff room.

### 6.2 Tech stack

| Part | Tool | Why |
|---|---|---|
| Website + API | **Next.js 15 (App Router) + TypeScript** | Pages and API in one project |
| Styling | **Tailwind CSS** | Fast, uses the color tokens above |
| Database + Login | **Supabase** (Postgres + Auth) | Free tier, real database, built-in login |
| Emails | **Resend** | Simple confirmation emails |
| Hosting | **Vercel** | Free, deploys from GitHub |
| Validation | **Zod** | Checks every form input on the server |
| Dates | **date-fns + date-fns-tz** | Time zones done right |

Hosting and the Supabase project stay on **Josh's accounts** until the site is paid. Then transfer.

### 6.3 Tables (the drawers)

All money is stored in **cents** (`$30` → `3000`). All times are stored as `timestamptz`.

**`settings`** (one row only)
`shop_name, address, email, phone, timezone ('America/Toronto'), slot_interval_minutes (15, old), barber_slot_minutes (5), stylist_slot_minutes (60), min_notice_minutes (60), max_days_ahead (60), extra_length_price_cents (1500), opening_hours (jsonb)`

**`staff`** — the barbers and stylists
`id, name, photo_url, bio, side ('men' | 'women' | 'both': which page shows them), team ('barber' | 'stylist': which services they do), email (private: where their "new booking" email goes), role ('owner' | 'staff'), auth_user_id (links to Supabase login), is_active, sort_order`
- `email` and `auth_user_id` are **private**: the public (anon) and signed-in keys can only read `id, name, photo_url, bio, side, role, is_active, sort_order, team` (column grants). The server reads emails with the service role key.

**`categories`**
`id, side ('men' | 'women'), name_en, name_fr, sort_order`

**`services`**
`id, category_id, side, team ('barber' | 'stylist'), slug, name_en, name_fr, description, image_url, base_duration_minutes (nullable), length_based, is_active, sort_order`

**`service_variants`** — the sizes (men's services have one variant called "Standard")
`id, service_id, label ('Small', '2-4 cornrows'…), price_cents (nullable), is_consult (bool), duration_minutes (nullable), sort_order`

**`service_addons`**
`id, service_id, name, price_cents (nullable), is_from (bool, "start at"), is_consult (bool), extra_minutes (default 0)`

**`staff_services`** — who can do what
`staff_id, service_id` (both together are the primary key)

**`working_hours`** — each person's weekly schedule
`id, staff_id, weekday (0 = Sunday … 6 = Saturday), start_time, end_time`

**`time_off`** — vacations, breaks, sick days
`id, staff_id, starts_at, ends_at, reason`

**`bookings`**
`id, staff_id, service_id, variant_id, addon_ids (uuid[]), length_label, customer_name, customer_phone, customer_email, notes, starts_at, ends_at, price_estimate_cents, status ('booked' | 'completed' | 'cancelled' | 'no_show'), cancel_token (random, unique), created_at`

**The no-overlap lock** (this is the "only one kid on the swing" rule):
```sql
create extension if not exists btree_gist;
alter table bookings add constraint no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status = 'booked');
```

### 6.4 Durations (how long each booking blocks)

Change Request #2 (Aubin, Oct 31). The minutes live in `services-seed.json` (`duration_min`) and in `services.base_duration_minutes`:

| Team | Service | Minutes |
|---|---|---|
| Barber | Classic Haircut | 35 |
| Barber | Haircut & Beard Trim | 45 |
| Barber | Kids | 30 |
| Barber | Beard | 15 |
| Barber | Outline | 15 |
| Stylist | **Every** braid / twist / loc / French curl / cornrow service, every size, both sides | 60 |

- This **replaces** the old 180 / 150 / 120 minute size rule.
- ⚠️ Risk (flagged, not changed): a 2–3 hour style now blocks only 1 hour, so a stylist could be double-booked on a long style. Aubin knows his team; confirm with him (section 12).
- Add-on `extra_minutes` default 0.
- Keep the rule in **one function** (`getDurationMinutes`) so Aubin's real per-style times can replace it later (set `duration_min` per service or `duration_minutes` per size).

### 6.4a Teams: who does what

| Team | People | Services |
|---|---|---|
| `barber` | Noël, Jackson, Joshua, Duckel | Classic Haircut, Haircut & Beard Trim, Kids, Beard, Outline (5) |
| `stylist` | Reine, Olga | every other service (37): the 4 men's "Braids, Twists & Locs" (Simple Cornrows, Stitch Cornrows, Barrel Twists, Locs Re-twist) **and** all 33 women's styles |

- The team comes from the category's `team` in `services-seed.json` (catalog: `service.team`, `staff.team`, `staffForTeam(team)`).
- `staff_services` = each person does **exactly** their team's services (2 × 5 + 2 × 37 = **84** rows). Never across teams.
- `side` is unchanged: it only decides which page (Men / Women) shows a service or a person.
- Live data is moved by the migration `supabase/migrations/20261031120000_cr2_teams_prices_durations.sql` (paste-ready copy with checks: `supabase/manual/cr2_teams_prices_durations.sql`).

### 6.5 Who can see what (Row Level Security)

Like a school: anyone can read the posters in the hallway, only teachers enter the staff room.

| Table | Public (no login) | Staff | Owner |
|---|---|---|---|
| settings, staff (active; public columns only, **never `email`**), categories, services, variants, addons, staff_services | read | read | read + write |
| working_hours, time_off | no | read/write **own** | read/write all |
| bookings | **no** (never) | read/update **own** | read/update all |

- Customers never read the `bookings` table directly. They only create bookings through the server API.
- The server uses the Supabase **service role key** only inside API routes. Never in the browser.

### 6.6 API routes (the waiters)

| Route | What it does |
|---|---|
| `GET /api/availability?serviceId=&variantId=&addonIds=&staffId=&date=` | Returns the free start times for that day. `staffId=any` means anyone. |
| `POST /api/bookings` | Creates a booking. Re-checks the price and availability on the server. Returns the booking id. |
| `POST /api/bookings/[token]/cancel` | Cancels using the secret token from the email. |

**How `availability` finds free times (step by step):**
1. Find how long the service takes (variant + add-ons).
2. Get the person's working hours for that weekday.
3. Remove their time off.
4. Remove their existing `booked` bookings.
5. Walk through the day in steps of the service's team (barbers 5 minutes, stylists 60 minutes: `settings.barber_slot_minutes` / `stylist_slot_minutes`). Keep a start time only if the whole service fits in a free block.
6. Remove times in the past or within `min_notice_minutes`.
7. For "anyone", do steps 2–6 for every person who does this service, and merge the results.

**`POST /api/bookings` MUST:**
- Validate every field with Zod (phone, email, name length ≤ 80, notes ≤ 500).
- **Recalculate the price on the server.** Never trust the price the page sends.
- For "anyone", pick the first free person at that time.
- Insert the row. If the database says "overlap", return HTTP 409 with the "just booked" message.
- Send emails (6.7).
- Have a simple spam guard: a hidden "honeypot" field + max 5 bookings per phone per day.

### 6.7 Emails (Resend)

| When | To | Says |
|---|---|---|
| Booking created | Customer | Service, person, date/time, estimated price, address, "pay at the salon", **cancel link** |
| Booking created | Salon email + the staff member (`staff.email`) | New booking details |
| Booking cancelled | Salon email + staff member | "Cancelled" |

If emails fail, the booking is still saved. Log the error.

### 6.8 Staff dashboard `/staff`

Login with **email magic link** (Supabase Auth). The owner adds staff emails.

**Every staff member sees:**
1. **Today** view: list of their bookings, in time order (time, customer, phone, service, size, length, add-ons, notes, price estimate).
2. **Week** view: a simple calendar.
3. Buttons on each booking: **Completed** · **No-show** · **Cancel**.
4. **My time off**: add a break or a day off.

**The owner (Aubin) also sees:**
1. All staff bookings, with a filter by person and by side (Men / Women).
2. **Staff**: add, edit, hide a person; set their side, photo, working hours, and which services they do.
3. **Services**: edit names, prices, durations; hide a service.
4. **Manual booking**: add a walk-in or a phone booking.

✅ **You know it worked when:** Aubin opens `/staff` on his phone and sees today's list in under 3 taps.

---

## 7. Language

- Service names show both languages, like the reference: "Haircut & Beard Trim / Coupe Régulière & Barbe".
- All button and page text lives in **one dictionary file** (`/lib/i18n.ts`) with `en` and `fr`, so a language switch can be added later without rewriting pages.
- `TODO: ask Aubin — default language French or English? Do we show an EN/FR switch in v1?` Default for the demo: **English with bilingual service names.**

---

## 8. Images (Josh puts these files in the project)

| File path | What it is |
|---|---|
| `/public/brand/logo.jpg` | The Fresh Look logo (scissors + comb) |
| `/public/images/salon.jpg` | The shop interior (hero) |
| `/public/images/men/cut-1.jpg` … `cut-N.jpg` | Men's haircut photos (from the repo's old `images/` folder — check each one, some names are wrong) |
| `/public/images/women/<service-slug>.jpg` | One photo per women's style (cropped from the menus, or better: the stylist's own originals) |

If an image is missing, show a neutral `oak` box with the service name. Never break the page.

---

## 9. Build order (do it in this order)

**Phase 1 — Demo (tonight)**
1. Create the Next.js project, Tailwind, fonts, color tokens.
2. Build Home, Men, Women pages with data from `services-seed.json`.
3. Create the Supabase tables (section 6.3) + seed script that reads `services-seed.json`.
4. Build the booking stepper and `/api/availability` + `/api/bookings`.
5. Deploy to Vercel (Josh's account) and send Aubin the link.

**Phase 2 — Staff side**
6. Staff login + dashboard (Today, Week, status buttons, time off).
7. Owner screens (staff, services, manual booking).

**Phase 3 — Polish**
8. Emails + cancel link + `.ics` calendar file.
9. SEO basics: page titles, description, Open Graph image (logo), `LocalBusiness` schema with address.
10. Replace every `TODO` with Aubin's real answers.

---

## 10. Acceptance tests (the "did it work?" checklist)

1. Book a men's haircut on a phone → it appears on that barber's dashboard.
2. Try to book the same barber at the same time from a second browser → the second gets the "just booked" message.
3. A 35-minute Classic Haircut is offered at 19:25 but never later when the day ends at 20:00. Sunday shows times, and Sunday Nov 1, 2026 (DST change) still starts at 10:00.
4. Knotless Small + Hip + beads shows **$235** estimated.
5. A "to discuss" option shows "Price to discuss in the salon" and still books. Knotless Large shows "Ask in salon".
5b. Cornrows, Barrel Twists and Locs Re-twist appear on the **Men** page only. A Small knotless braid (60 min block) offers no slot that would end after closing (19:00 is the last start).
5c. Simple Cornrows (Men page) offers only the stylists (Reine, Olga) + "Anyone available"; a Classic Haircut offers only the barbers (Noël, Jackson, Joshua, Duckel).
6. A staff member cannot see another staff member's bookings. The owner can see all.
7. Opening `/api/...` from the browser never leaks the bookings list.
8. No page asks for a card or a deposit.
9. Every page works at 375px wide with no sideways scrolling.
10. Locs Installation does not appear anywhere.

---

## 11. Decisions made (Oct 30)

| Question | Answer |
|---|---|
| Staff | 4 people, no names yet: Barber A, B, C, D |
| Phone | (418) 255-2571 (from the shop flyer) |
| Braid/twist/loc durations | Roughly 2–3 hours (replaced Oct 31 by a 60 min block, see 6.4) |
| Men's menu | Add Classic Haircut $25 (now $30, Oct 31) + braid styles; more photos later |
| Passion Twists Micro | $350 |
| Knotless Braids Large | Price left blank → "Ask in salon" |
| Duplicate style names | Keep as Style A, B, C, D |
| Cornrows, Barrel Twists, Locs Re-twist | **Men's side** |
| Extra length | +$15 per step past mid-back (confirmed) |

### Decisions made (Oct 31, Change Request #2)

| Question | Answer |
|---|---|
| Classic Haircut price | $25 → **$30** |
| Haircut & Beard Trim price | $30 → **$35** |
| Kids / Beard / Outline | unchanged: $25 / $20 / $20; 30 / 15 / 15 min |
| Barber blocks | Classic **35 min**, Haircut & Beard Trim **45 min**; start times every **5 min** |
| Stylist blocks | **60 min** for every braid / twist / loc style (replaces the 180/150/120 rule); start times on the hour |
| Teams | Barbers (Noël, Jackson, Joshua, Duckel) = 5 haircut services; stylists (Reine, Olga) (every braid / twist / loc service, both sides, incl. men's cornrows) |
| Staff emails | New private `staff.email` column; placeholders until Aubin sends real ones (set in the database, never in the repo) |

## 12. Still open (placeholders are fine for the demo)

1. ~~Shop hours~~ Done: every day 10:00–20:00 (Oct 30).
2. ~~Real names and emails~~ Done Nov 1: names in the seed, emails in the database only (Supabase SQL editor), **never in the repo** (it is public).
6. **Kids haircut**: keep 30 minutes and $25?
7. **Stylist 60 min block**: is 1 hour right for long styles (2–3 h)? Today a stylist can be booked again 1 hour after a long style starts.
3. **Language**: French first, English first, or a switch?
4. **Cancellation**: how late can a customer cancel online (e.g. up to 24h before)?
5. Instagram / TikTok links.
