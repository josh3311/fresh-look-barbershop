import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDaysToDate, getFreeStartTimes, slotMinutesForTeam, weekdayOf, type Interval } from "@/lib/availability";
import { TEAMS, type Team } from "@/lib/catalog";
import { getDurationMinutes } from "@/lib/duration";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Settings {
  timezone: string;
  /** Change Request #2: start-time steps per team (slot_interval_minutes is no longer used). */
  barber_slot_minutes: number;
  stylist_slot_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  extra_length_price_cents: number;
}

export interface ServiceRow {
  id: string;
  side: string;
  team: Team;
  name_en: string;
  base_duration_minutes: number | null;
  length_based: boolean;
  is_active: boolean;
}
export interface VariantRow {
  id: string;
  service_id: string;
  label: string;
  price_cents: number | null;
  is_consult: boolean;
  duration_minutes: number | null;
}
export interface AddonRow {
  id: string;
  service_id: string;
  name: string;
  price_cents: number | null;
  is_from: boolean;
  is_consult: boolean;
  extra_minutes: number;
}

export interface Selection {
  serviceId: string;
  variantId: string;
  addonIds: string[];
  /** a staff uuid, or "any" */
  staffId: string;
}

/** Loads settings + the chosen service/variant/add-ons, checks they belong together. */
export async function loadSelection(db: SupabaseClient, sel: Selection) {
  const [settingsRes, serviceRes, variantRes, addonsRes] = await Promise.all([
    db.from("settings").select("timezone, barber_slot_minutes, stylist_slot_minutes, min_notice_minutes, max_days_ahead, extra_length_price_cents").eq("id", 1).single(),
    db.from("services").select("id, side, team, name_en, base_duration_minutes, length_based, is_active").eq("id", sel.serviceId).maybeSingle(),
    db.from("service_variants").select("id, service_id, label, price_cents, is_consult, duration_minutes").eq("id", sel.variantId).maybeSingle(),
    sel.addonIds.length
      ? db.from("service_addons").select("id, service_id, name, price_cents, is_from, is_consult, extra_minutes").in("id", sel.addonIds)
      : Promise.resolve({ data: [] as AddonRow[], error: null }),
  ]);
  if (settingsRes.error) throw new Error(`settings: ${settingsRes.error.message}`);
  const service = serviceRes.data as ServiceRow | null;
  const variant = variantRes.data as VariantRow | null;
  const addons = (addonsRes.data ?? []) as AddonRow[];
  if (!service || !service.is_active) throw new HttpError(404, "Service not found");
  if (!variant || variant.service_id !== service.id) throw new HttpError(400, "Size not found for this service");
  if (addons.length !== new Set(sel.addonIds).size || addons.some((a) => a.service_id !== service.id))
    throw new HttpError(400, "Add-on not found for this service");
  if (!TEAMS.includes(service.team)) throw new Error(`service ${service.id} has no valid team`);

  const durationMinutes = getDurationMinutes({
    service: { baseDurationMinutes: service.base_duration_minutes, team: service.team },
    variant: { durationMinutes: variant.duration_minutes },
    addons: addons.map((a) => ({ extraMinutes: a.extra_minutes })),
  });

  return { settings: settingsRes.data as Settings, service, variant, addons, durationMinutes, team: service.team };
}

export interface EligibleStaff {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  team: Team;
}

/**
 * Active staff who do this service (optionally one person), in display order.
 * Change Request #2 (A4): a person must be in staff_services for the service AND on the
 * service's team, so a wrong staff_services row or a tampered staffId can never book a
 * barber for a braid style (or a stylist for a haircut). "any" = this team only.
 */
export async function loadEligibleStaff(db: SupabaseClient, service: { id: string; team: Team }, staffId: string) {
  const { data, error } = await db
    .from("staff_services")
    .select("staff:staff_id (id, name, is_active, sort_order, team)")
    .eq("service_id", service.id);
  if (error) throw new Error(`staff_services: ${error.message}`);
  const people = (data ?? [])
    .map((r) => r.staff as unknown as EligibleStaff)
    .filter((s) => s && s.is_active && s.team === service.team)
    .sort((a, b) => a.sort_order - b.sort_order);
  if (staffId === "any") return people;
  const one = people.filter((p) => p.id === staffId);
  if (!one.length) throw new HttpError(400, "This person does not do this service");
  return one;
}

export function todayIn(tz: string, now = new Date()) {
  return formatInTimeZone(now, tz, "yyyy-MM-dd");
}

/**
 * Free start times per person per day (spec 6.6 steps 2-6), on the team's start-time grid
 * (barbers every barber_slot_minutes, stylists every stylist_slot_minutes).
 * Returns { [date]: { [staffId]: Date[] | null } }: null = no working_hours row that day
 * ("Not working this day", Change Request #2 A5).
 */
export async function computeAvailability(
  db: SupabaseClient,
  opts: {
    staffIds: string[];
    fromDate: string;
    days: number;
    durationMinutes: number;
    settings: Settings;
    team: Team;
    now?: Date;
  },
) {
  const { staffIds, fromDate, days, durationMinutes, settings } = opts;
  const slotIntervalMinutes = slotMinutesForTeam(opts.team, settings);
  const now = opts.now ?? new Date();
  const tz = settings.timezone;
  const today = todayIn(tz, now);
  const lastAllowed = addDaysToDate(today, settings.max_days_ahead);

  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDaysToDate(fromDate, i);
    if (d >= today && d <= lastAllowed) dates.push(d);
  }
  const result: Record<string, Record<string, Date[] | null>> = {};
  if (!dates.length || !staffIds.length) return result;

  const rangeStart = fromZonedTime(`${dates[0]}T00:00:00`, tz).toISOString();
  const rangeEnd = fromZonedTime(`${addDaysToDate(dates[dates.length - 1], 1)}T00:00:00`, tz).toISOString();

  const [hoursRes, offRes, bookedRes] = await Promise.all([
    db.from("working_hours").select("staff_id, weekday, start_time, end_time").in("staff_id", staffIds),
    db.from("time_off").select("staff_id, starts_at, ends_at").in("staff_id", staffIds).lt("starts_at", rangeEnd).gt("ends_at", rangeStart),
    db.from("bookings").select("staff_id, starts_at, ends_at").in("staff_id", staffIds).eq("status", "booked").lt("starts_at", rangeEnd).gt("ends_at", rangeStart),
  ]);
  for (const r of [hoursRes, offRes, bookedRes]) if (r.error) throw new Error(r.error.message);

  const busyBy: Record<string, Interval[]> = {};
  for (const r of [...(offRes.data ?? []), ...(bookedRes.data ?? [])]) {
    (busyBy[r.staff_id] ??= []).push({ start: new Date(r.starts_at), end: new Date(r.ends_at) });
  }

  for (const date of dates) {
    const weekday = weekdayOf(date);
    result[date] = {};
    for (const staffId of staffIds) {
      const working = (hoursRes.data ?? [])
        .filter((h) => h.staff_id === staffId && h.weekday === weekday)
        .map((h) => ({ start: h.start_time as string, end: h.end_time as string }));
      if (!working.length) {
        result[date][staffId] = null; // not working this day
        continue;
      }
      result[date][staffId] = getFreeStartTimes({
        date,
        durationMinutes,
        working,
        busy: busyBy[staffId] ?? [],
        now,
        minNoticeMinutes: settings.min_notice_minutes,
        slotIntervalMinutes,
        timeZone: tz,
      });
    }
  }
  return result;
}
