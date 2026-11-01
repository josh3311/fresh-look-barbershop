// Change Request #2 (Oct 31): POST /api/bookings logic with the REAL booking-context
// (loadSelection, loadEligibleStaff, computeAvailability) over an in-memory database
// built from the seed rows. TEST- customer data only; emails are a no-op here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services, staff } from "@/lib/catalog";
import { createBooking } from "@/lib/server/create-booking";
import { fakeSupabase, seedTables } from "./helpers/fake-supabase";

const svc = (slug: string) => services.find((s) => s.slug === slug)!;
const person = (name: string) => staff.find((p) => p.name === name)!;
const noEmail = async () => undefined;

const customer = {
  name: "TEST-Customer Name",
  phone: "613 555 0199",
  email: "TEST-customer@example.com",
};
const FRIDAY_10AM = "2026-11-06T15:00:00.000Z"; // 10:00 in Ottawa (EST)

describe("createBooking (CR2 A1, A4)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z")); // fixed clock: Monday before
  });
  afterEach(() => vi.useRealTimers());

  it("T-213 'Anyone available' for a stylist service books a stylist, never a barber (even with a wrong staff_services row)", async () => {
    const tables = seedTables();
    const cornrows = svc("simple-cornrows");
    const barberA = tables.staff.find((p) => p.name === "Noël")!;
    // The old bug: Noël (first in display order, and free) mapped to a stylist service.
    tables.staff_services.push({ staff_id: barberA.id, service_id: cornrows.id, staff: barberA });
    const { db, inserted } = fakeSupabase(tables);

    const res = await createBooking(
      db,
      { serviceId: cornrows.id, variantId: cornrows.variants[0].id, staffId: "any", startsAt: FRIDAY_10AM, ...customer },
      noEmail,
    );
    expect(res.status).toBe(201);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].row.staff_id).toBe(person("Reine").id);
    const team = staff.find((p) => p.id === inserted[0].row.staff_id)!.team;
    expect(team).toBe("stylist");
  });

  it("T-213 'Anyone available' skips a busy stylist and takes the next stylist, not a free barber", async () => {
    const tables = seedTables();
    const cornrows = svc("simple-cornrows");
    const barberA = tables.staff.find((p) => p.name === "Noël")!;
    tables.staff_services.push({ staff_id: barberA.id, service_id: cornrows.id, staff: barberA });
    tables.bookings.push({
      staff_id: person("Reine").id,
      status: "booked",
      starts_at: FRIDAY_10AM,
      ends_at: "2026-11-06T16:00:00.000Z",
      customer_name: "TEST-Other",
    });
    const { db, inserted } = fakeSupabase(tables);
    const res = await createBooking(
      db,
      { serviceId: cornrows.id, variantId: cornrows.variants[0].id, staffId: "any", startsAt: FRIDAY_10AM, ...customer },
      noEmail,
    );
    expect(res.status).toBe(201);
    expect(inserted.map((i) => i.row.staff_id)).toEqual([person("Olga").id]);
  });

  it("a barber picked by id for a stylist service is refused (400), nothing inserted", async () => {
    const { db, inserted } = fakeSupabase(seedTables());
    const cornrows = svc("simple-cornrows");
    const res = await createBooking(
      db,
      { serviceId: cornrows.id, variantId: cornrows.variants[0].id, staffId: person("Noël").id, startsAt: FRIDAY_10AM, ...customer },
      noEmail,
    );
    expect(res.status).toBe(400);
    expect(inserted).toHaveLength(0);
  });

  it("T-215 tampered price is ignored: price_estimate_cents 1 / priceCents 1 for Classic -> inserted 3000", async () => {
    const { db, inserted } = fakeSupabase(seedTables());
    const classic = svc("classic-haircut");
    const res = await createBooking(
      db,
      {
        serviceId: classic.id,
        variantId: classic.variants[0].id,
        staffId: person("Noël").id,
        startsAt: FRIDAY_10AM,
        price_estimate_cents: 1,
        priceCents: 1,
        ...customer,
      },
      noEmail,
    );
    expect(res.status).toBe(201);
    expect(inserted[0].row.price_estimate_cents).toBe(3000);
  });

  it("a Classic blocks 35 min: the inserted booking ends 10:35", async () => {
    const { db, inserted } = fakeSupabase(seedTables());
    const classic = svc("classic-haircut");
    await createBooking(
      db,
      { serviceId: classic.id, variantId: classic.variants[0].id, staffId: person("Noël").id, startsAt: FRIDAY_10AM, ...customer },
      noEmail,
    );
    expect(inserted[0].row.ends_at).toBe("2026-11-06T15:35:00.000Z");
  });

  it("a start time off the 5-minute barber grid is refused (409)", async () => {
    const { db, inserted } = fakeSupabase(seedTables());
    const classic = svc("classic-haircut");
    const res = await createBooking(
      db,
      { serviceId: classic.id, variantId: classic.variants[0].id, staffId: "any", startsAt: "2026-11-06T15:02:00.000Z", ...customer },
      noEmail,
    );
    expect(res.status).toBe(409);
    expect(inserted).toHaveLength(0);
  });
});
