import type { Metadata } from "next";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { shop } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { formatCents } from "@/lib/pricing";
import { getAdminClient } from "@/lib/server/supabase";

export const metadata: Metadata = { title: "You're booked!", robots: { index: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsEscape = (s: string) => s.replace(/([,;\\])/g, "\\$1");

export default async function ConfirmedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Only non-personal fields are shown here (the id is an unguessable uuid).
  const { data } = UUID.test(id)
    ? await getAdminClient()
        .from("bookings")
        .select("starts_at, ends_at, length_label, price_estimate_cents, staff:staff_id (name), service:service_id (name_en), variant:variant_id (label)")
        .eq("id", id)
        .maybeSingle()
    : { data: null };

  if (!data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <p className="text-muted">{t.confirmed.notFound}</p>
        <Link href="/" className="mt-6 inline-block underline">
          {t.confirmed.backHome}
        </Link>
      </div>
    );
  }

  const start = new Date(data.starts_at);
  const end = new Date(data.ends_at);
  const person = (data.staff as unknown as { name: string }).name;
  const serviceName = (data.service as unknown as { name_en: string }).name_en;
  const variantLabel = (data.variant as unknown as { label: string }).label;
  const line = t.confirmed.line
    .replace("{date}", formatInTimeZone(start, shop.timezone, "EEEE MMM d"))
    .replace("{time}", formatInTimeZone(start, shop.timezone, "h:mm a"))
    .replace("{person}", person);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fresh Look//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${id}@freshlook`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(`${serviceName} · Fresh Look`)}`,
    `LOCATION:${icsEscape(shop.address)}`,
    `DESCRIPTION:${icsEscape(`With ${person}. ${t.confirmed.payInSalon}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:py-24">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gold text-3xl text-onyx" aria-hidden>
        ✓
      </span>
      <h1 className="mt-6 font-serif text-4xl">{t.confirmed.title}</h1>
      <p className="mt-4 text-lg">{line}</p>
      <div className="mx-auto mt-6 max-w-sm rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-ink">
          {serviceName}
          {variantLabel !== "Standard" ? ` · ${variantLabel}` : ""}
          {data.length_label ? ` · ${data.length_label}` : ""}
        </p>
        <p className="mt-1">
          {t.book.estimate}:{" "}
          <span className="font-semibold text-gold-text">
            {data.price_estimate_cents != null ? formatCents(data.price_estimate_cents) : t.book.askInSalon}
          </span>
        </p>
        <p className="mt-1">{shop.address}</p>
        <p className="mt-2">{t.confirmed.payInSalon}</p>
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <a
          href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`}
          download="fresh-look-booking.ics"
          className="rounded-full bg-gold px-6 py-3 font-semibold text-onyx"
        >
          {t.confirmed.addToCalendar}
        </a>
        <Link href="/" className="rounded-full border border-ink px-6 py-3 font-semibold">
          {t.confirmed.backHome}
        </Link>
      </div>
    </div>
  );
}
