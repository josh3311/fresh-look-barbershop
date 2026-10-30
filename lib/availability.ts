// Free start times for one person on one day (spec 6.6, steps 2-6).
// Pure function: the API route loads the rows and passes them in.
import { addMinutes } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

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
  slotIntervalMinutes: number;
  timeZone: string;
}

const hhmm = (t: string) => t.slice(0, 5);

export function getFreeStartTimes(input: SlotInput): Date[] {
  const { date, durationMinutes, working, busy, now, minNoticeMinutes, slotIntervalMinutes, timeZone } =
    input;
  const earliest = addMinutes(now, minNoticeMinutes);
  const out: Date[] = [];
  for (const block of working) {
    const blockStart = fromZonedTime(`${date}T${hhmm(block.start)}:00`, timeZone);
    const blockEnd = fromZonedTime(`${date}T${hhmm(block.end)}:00`, timeZone);
    for (let t = blockStart; addMinutes(t, durationMinutes) <= blockEnd; t = addMinutes(t, slotIntervalMinutes)) {
      if (t < earliest) continue;
      const end = addMinutes(t, durationMinutes);
      const clash = busy.some((b) => t < b.end && b.start < end);
      if (!clash) out.push(t);
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
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
