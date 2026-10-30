import { describe, expect, it } from "vitest";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getFreeStartTimes, weekdayOf } from "@/lib/availability";
import { getDurationMinutes, sizeRuleMinutes } from "@/lib/duration";
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
  slotIntervalMinutes: 15,
  timeZone: TZ,
};

describe("getFreeStartTimes (spec 5.4 / 6.6)", () => {
  it("a 30-min Classic Haircut is offered at 19:30 but not 19:45 (closes 20:00)", () => {
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: 30 }));
    expect(slots).toContain("19:30");
    expect(slots).not.toContain("19:45");
    expect(slots[0]).toBe("10:00");
    expect(slots).toContain("10:15");
  });

  it("a 15-min Beard is offered at 19:45 (ends exactly at 20:00), nothing at 20:00 or later", () => {
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: 15 }));
    expect(slots.at(-1)).toBe("19:45");
    expect(slots.filter((s) => s >= "20:00")).toEqual([]);
  });

  it("a 40-min service is never offered at 19:30 when the day ends at 20:00", () => {
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: 40 }));
    expect(slots).not.toContain("19:30");
    expect(slots.at(-1)).toBe("19:15");
  });

  it("Knotless Small (180 min) offers no slot that ends after closing", () => {
    const knotless = services.find((s) => s.slug === "knotless-braids")!;
    const minutes = getDurationMinutes({ service: knotless, variant: knotless.variants.find((v) => v.label === "Small")! });
    expect(minutes).toBe(180);
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: minutes }));
    expect(slots.at(-1)).toBe("17:00");
  });

  it("skips times that overlap an existing booking", () => {
    const slots = labels(
      getFreeStartTimes({ ...base, durationMinutes: 40, busy: [{ start: at("14:00"), end: at("14:40") }] }),
    );
    expect(slots).toContain("13:15"); // ends 13:55
    expect(slots).not.toContain("13:30"); // would end 14:10
    expect(slots).not.toContain("14:00");
    expect(slots).not.toContain("14:15");
    expect(slots).toContain("14:45");
  });

  it("removes time off", () => {
    const slots = labels(
      getFreeStartTimes({ ...base, durationMinutes: 30, busy: [{ start: at("12:00"), end: at("13:00") }] }),
    );
    expect(slots).not.toContain("12:00");
    expect(slots).not.toContain("11:45");
    expect(slots).toContain("13:00");
  });

  it("never shows past times or times within the 60-minute notice", () => {
    const slots = labels(getFreeStartTimes({ ...base, durationMinutes: 30, now: at("13:05") }));
    expect(slots[0]).toBe("14:15");
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

  it("seed gives each of the 4 staff 7 rows (28), no duplicates", () => {
    const rows = buildSeedRows().working_hours;
    expect(rows).toHaveLength(28);
    expect(new Set(rows.map((r) => `${r.staff_id}:${r.weekday}`)).size).toBe(28);
  });

  it("address has no unit number", () => {
    expect(buildSeedRows().settings[0].address).toBe("478 Rideau St, Ottawa, ON K1N 5Z4");
  });
});

describe("getDurationMinutes (spec 6.4)", () => {
  it("uses the men's cut minutes from the seed", () => {
    const cut = services.find((s) => s.slug === "haircut-beard-trim")!;
    expect(getDurationMinutes({ service: cut, variant: cut.variants[0] })).toBe(40);
  });

  it("size rule: 3h / 2h30 / 2h", () => {
    expect(["XMicro", "Micro", "XSmall", "Small"].map(sizeRuleMinutes)).toEqual([180, 180, 180, 180]);
    expect(["Smedium", "Medium"].map(sizeRuleMinutes)).toEqual([150, 150]);
    expect(["Large", "XLarge", "Jumbo", "2-4 cornrows", "5-6 lines", "More"].map(sizeRuleMinutes)).toEqual([
      120, 120, 120, 120, 120, 120,
    ]);
  });

  it("adds add-on extra minutes", () => {
    expect(
      getDurationMinutes({
        service: { baseDurationMinutes: 30 },
        variant: { label: "Standard", durationMinutes: null },
        addons: [{ extraMinutes: 15 }],
      }),
    ).toBe(45);
  });
});
