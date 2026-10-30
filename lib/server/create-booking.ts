import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { BookingBody } from "@/lib/booking-schema";
import { dict } from "@/lib/i18n";
import { lengthSteps } from "@/lib/lengths";
import { estimatePrice } from "@/lib/pricing";
import {
  computeAvailability,
  HttpError,
  loadEligibleStaff,
  loadSelection,
  todayIn,
} from "@/lib/server/booking-context";
import { sendBookingEmails, type BookingSummary } from "@/lib/server/email";

const MAX_BOOKINGS_PER_PHONE_PER_DAY = 5;

export interface CreateBookingResult {
  status: number;
  body: { id?: string; error?: string; fields?: Record<string, string[] | undefined> };
}

/**
 * Validates, re-checks price + availability, inserts, then emails the salon and the
 * customer. The database exclusion constraint is the final word on overlaps.
 * `notify` failing never changes the result: the booking is already saved.
 */
export async function createBooking(
  db: SupabaseClient,
  json: unknown,
  notify: (s: BookingSummary) => Promise<unknown> = sendBookingEmails,
): Promise<CreateBookingResult> {
  const t = dict.en.book;
  const parsed = BookingBody.safeParse(json);
  if (!parsed.success) {
    return { status: 400, body: { error: t.errorInvalid, fields: z.flattenError(parsed.error).fieldErrors } };
  }
  const b = parsed.data;

  try {
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
      .eq("customer_phone", b.phone)
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
          customer_phone: b.phone,
          customer_email: b.email,
          notes: b.notes || null,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          price_estimate_cents: estimate.cents,
          status: "booked",
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23P01") continue; // exclusion_violation: someone just took it
        throw new Error(error.message);
      }

      // Saved. From here on nothing can turn this into a failure.
      try {
        await notify({
          id: data.id,
          customerName: b.name,
          customerPhone: b.phone,
          customerEmail: b.email,
          serviceName: sel.service.name_en,
          variantLabel: sel.variant.label === "Standard" ? null : sel.variant.label,
          lengthLabel,
          addons: sel.addons.map((a) => a.name),
          staffName: person.name,
          startsAt,
          estimate,
          notes: b.notes || null,
        });
      } catch (e) {
        console.error(`[email] notification failed for booking ${data.id}: ${e instanceof Error ? e.message : "unknown"}`);
      }
      return { status: 201, body: { id: data.id } };
    }
    throw new HttpError(409, t.errorTaken);
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, body: { error: e.message } };
    // Message only: database error details can contain the submitted row.
    console.error(`booking failed: ${e instanceof Error ? e.message : "unknown"}`);
    return { status: 500, body: { error: t.errorGeneric } };
  }
}
