// Free start times for one person on one day (spec 6.6, steps 2-6).
// Pure functions: the API route loads the rows and passes them in.
import { addMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Team } from "@/lib/catalog";

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotInput {
  /** Local salon date, "yyyy-MM-dd". */
  date: string;
  durationMinutes: number;
  /** Working blocks for that weekday, local "HH:mm" (or "HH:mm:ss"). */
  working: { start: string; end: string }[];
  /** Time off + existing booked appointments. */
  busy: Interval[];
  now: Date;
  minNoticeMinutes: number;
  /**
   * Start-time step for the service's team (slotMinutesForTeam). Starts are multiples of
   * this counted from local midnight (barbers 5: :00 :05 :10...; stylists 60: on the hour),
   * not from the start of the working block.
   */
  slotIntervalMinutes: number;
  timeZone: string;
}

/** Change Request #2: barbers start every barber_slot_minutes (5), stylists every stylist_slot_minutes (60). */
export function slotMinutesForTeam(
  team: Team,
  settings: { barber_slot_minutes: number; stylist_slot_minutes: number },
): number {
  const minutes = team === "stylist" ? settings.stylist_slot_minutes : settings.barber_slot_minutes;
  if (!Number.isInteger(minutes) || minutes <= 0) throw new Error(`Bad slot minutes for ${team}: ${minutes}`);
  return minutes;
}

/** "HH:mm" or "HH:mm:ss" -> minutes after local midnight. */
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const pad = (n: number) => String(n).padStart(2, "0");

export function getFreeStartTimes(input: SlotInput): Date[] {
  const { date, durationMinutes, working, busy, now, minNoticeMinutes, slotIntervalMinutes: step, timeZone } = input;
  if (!(step > 0)) throw new Error("slotIntervalMinutes must be > 0");
  const earliest = addMinutes(now, minNoticeMinutes);
  // Local wall-clock time on that date -> real instant (handles the DST change days).
  const instant = (min: number) => fromZonedTime(`${date}T${pad(Math.floor(min / 60))}:${pad(min % 60)}:00`, timeZone);
  const out: Date[] = [];
  for (const block of working) {
    const startMin = toMinutes(block.start);
    const blockEnd = instant(toMinutes(block.end));
    // First grid time at or after the block start, counted from local midnight.
    for (let m = Math.ceil(startMin / step) * step; m < 24 * 60; m += step) {
      const t = instant(m);
      const end = addMinutes(t, durationMinutes);
      if (end > blockEnd) break; // the whole service must fit before the block ends
      if (t < earliest) continue;
      const clash = busy.some((b) => t < b.end && b.start < end);
      if (!clash) out.push(t);
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

export interface DaySummary {
  date: string;
  slots: { start: string; label: string }[];
  /** Nobody asked for (the one person, or everyone on the team for "any") has working hours that day. */
  notWorking: boolean;
}

/**
 * One day for the API: a time shows if at least one person is free ("anyone").
 * perStaff[id] is null when that person has no working_hours row for the day.
 */
export function summarizeDay(date: string, perStaff: Record<string, Date[] | null>, timeZone: string): DaySummary {
  const lists = Object.values(perStaff);
  const times = new Map<number, Date>();
  for (const list of lists) for (const t of list ?? []) times.set(t.getTime(), t);
  const slots = [...times.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .map((t) => ({ start: t.toISOString(), label: formatInTimeZone(t, timeZone, "HH:mm") }));
  return { date, slots, notWorking: lists.every((l) => l === null) };
}

/** 0 = Sunday ... 6 = Saturday for a "yyyy-MM-dd" date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
