import { describe, expect, it } from "vitest";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getFreeStartTimes, weekdayOf } from "@/lib/availability";
import { getDurationMinutes } from "@/lib/duration";
import { OPENING_HOURS, services } from "@/lib/catalog";
import { buildSeedRows } from "@/lib/seed-rows";

const TZ = "America/Toronto";
const DAY = "2026-11-06"; // a Friday
const at = (hm: string) => fromZonedTime(`${DAY}T${hm}:00`, TZ);
const labels = (ds: Date[]) => ds.map((d) => formatInTimeZone(d, TZ, "HH:mm"));

const base = {
  date: DAY,
  working: [{ start: "10:00", end: "20:00" }],
  busy: [],
  now: fromZonedTime("2026-11-01T09:00:00", TZ),
  minNoticeMinutes: 60,
  // Change Request #2 (A2, Oct 31): barber starts every 5 min (was 15 for everyone).
  slotIntervalMinutes: 5,
  timeZone: TZ,
};

describe("getFreeStartTimes (spec 5.4 / 6.6)", () => {
  // Change Request #2 (A2): Classic blocks 35 min (was 30) on a 5-min grid (was 15).
  it("a 35-min Classic Haircut is offered at 19:25 but not 19:30 (closes 20:00)", () => {
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: 35 }));
    expect(slots).toContain("19:25");
    expect(slots).not.toContain("19:30");
    expect(slots[0]).toBe("10:00");
    expect(slots[1]).toBe("10:05");
  });

  it("a 15-min Beard is offered at 19:45 (ends exactly at 20:00), nothing at 20:00 or later", () => {
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: 15 }));
    expect(slots.at(-1)).toBe("19:45");
    expect(slots.filter((s) => s >= "20:00")).toEqual([]);
  });

  // Change Request #2 (A2): 5-min grid, so the last 40-min start is 19:20 (was 19:15).
  it("a 40-min service is never offered after 19:20 when the day ends at 20:00", () => {
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: 40 }));
    expect(slots).not.toContain("19:25");
    expect(slots).not.toContain("19:30");
    expect(slots.at(-1)).toBe("19:20");
  });

  // Change Request #2 (A3, Oct 31): every stylist service blocks 60 min (was 180 for Small).
  it("Knotless Small (60 min stylist block) offers no slot that ends after closing", () => {
    const knotless = services.find((s) => s.slug === "knotless-braids")!;
    const minutes = getDurationMinutes({ service: knotless, variant: knotless.variants.find((v) => v.label === "Small")! });
    expect(minutes).toBe(60);
    // Stylists start on the hour (CR2 A3, stylist_slot_minutes = 60).
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: minutes, slotIntervalMinutes: 60 }));
    expect(slots.at(-1)).toBe("19:00");
  });

  // Change Request #2 (A2): 5-min grid, so the edges move to 13:20 / 14:40 (were 13:15 / 14:45).
  it("skips times that overlap an existing booking", () => {
    const slots = labels(
      getFreeStartTimes({ ...base, durationMinutes: 40, busy: [{ start: at("14:00"), end: at("14:40") }] }),
    );
    expect(slots).toContain("13:20"); // ends 14:00
    expect(slots).not.toContain("13:25"); // would end 14:05
    expect(slots).not.toContain("14:00");
    expect(slots).not.toContain("14:35");
    expect(slots).toContain("14:40");
  });

  it("removes time off", () => {
    const slots = labels(
      getFreeStartTimes({ ...base, durationMinutes: 30, busy: [{ start: at("12:00"), end: at("13:00") }] }),
    );
    expect(slots).not.toContain("12:00");
    expect(slots).not.toContain("11:45");
    expect(slots).toContain("13:00");
  });

  // Change Request #2 (A2): 5-min grid, so the first start after 14:05 is 14:05 (was 14:15).
  it("never shows past times or times within the 60-minute notice", () => {
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: 30, now: at("13:05") }));
    expect(slots[0]).toBe("14:05");
    expect(slots).not.toContain("14:00");
  });

  it("no working hours = no times (e.g. a day off)", () => {
    expect(getFreeStartTimes({ ...base, durationMinutes: 30, working: [] })).toEqual([]);
  });

  it("Sunday Nov 1, 2026 (clocks go back at 2 AM) still opens at 10:00 Ottawa time", () => {
    expect(weekdayOf("2026-11-01")).toBe(0);
    const sunday = getFreeStartTimes({ ...base, date: "2026-11-01", durationMinutes: 30, now: new Date("2026-10-30T12:00:00Z") });
    expect(labels(sunday)[0]).toBe("10:00");
    expect(sunday[0].toISOString()).toBe("2026-11-01T15:00:00.000Z"); // EST, UTC-5
    expect(labels(sunday).at(-1)).toBe("19:30");
    // The day before is still daylight time (UTC-4).
    const saturday = getFreeStartTimes({ ...base, date: "2026-10-31", durationMinutes: 30, now: new Date("2026-10-30T12:00:00Z") });
    expect(saturday[0].toISOString()).toBe("2026-10-31T14:00:00.000Z");
  });
});

describe("opening hours (change request #1)", () => {
  it("every day, 10:00-20:00", () => {
    expect(OPENING_HOURS.map((h) => h.weekday).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(OPENING_HOURS.every((h) => h.start === "10:00" && h.end === "20:00")).toBe(true);
  });

  it("seed gives each of the 6 staff 7 rows (42), no duplicates", () => {
    const rows = buildSeedRows().working_hours;
    expect(rows).toHaveLength(42);
    expect(new Set(rows.map((r) => `${r.staff_id}:${r.weekday}`)).size).toBe(42);
  });

  it("address has no unit number", () => {
    expect(buildSeedRows().settings[0].address).toBe("478 Rideau St, Ottawa, ON K1N 5Z4");
  });
});

describe("getDurationMinutes (spec 6.4)", () => {
  // Change Request #2 (A2, Oct 31): Haircut & Beard Trim blocks 45 min (was 40).
  it("uses the men's cut minutes from the seed", () => {
    const cut = services.find((s) => s.slug === "haircut-beard-trim")!;
    expect(getDurationMinutes({ service: cut, variant: cut.variants[0] })).toBe(45);
  });

  // Change Request #2 (A3, Oct 31): the 3h / 2h30 / 2h size rule is gone; every stylist
  // size blocks 60 min (was XMicro-Small 180, Smedium/Medium 150, others 120).
  it("no size rule any more: every knotless size blocks 60 min", () => {
    const knotless = services.find((s) => s.slug === "knotless-braids")!;
    expect(knotless.variants.map((v) => getDurationMinutes({ service: knotless, variant: v }))).toEqual(
      knotless.variants.map(() => 60),
    );
  });

  it("adds add-on extra minutes", () => {
    expect(
      getDurationMinutes({
        service: { baseDurationMinutes: 30 },
        variant: { durationMinutes: null },
        addons: [{ extraMinutes: 15 }],
      }),
    ).toBe(45);
  });
});
