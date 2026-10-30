import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

// Database reads (settings, service, staff, availability) are stubbed; the bookings
// table is a tiny in-memory fake so we can see the insert happen.
vi.mock("@/lib/server/booking-context", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server/booking-context")>();
  const start = new Date("2026-11-06T15:00:00.000Z");
  return {
    ...real,
    loadSelection: vi.fn(async () => ({
      settings: { timezone: "America/Toronto", slot_interval_minutes: 15, min_notice_minutes: 60, max_days_ahead: 60, extra_length_price_cents: 1500 },
      service: { id: "svc", side: "men", name_en: "Classic Haircut", base_duration_minutes: 30, length_based: false, is_active: true },
      variant: { id: "var", service_id: "svc", label: "Standard", price_cents: 2500, is_consult: false, duration_minutes: null },
      addons: [],
      durationMinutes: 30,
    })),
    loadEligibleStaff: vi.fn(async () => [{ id: "staff-a", name: "Barber A", is_active: true, sort_order: 0 }]),
    computeAvailability: vi.fn(async () => ({ "2026-11-06": { "staff-a": [start] } })),
  };
});

import { createBooking } from "@/lib/server/create-booking";
import { buildSalonEmail, sendBookingEmails, type BookingSummary } from "@/lib/server/email";

function fakeDb() {
  const inserted: Record<string, unknown>[] = [];
  const db = {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => Promise.resolve({ count: 0, error: null }),
        insert: (row: Record<string, unknown>) => {
          inserted.push(row);
          return { select: () => ({ single: async () => ({ data: { id: "11111111-1111-4111-8111-111111111111" }, error: null }) }) };
        },
      };
      return chain;
    },
  };
  return { db: db as unknown as SupabaseClient, inserted };
}

const body = {
  serviceId: "ebd617ad-57b2-5c4f-95f5-b9bd856d7320",
  variantId: "904ef66f-b8af-5664-8936-0166f25f3129",
  staffId: "any",
  startsAt: "2026-11-06T15:00:00.000Z",
  name: "TEST-Customer Name",
  phone: "613 555 0199",
  email: "TEST-customer@example.com",
};
const PII = ["TEST-Customer Name", "test-customer@example.com", "6135550199", "613 555 0199"];

describe("booking + emails", () => {
  let errors: string[];
  beforeEach(() => {
    errors = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("booking succeeds when the email sender throws, and the log has no customer details", async () => {
    const { db, inserted } = fakeDb();
    const res = await createBooking(db, body, async () => {
      throw new Error("Resend 500 internal_server_error");
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ customer_phone: "+16135550199", customer_email: "test-customer@example.com" });
    expect(errors.join("\n")).toContain("11111111-1111-4111-8111-111111111111");
    for (const p of PII) expect(errors.join("\n")).not.toContain(p);
  });

  it("booking succeeds when Resend itself fails (real sender, network error)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_dummy");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("getaddrinfo ENOTFOUND api.resend.com"); }));
    const { db, inserted } = fakeDb();
    const res = await createBooking(db, body);
    expect(res.status).toBe(201);
    expect(inserted).toHaveLength(1);
    expect(errors.filter((e) => e.includes("[email]"))).toHaveLength(2); // salon + customer
    for (const p of PII) expect(errors.join("\n")).not.toContain(p);
  });

  it("booking succeeds when RESEND_API_KEY is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { db } = fakeDb();
    expect((await createBooking(db, body)).status).toBe(201);
  });

  it("Resend error responses are logged as status + name only", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_dummy");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ name: "validation_error", message: "Invalid `to` field: TEST-customer@example.com" }), { status: 422 }),
      ),
    );
    const summary = makeSummary();
    const r = await sendBookingEmails(summary);
    expect(r).toEqual({ salon: false, customer: false });
    expect(errors.join("\n")).toContain("Resend 422 validation_error");
    expect(errors.join("\n")).not.toContain("example.com");
  });

  it("sends salon + customer emails with the right subject and details", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_dummy");
    vi.stubEnv("SALON_NOTIFY_EMAIL", "");
    const calls: { to: string[]; subject: string; text: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: "x" }), { status: 200 });
      }),
    );
    expect(await sendBookingEmails(makeSummary())).toEqual({ salon: true, customer: true });
    const [salon, customer] = calls;
    expect(salon.to).toEqual(["freshlook.Ottawa@gmail.com"]);
    expect(salon.subject).toBe("New booking: Classic Haircut with Barber A on Sat Oct 31, 2:00 PM");
    for (const s of ["TEST-Customer Name", "(613) 555-0199", "test-customer@example.com", "Classic Haircut", "Beard line", "Barber A", "$25", "11111111-1111-4111-8111-111111111111"]) {
      expect(salon.text).toContain(s);
    }
    expect(customer.to).toEqual(["test-customer@example.com"]);
    expect(customer.text).toContain("478 Rideau St, Ottawa, ON K1N 5Z4");
    expect(customer.text).toContain("You pay at the salon");
    expect(customer.text.toLowerCase()).not.toMatch(/card|deposit required/);
  });

  it("SALON_NOTIFY_EMAIL overrides the default", () => {
    vi.stubEnv("SALON_NOTIFY_EMAIL", "owner@example.com");
    expect(buildSalonEmail(makeSummary()).to).toBe("owner@example.com");
  });
});

function makeSummary(): BookingSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    customerName: "TEST-Customer Name",
    customerPhone: "+16135550199",
    customerEmail: "test-customer@example.com",
    serviceName: "Classic Haircut",
    variantLabel: null,
    lengthLabel: null,
    addons: ["Beard line"],
    staffName: "Barber A",
    startsAt: new Date("2026-10-31T18:00:00.000Z"), // 2:00 PM in Ottawa (EDT)
    estimate: { cents: 2500, isFrom: false, hasConsult: false, askInSalon: false },
    notes: null,
  };
}
