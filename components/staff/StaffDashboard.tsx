import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { shop } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";
import type { StaffBooking } from "@/lib/server/staff-bookings";
import { signOut } from "@/app/staff/actions";
import { CancelButton } from "@/components/staff/CancelButton";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="shrink-0 whitespace-nowrap rounded-full border border-line px-4 py-2 text-sm">
        {t.staff.signOut}
      </button>
    </form>
  );
}

/** Bookings grouped by day (salon time), sorted by time, with a barber filter. */
export function StaffDashboard({
  bookings,
  staff,
  filter,
  email,
  today,
}: {
  bookings: StaffBooking[];
  staff: { id: string; name: string }[];
  filter?: string;
  email: string;
  today: string;
}) {
  const days = new Map<string, StaffBooking[]>();
  for (const b of bookings) days.set(b.date, [...(days.get(b.date) ?? []), b]);

  const pill = (on: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-sm ${on ? "border-gold bg-gold text-onyx font-semibold" : "border-line bg-surface"}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-serif text-3xl">{t.staff.bookings}</h1>
          <p className="mt-1 truncate text-sm text-muted">
            {t.staff.upcoming} · {email}
          </p>
        </div>
        <SignOutButton />
      </div>

      <nav aria-label="Filter by barber" className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href="/staff" className={pill(!filter)} aria-current={!filter ? "page" : undefined}>
          {t.staff.allBarbers}
        </Link>
        {staff.map((s) => (
          <Link key={s.id} href={`/staff?staff=${s.id}`} className={pill(filter === s.id)} aria-current={filter === s.id ? "page" : undefined}>
            {s.name}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 && <p className="mt-12 text-center text-muted">{t.staff.none}</p>}

      {[...days.entries()].map(([date, list]) => (
        <section key={date} className="mt-8">
          <h2 className="mb-3 border-b border-line pb-2 font-serif text-xl">
            {date === today ? `${t.staff.today} · ` : ""}
            {formatInTimeZone(list[0].startsAt, shop.timezone, "EEEE, MMM d")}
          </h2>
          <ul className="space-y-3">
            {list.map((b) => (
              <li key={b.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start gap-4">
                  <p className="w-16 shrink-0 font-serif text-xl leading-tight text-gold-text">
                    {formatInTimeZone(b.startsAt, shop.timezone, "h:mm")}
                    <span className="block font-sans text-xs text-muted">
                      {formatInTimeZone(b.startsAt, shop.timezone, "a")}
                    </span>
                  </p>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{b.service}</p>
                    {b.addons.length > 0 && <p className="text-sm text-muted">+ {b.addons.join(", ")}</p>}
                    <p className="text-sm text-muted">{b.staffName}</p>
                    <p className="mt-2 font-medium">{b.customerName}</p>
                    {b.notes && (
                      <p className="mt-1 text-sm text-muted">
                        {t.staff.notes}: {b.notes}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <a href={`tel:${b.customerPhone}`} className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                    {t.staff.call}
                  </a>
                  <a href={`sms:${b.customerPhone}`} className="rounded-full border border-ink px-4 py-2 text-sm font-semibold">
                    {t.staff.text}
                  </a>
                  <span className="text-sm text-muted">{formatPhone(b.customerPhone)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <a href={`mailto:${b.customerEmail}`} className="min-w-0 break-all text-sm text-gold-text underline-offset-4 hover:underline">
                    {b.customerEmail}
                  </a>
                  <CancelButton id={b.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
