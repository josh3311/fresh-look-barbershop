// Change Request #2 (Oct 31), booking engine: durations, start-time grid per team,
// team routing, "Not working this day". Expected answers come from the change request
// (A2, A3, A4, A5) and the answer key, not from the code.
import { describe, expect, it } from "vitest";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getFreeStartTimes, slotMinutesForTeam, summarizeDay } from "@/lib/availability";
import { services, staff, type Service } from "@/lib/catalog";
import { getDurationMinutes } from "@/lib/duration";
import { buildSeedRows } from "@/lib/seed-rows";
import { computeAvailability, HttpError, loadEligibleStaff, loadSelection } from "@/lib/server/booking-context";
import { resolveStaffChoice, staffChoicesFor } from "@/components/booking/staff-choices";
import { fakeSupabase, seedTables } from "./helpers/fake-supabase";

const TZ = "America/Toronto";
const DAY = "2026-11-06"; // a Friday
const at = (hm: string, date = DAY) => fromZonedTime(`${date}T${hm}:00`, TZ);
const labels = (ds: Date[]) => ds.map((d) => formatInTimeZone(d, TZ, "HH:mm"));
const settings = buildSeedRows().settings[0];
const FAR_PAST = new Date("2026-10-01T12:00:00Z"); // fixed clock, weeks before DAY

const svc = (slug: string) => services.find((s) => s.slug === slug)!;
const person = (name: string) => staff.find((p) => p.name === name)!;
const minutes = (s: Service, label?: string) =>
  getDurationMinutes({ service: s, variant: label ? s.variants.find((v) => v.label === label)! : s.variants[0] });

/** Free starts for one service on a free 10:00-20:00 day, on its team's grid. */
function starts(s: Service, opts: { date?: string; now?: Date; busy?: { start: Date; end: Date }[]; label?: string } = {}) {
  return getFreeStartTimes({
    date: opts.date ?? DAY,
    durationMinutes: minutes(s, opts.label),
    working: [{ start: "10:00", end: "20:00" }],
    busy: opts.busy ?? [],
    now: opts.now ?? FAR_PAST,
    minNoticeMinutes: settings.min_notice_minutes,
    slotIntervalMinutes: slotMinutesForTeam(s.team, settings),
    timeZone: TZ,
  });
}

describe("A2/A3 getDurationMinutes", () => {
  it("T-201 barber blocks: Classic 35, Haircut & Beard 45, Kids 30, Beard 15, Outline 15", () => {
    const slugs = ["classic-haircut", "haircut-beard-trim", "kids", "beard", "outline"];
    expect(slugs.map((s) => minutes(svc(s)))).toEqual([35, 45, 30, 15, 15]);
  });

  it("T-202 every stylist service, every size = 60 (Knotless Small, XMicro, Simple Cornrows 2-4)", () => {
    expect(minutes(svc("knotless-braids"), "Small")).toBe(60);
    expect(minutes(svc("knotless-braids"), "XMicro")).toBe(60);
    expect(minutes(svc("simple-cornrows"), "2-4 cornrows")).toBe(60);
    const stylist = services.filter((s) => s.team === "stylist");
    expect(stylist).toHaveLength(37);
    for (const s of stylist) for (const v of s.variants) expect(minutes(s, v.label), `${s.slug} ${v.label}`).toBe(60);
  });

  it("fallback when the data has no minutes: stylist 60, barber is an error (never a guess)", () => {
    const none = { durationMinutes: null };
    expect(getDurationMinutes({ service: { baseDurationMinutes: null, team: "stylist" }, variant: none })).toBe(60);
    expect(() => getDurationMinutes({ service: { baseDurationMinutes: null, team: "barber" }, variant: none })).toThrow();
  });

  it("a size's own minutes win over the service minutes, then add-on minutes are added", () => {
    expect(
      getDurationMinutes({
        service: { baseDurationMinutes: 60, team: "stylist" },
        variant: { durationMinutes: 180 },
        addons: [{ extraMinutes: 15 }, { extraMinutes: 0 }],
      }),
    ).toBe(195);
  });
});

describe("A2 barber start times (every 5 min)", () => {
  it("T-203 free day, Classic: 10:00, 10:05, 10:10 ... in 5-minute steps", () => {
    const s = starts(svc("classic-haircut"));
    expect(labels(s).slice(0, 4)).toEqual(["10:00", "10:05", "10:10", "10:15"]);
    const steps = new Set(s.slice(1).map((t, i) => (t.getTime() - s[i].getTime()) / 60000));
    expect([...steps]).toEqual([5]);
  });

  it("T-204 Barber A busy 10:00-10:35 (Classic): first start 10:35, 10:30 not offered", () => {
    const s = labels(starts(svc("classic-haircut"), { busy: [{ start: at("10:00"), end: at("10:35") }] }));
    expect(s[0]).toBe("10:35");
    expect(s).not.toContain("10:30");
  });

  it("T-205 Classic (35 min): last start 19:25, 19:30 not offered", () => {
    const s = labels(starts(svc("classic-haircut")));
    expect(s.at(-1)).toBe("19:25");
    expect(s).not.toContain("19:30");
  });

  it("T-206 Haircut & Beard (45) last start 19:15; Beard (15) last start 19:45", () => {
    expect(labels(starts(svc("haircut-beard-trim"))).at(-1)).toBe("19:15");
    expect(labels(starts(svc("beard"))).at(-1)).toBe("19:45");
  });
});

describe("A3 stylist start times (on the hour)", () => {
  it("T-207 Stylist C busy 10:00-11:00: first start 11:00, every start on :00, last 19:00", () => {
    const s = labels(starts(svc("knotless-braids"), { label: "Small", busy: [{ start: at("10:00"), end: at("11:00") }] }));
    expect(s[0]).toBe("11:00");
    expect(s.every((x) => x.endsWith(":00"))).toBe(true);
    expect(s.at(-1)).toBe("19:00");
    expect(s).toEqual(["11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]);
  });

  it("grid counts from local midnight, not from the block start (10:10 block -> 11:00; 10:02 block -> 10:05)", () => {
    const base = { date: DAY, busy: [], now: FAR_PAST, minNoticeMinutes: 60, timeZone: TZ };
    const stylist = getFreeStartTimes({ ...base, durationMinutes: 60, slotIntervalMinutes: 60, working: [{ start: "10:10", end: "20:00" }] });
    expect(labels(stylist)[0]).toBe("11:00");
    const barber = getFreeStartTimes({ ...base, durationMinutes: 35, slotIntervalMinutes: 5, working: [{ start: "10:02:00", end: "20:00:00" }] });
    expect(labels(barber)[0]).toBe("10:05");
  });
});

describe("closing time, DST, notice", () => {
  it("T-208 for every one of the 42 services no start + block ends after 20:00", () => {
    expect(services).toHaveLength(42);
    for (const s of services) {
      for (const v of s.variants) {
        const list = starts(s, { label: v.label });
        expect(list.length, `${s.slug} ${v.label}`).toBeGreaterThan(0);
        const late = list.filter((t) => t.getTime() + minutes(s, v.label) * 60000 > at("20:00").getTime());
        expect(labels(late), `${s.slug} ${v.label}`).toEqual([]);
      }
    }
  });

  it("T-209 Sunday 2026-11-01 (clocks go back) opens 10:00 local = 15:00Z for barbers and stylists; Saturday 14:00Z", () => {
    const now = new Date("2026-10-30T12:00:00Z");
    expect(starts(svc("classic-haircut"), { date: "2026-11-01", now })[0].toISOString()).toBe("2026-11-01T15:00:00.000Z");
    expect(starts(svc("knotless-braids"), { date: "2026-11-01", now, label: "Small" })[0].toISOString()).toBe(
      "2026-11-01T15:00:00.000Z",
    );
    expect(starts(svc("classic-haircut"), { date: "2026-10-31", now })[0].toISOString()).toBe("2026-10-31T14:00:00.000Z");
  });

  it("T-210 notice: now 13:02 local -> first barber start 14:05, first stylist start 15:00", () => {
    const now = at("13:02");
    expect(labels(starts(svc("classic-haircut"), { now }))[0]).toBe("14:05");
    expect(labels(starts(svc("knotless-braids"), { now, label: "Small" }))[0]).toBe("15:00");
  });

  it("the grid comes from the settings rows: barber 5, stylist 60", () => {
    expect(slotMinutesForTeam("barber", settings)).toBe(5);
    expect(slotMinutesForTeam("stylist", settings)).toBe(60);
  });
});

describe("A4 who can do this service", () => {
  it("T-211 staff choices: Simple Cornrows (Men side) -> C, D; Classic -> A, B; Knotless -> C, D", () => {
    const names = (slug: string) => staffChoicesFor(svc(slug)).map((p) => p.name);
    expect(svc("simple-cornrows").side).toBe("men");
    expect(names("simple-cornrows")).toEqual(["Barber C", "Barber D"]);
    expect(names("classic-haircut")).toEqual(["Barber A", "Barber B"]);
    expect(names("knotless-braids")).toEqual(["Barber C", "Barber D"]);
  });

  it("a preselected person from the other team falls back to Anyone available", () => {
    expect(resolveStaffChoice(svc("simple-cornrows"), person("Barber A").id)).toBe("any");
    expect(resolveStaffChoice(svc("simple-cornrows"), person("Barber C").id)).toBe(person("Barber C").id);
    expect(resolveStaffChoice(svc("classic-haircut"), person("Barber D").id)).toBe("any");
    expect(resolveStaffChoice(svc("classic-haircut"), "any")).toBe("any");
  });

  it("T-212 server: Barber A for Simple Cornrows -> 400; a wrong staff_services row for A -> 'any' still gives only C, D", async () => {
    const cornrows = { id: svc("simple-cornrows").id, team: "stylist" as const };
    const tables = seedTables();
    const { db } = fakeSupabase(tables);
    const err = await loadEligibleStaff(db, cornrows, person("Barber A").id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);

    const barberA = tables.staff.find((p) => p.name === "Barber A")!;
    tables.staff_services.push({ staff_id: barberA.id, service_id: cornrows.id, staff: barberA }); // the old bug
    const anyone = await loadEligibleStaff(fakeSupabase(tables).db, cornrows, "any");
    expect(anyone.map((p) => p.name)).toEqual(["Barber C", "Barber D"]);
  });

  it("server reads team + both slot settings from the rows: Classic every 5 min, a braid on the hour", async () => {
    const tables = seedTables();
    const { db } = fakeSupabase(tables);
    const sel = async (slug: string, label?: string) => {
      const s = svc(slug);
      const v = label ? s.variants.find((x) => x.label === label)! : s.variants[0];
      return loadSelection(db, { serviceId: s.id, variantId: v.id, addonIds: [], staffId: "any" });
    };
    const classic = await sel("classic-haircut");
    expect([classic.team, classic.durationMinutes]).toEqual(["barber", 35]);
    const knotless = await sel("knotless-braids", "Small");
    expect([knotless.team, knotless.durationMinutes]).toEqual(["stylist", 60]);

    // Example A (barber) and Example B (stylist), through the database rows.
    const a = person("Barber A").id;
    const c = person("Barber C").id;
    tables.bookings.push(
      { staff_id: a, status: "booked", starts_at: at("10:00").toISOString(), ends_at: at("10:35").toISOString() },
      { staff_id: c, status: "booked", starts_at: at("10:00").toISOString(), ends_at: at("11:00").toISOString() },
    );
    const run = (s: typeof classic, staffId: string) =>
      computeAvailability(db, { staffIds: [staffId], fromDate: DAY, days: 1, durationMinutes: s.durationMinutes, settings: s.settings, team: s.team, now: FAR_PAST });
    expect(labels((await run(classic, a))[DAY][a]!).slice(0, 3)).toEqual(["10:35", "10:40", "10:45"]);
    expect(labels((await run(knotless, c))[DAY][c]!).slice(0, 2)).toEqual(["11:00", "12:00"]);
  });
});

describe("A5 not working this day", () => {
  const c = person("Barber C").id;
  const d = person("Barber D").id;
  const friday = 5;
  const withoutFriday = (...ids: string[]) => {
    const tables = seedTables();
    tables.working_hours = tables.working_hours.filter((h) => !(ids.includes(h.staff_id as string) && h.weekday === friday));
    return fakeSupabase(tables).db;
  };
  const run = (db: ReturnType<typeof withoutFriday>, staffIds: string[]) =>
    computeAvailability(db, { staffIds, fromDate: DAY, days: 1, durationMinutes: 60, settings, team: "stylist", now: FAR_PAST });

  it("T-214 one person with no working_hours that day: no slots and notWorking true", async () => {
    const byDate = await run(withoutFriday(c), [c]);
    expect(byDate[DAY][c]).toBeNull();
    expect(summarizeDay(DAY, byDate[DAY], TZ)).toEqual({ date: DAY, slots: [], notWorking: true });
  });

  it("T-214 'any': notWorking only when nobody on the team works that day", async () => {
    const oneOff = summarizeDay(DAY, (await run(withoutFriday(c), [c, d]))[DAY], TZ);
    expect(oneOff.notWorking).toBe(false);
    expect(oneOff.slots.map((s) => s.label)).toEqual(["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"]);

    const bothOff = summarizeDay(DAY, (await run(withoutFriday(c, d), [c, d]))[DAY], TZ);
    expect(bothOff).toEqual({ date: DAY, slots: [], notWorking: true });
  });

  it("a working day that is fully booked is not 'not working'", async () => {
    const tables = seedTables();
    tables.bookings.push({ staff_id: c, status: "booked", starts_at: at("10:00").toISOString(), ends_at: at("20:00").toISOString() });
    const byDate = await run(fakeSupabase(tables).db, [c]);
    expect(summarizeDay(DAY, byDate[DAY], TZ)).toEqual({ date: DAY, slots: [], notWorking: false });
  });
});
