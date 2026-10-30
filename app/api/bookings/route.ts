import { NextResponse, type NextRequest } from "next/server";
import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { lengthSteps } from "@/lib/lengths";
import { normalizePhone } from "@/lib/phone";
import { estimatePrice } from "@/lib/pricing";
import { dict } from "@/lib/i18n";
import { getAdminClient } from "@/lib/server/supabase";
import {
  computeAvailability,
  HttpError,
  loadEligibleStaff,
  loadSelection,
  todayIn,
} from "@/lib/server/booking-context";

export const dynamic = "force-dynamic";

const MAX_BOOKINGS_PER_PHONE_PER_DAY = 5;

const Body = z.object({
  serviceId: z.uuid(),
  variantId: z.uuid(),
  addonIds: z.array(z.uuid()).max(10).default([]),
  lengthLabel: z.string().max(40).nullish(),
  staffId: z.union([z.literal("any"), z.uuid()]),
  startsAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(1).max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+().\-\s]+$/),
  email: z.email().max(254),
  notes: z.string().trim().max(500).optional().default(""),
  /** Honeypot: humans never see this field. */
  website: z.string().max(0).optional().default(""),
});

// POST /api/bookings: re-checks price + availability on the server, then inserts.
// The database exclusion constraint is the final word on overlaps.
export async function POST(req: NextRequest) {
  const t = dict.en.book;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: t.errorInvalid, fields: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const phone = normalizePhone(b.phone);
  if (!phone) return NextResponse.json({ error: t.errorPhone, fields: { phone: [t.errorPhone] } }, { status: 400 });

  try {
    const db = getAdminClient();
    const sel = await loadSelection(db, b);
    const tz = sel.settings.timezone;

    // Length: only for length-based styles; must be a known option.
    const steps = sel.service.length_based ? lengthSteps(b.lengthLabel) : 0;
    if (steps === null) throw new HttpError(400, "Unknown length");
    const lengthLabel = sel.service.length_based ? (b.lengthLabel ?? "Normal") : null;

    // Price: recalculated from database rows, never taken from the page.
    const estimate = estimatePrice({
      variant: { priceCents: sel.variant.price_cents, isConsult: sel.variant.is_consult },
      addons: sel.addons.map((a) => ({ priceCents: a.price_cents, isFrom: a.is_from, isConsult: a.is_consult })),
      lengthSteps: steps,
      extraLengthCents: sel.settings.extra_length_price_cents,
    });

    // Spam guard: max 5 bookings per phone per day.
    const dayStart = fromZonedTime(`${todayIn(tz)}T00:00:00`, tz).toISOString();
    const { count, error: countErr } = await db
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("customer_phone", phone)
      .gte("created_at", dayStart);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) >= MAX_BOOKINGS_PER_PHONE_PER_DAY) throw new HttpError(429, t.errorTooMany);

    // Availability: the start time must be a free slot for that person (or anyone).
    const startsAt = new Date(b.startsAt);
    const date = formatInTimeZone(startsAt, tz, "yyyy-MM-dd");
    const people = await loadEligibleStaff(db, b.serviceId, b.staffId);
    const avail = await computeAvailability(db, {
      staffIds: people.map((p) => p.id),
      fromDate: date,
      days: 1,
      durationMinutes: sel.durationMinutes,
      settings: sel.settings,
    });
    const candidates = people.filter((p) =>
      (avail[date]?.[p.id] ?? []).some((s) => s.getTime() === startsAt.getTime()),
    );
    if (!candidates.length) throw new HttpError(409, t.errorTaken);

    const endsAt = addMinutes(startsAt, sel.durationMinutes);
    // For "anyone", try each free person in order; the DB lock decides races.
    for (const person of candidates) {
      const { data, error } = await db
        .from("bookings")
        .insert({
          staff_id: person.id,
          service_id: sel.service.id,
          variant_id: sel.variant.id,
          addon_ids: sel.addons.map((a) => a.id),
          length_label: lengthLabel,
          customer_name: b.name,
          customer_phone: phone,
          customer_email: b.email.toLowerCase(),
          notes: b.notes || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          price_estimate_cents: estimate.cents,
          status: "booked",
        })
        .select("id")
        .single();
      if (!error) {
        // Emails (Resend) arrive in Phase 3. A failed email must never undo the booking.
        return NextResponse.json({ id: data.id }, { status: 201 });
      }
      if (error.code !== "23P01") throw new Error(error.message); // 23P01 = exclusion_violation (overlap)
    }
    throw new HttpError(409, t.errorTaken);
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("booking failed", e);
    return NextResponse.json({ error: t.errorGeneric }, { status: 500 });
  }
}
