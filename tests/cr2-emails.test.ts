// Change Request #2 (A6): three emails after a booking is saved (salon copy, customer
// confirmation, the chosen/assigned barber or stylist). Fixed clock, TEST- data only.
// Resend is never called for real: `fetch` is stubbed and every call is recorded.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { services, staff } from "@/lib/catalog";
import { createBooking } from "@/lib/server/create-booking";
import { sendBookingEmails, type BookingSummary } from "@/lib/server/email";
import { fakeSupabase, seedTables, type FakeTables } from "./helpers/fake-supabase";

const svc = (slug: string) => services.find((s) => s.slug === slug)!;
const person = (name: string) => staff.find((p) => p.name === name)!;

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const STAFF_A_EMAIL = "test-barber-a@example.com";
const STAFF_C_EMAIL = "test-barber-c@example.com";
const customer = {
  name: "TEST-Customer Name",
  phone: "613 555 0199",
  email: "TEST-customer@example.com",
  notes: "TEST-note gate code 4321",
};
const FRIDAY_10AM = "2026-11-06T15:00:00.000Z"; // 10:00 in Ottawa (EST)

interface Sent {
  to: string[];
  subject: string;
  text: string;
  html: string;
}

let calls: Sent[];
let errors: string[];
let warnings: string[];

function okFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ id: "x" }), { status: 200 });
    }),
  );
}

function summary(over: Partial<BookingSummary> = {}): BookingSummary {
  return {
    id: BOOKING_ID,
    customerName: "TEST-Customer Name",
    customerPhone: "+16135550199",
    customerEmail: "test-customer@example.com",
    serviceName: "Classic Haircut",
    variantLabel: null,
    lengthLabel: null,
    addons: [],
    staffName: "Noël",
    staffEmail: STAFF_A_EMAIL,
    startsAt: new Date("2026-10-31T18:00:00.000Z"), // Sat Oct 31, 2:00 PM in Ottawa (EDT)
    estimate: { cents: 3000, isFrom: false, hasConsult: false, askInSalon: false },
    notes: null,
    ...over,
  };
}

/** Seed tables with TEST staff addresses (never the .invalid placeholders unless asked). */
function tablesWithTestEmails(): FakeTables {
  const tables = seedTables();
  for (const p of tables.staff) {
    if (p.name === "Noël") p.email = STAFF_A_EMAIL;
    if (p.name === "Reine") p.email = STAFF_C_EMAIL;
  }
  return tables;
}

const sentTo = (addr: string) => calls.filter((c) => c.to.includes(addr));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T12:00:00Z")); // fixed clock
  calls = [];
  errors = [];
  warnings = [];
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => void errors.push(a.map(String).join(" ")));
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => void warnings.push(a.map(String).join(" ")));
  vi.stubEnv("RESEND_API_KEY", "re_test_dummy");
  vi.stubEnv("SALON_NOTIFY_EMAIL", "");
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("CR2 A6 emails", () => {
  it("T-301 customer confirmation: service, person, date, time, price, address, Pay in salon, no card", async () => {
    okFetch();
    await sendBookingEmails(summary());
    const [mail] = sentTo("test-customer@example.com");
    expect(mail).toBeDefined();
    expect(mail.to).toEqual(["test-customer@example.com"]);
    for (const s of ["Classic Haircut", "Noël", "Sat Oct 31", "2:00 PM", "$30", "478 Rideau St, Ottawa, ON K1N 5Z4", "Pay in salon", "No deposit"]) {
      expect(mail.text).toContain(s);
    }
    expect(mail.text).not.toMatch(/card/i);
    expect(mail.html).not.toMatch(/card/i);
    expect(mail.html).not.toMatch(/https?:\/\/[^"]*(pay|checkout|stripe)/i);
  });

  it("T-302 staff email: customer name, phone, email, service, date and time; subject has service + when", async () => {
    okFetch();
    await sendBookingEmails(summary({ variantLabel: "Medium", lengthLabel: "Waist", serviceName: "Knotless Braids" }));
    const [mail] = sentTo(STAFF_A_EMAIL);
    expect(mail).toBeDefined();
    expect(mail.to).toEqual([STAFF_A_EMAIL]);
    for (const s of ["TEST-Customer Name", "(613) 555-0199", "test-customer@example.com", "Knotless Braids · Medium · Waist", "Sat Oct 31", "2:00 PM"]) {
      expect(mail.text).toContain(s);
    }
    expect(mail.subject).toContain("Knotless Braids");
    expect(mail.subject).toContain("Sat Oct 31, 2:00 PM");
    expect(mail.subject).toBe("New booking: Knotless Braids on Sat Oct 31, 2:00 PM");
  });

  it("T-303 'Anyone available' for a stylist service assigns Reine and emails Reine", async () => {
    okFetch();
    const { db, inserted } = fakeSupabase(tablesWithTestEmails());
    const cornrows = svc("simple-cornrows");
    const res = await createBooking(db, {
      serviceId: cornrows.id,
      variantId: cornrows.variants[0].id,
      staffId: "any",
      startsAt: FRIDAY_10AM,
      ...customer,
    });
    expect(res.status).toBe(201);
    expect(inserted[0].row.staff_id).toBe(person("Reine").id);
    const mails = sentTo(STAFF_C_EMAIL);
    expect(mails).toHaveLength(1);
    expect(mails[0].text).toContain("Simple Cornrows");
    expect(mails[0].subject).toContain("Fri Nov 6, 10:00 AM");
    expect(sentTo(STAFF_A_EMAIL)).toHaveLength(0);
    expect(calls).toHaveLength(3); // salon + customer + Reine
  });

  it("T-304 a .invalid staff address is never sent to Resend; salon + customer still go out; log has id, not the address", async () => {
    okFetch();
    const { db } = fakeSupabase(seedTables()); // seed = barber.a@example.invalid placeholders
    const classic = svc("classic-haircut");
    const res = await createBooking(db, {
      serviceId: classic.id,
      variantId: classic.variants[0].id,
      staffId: person("Noël").id,
      startsAt: FRIDAY_10AM,
      ...customer,
    });
    expect(res.status).toBe(201);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(calls.flatMap((c) => c.to)).toEqual(["freshlook.Ottawa@gmail.com", "test-customer@example.com"]);
    const log = [...warnings, ...errors].join("\n");
    expect(log).toContain(`skipped placeholder staff email for booking ${res.body.id}`);
    expect(log).not.toContain("example.invalid");
    expect(log).not.toContain("barber.a@");
  });

  it("T-304b the same skip rule protects the salon and customer sends", async () => {
    okFetch();
    vi.stubEnv("SALON_NOTIFY_EMAIL", "salon@example.invalid");
    const r = await sendBookingEmails(summary({ customerEmail: "someone@test.invalid", staffEmail: "x@example.invalid" }));
    expect(r).toEqual({ salon: "skipped", customer: "skipped", staff: "skipped" });
    expect(fetch).not.toHaveBeenCalled();
    expect(warnings.join("\n")).not.toContain(".invalid");
  });

  it("T-305 salon copy goes to freshlook.Ottawa@gmail.com by default", async () => {
    okFetch();
    await sendBookingEmails(summary());
    const [salon] = sentTo("freshlook.Ottawa@gmail.com");
    expect(salon).toBeDefined();
    for (const s of ["TEST-Customer Name", "(613) 555-0199", "test-customer@example.com", "Classic Haircut", "Noël", "$30", BOOKING_ID]) {
      expect(salon.text).toContain(s);
    }
  });

  it("T-305 salon copy goes to SALON_NOTIFY_EMAIL when set", async () => {
    okFetch();
    vi.stubEnv("SALON_NOTIFY_EMAIL", "test-owner@example.com");
    await sendBookingEmails(summary());
    expect(sentTo("test-owner@example.com")).toHaveLength(1);
    expect(sentTo("freshlook.Ottawa@gmail.com")).toHaveLength(0);
  });

  it("T-306 every email failing: booking is 201 and saved; errors name the booking id and no customer or staff details", async () => {
    // The rejection message itself carries addresses: only a reason code may be logged.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error(`connect failed for test-customer@example.com / ${STAFF_A_EMAIL}`);
      }),
    );
    const { db, inserted } = fakeSupabase(tablesWithTestEmails());
    const classic = svc("classic-haircut");
    const res = await createBooking(db, {
      serviceId: classic.id,
      variantId: classic.variants[0].id,
      staffId: person("Noël").id,
      startsAt: FRIDAY_10AM,
      ...customer,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].row).toMatchObject({ customer_name: "TEST-Customer Name", customer_phone: "+16135550199" });
    expect(fetch).toHaveBeenCalledTimes(3);
    const log = errors.join("\n");
    expect(errors.filter((e) => e.includes(res.body.id!))).toHaveLength(3); // salon, customer, staff
    for (const p of [
      "TEST-Customer Name",
      "6135550199",
      "613 555 0199",
      "555-0199",
      "test-customer@example.com",
      "TEST-customer@example.com",
      "TEST-note",
      "gate code",
      STAFF_A_EMAIL,
      "@",
    ]) {
      expect(log).not.toContain(p);
    }
  });

  it("T-307 the staff email lookup erroring: booking still 201, salon + customer still sent", async () => {
    okFetch();
    const { db: inner } = fakeSupabase(tablesWithTestEmails());
    const failing = {
      from(table: string) {
        if (table !== "staff") return inner.from(table);
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: null, error: { message: "permission denied for column email", code: "42501" } }),
          single: async () => ({ data: null, error: { message: "permission denied for column email", code: "42501" } }),
        };
        return q;
      },
    } as unknown as SupabaseClient;
    const classic = svc("classic-haircut");
    const res = await createBooking(failing, {
      serviceId: classic.id,
      variantId: classic.variants[0].id,
      staffId: person("Noël").id,
      startsAt: FRIDAY_10AM,
      ...customer,
    });
    expect(res.status).toBe(201);
    expect(calls.flatMap((c) => c.to)).toEqual(["freshlook.Ottawa@gmail.com", "test-customer@example.com"]);
    expect([...errors, ...warnings].join("\n")).toContain(`staff email lookup failed for booking ${res.body.id}`);
  });

  it("T-307b the staff email lookup throwing: booking still 201, salon + customer still sent", async () => {
    okFetch();
    const { db: inner } = fakeSupabase(tablesWithTestEmails());
    const throwing = {
      from(table: string) {
        if (table === "staff") throw new Error("socket hang up");
        return inner.from(table);
      },
    } as unknown as SupabaseClient;
    const classic = svc("classic-haircut");
    const res = await createBooking(throwing, {
      serviceId: classic.id,
      variantId: classic.variants[0].id,
      staffId: person("Noël").id,
      startsAt: FRIDAY_10AM,
      ...customer,
    });
    expect(res.status).toBe(201);
    expect(calls).toHaveLength(2);
  });
});
