import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const access = vi.hoisted(() => ({ current: { state: "anonymous" } as { state: string; email?: string } }));
const loadUpcomingBookings = vi.hoisted(() =>
  vi.fn<(staffId?: string) => Promise<{ bookings: StaffBooking[]; staff: StaffFilterPerson[] }>>(async () => ({ bookings: [], staff: [] })),
);

vi.mock("@/lib/server/staff-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/staff-auth")>()),
  getStaffAccess: async () => access.current,
}));
vi.mock("@/lib/server/staff-bookings", () => ({ loadUpcomingBookings }));
vi.mock("@/app/staff/actions", () => ({ signOut: async () => {}, cancelBooking: async () => {} }));
vi.mock("@/components/staff/CancelButton", () => ({ CancelButton: () => null }));

import StaffPage from "@/app/staff/page";
import { isStaffEmail, staffEmails } from "@/lib/server/staff-auth";
import type { StaffBooking, StaffFilterPerson } from "@/lib/server/staff-bookings";

const params = Promise.resolve({});

describe("/staff access", () => {
  beforeEach(() => loadUpcomingBookings.mockClear());

  it("redirects signed-out visitors to /staff/login and loads no bookings", async () => {
    access.current = { state: "anonymous" };
    const err = await StaffPage({ searchParams: params }).catch((e: { digest?: string }) => e);
    expect(String((err as { digest?: string }).digest)).toContain("/staff/login");
    expect(loadUpcomingBookings).not.toHaveBeenCalled();
  });

  it("blocks a signed-in user who is not on STAFF_EMAILS and loads no bookings", async () => {
    access.current = { state: "forbidden", email: "someone@example.com" };
    const html = renderToStaticMarkup(await StaffPage({ searchParams: params }));
    expect(html).toContain("not on the staff list");
    expect(loadUpcomingBookings).not.toHaveBeenCalled();
  });

  it("T-308 a forbidden user asking for a barber filter still loads nothing", async () => {
    access.current = { state: "forbidden", email: "someone@example.com" };
    const html = renderToStaticMarkup(
      await StaffPage({ searchParams: Promise.resolve({ staff: "00000000-0000-4000-8000-000000000001" }) }),
    );
    expect(html).toContain("not on the staff list");
    expect(html).not.toContain("TEST-");
    expect(loadUpcomingBookings).not.toHaveBeenCalled();
  });

  it("A7 staff see bookings by day, a barber/stylist filter, tap-to-call and text links", async () => {
    access.current = { state: "staff", email: "aubin@example.com" };
    const C = "00000000-0000-4000-8000-00000000000c";
    loadUpcomingBookings.mockResolvedValueOnce({
      staff: [
        { id: "00000000-0000-4000-8000-00000000000a", name: "Barber A", team: "barber" },
        { id: C, name: "Barber C", team: "stylist" },
      ],
      bookings: [
        testBooking("b1", "2026-11-06T15:00:00.000Z", "2026-11-06", "Barber A"),
        testBooking("b2", "2026-11-06T17:00:00.000Z", "2026-11-06", "Barber A"),
        testBooking("b3", "2026-11-07T15:00:00.000Z", "2026-11-07", "Barber C"),
      ],
    });
    const html = renderToStaticMarkup(await StaffPage({ searchParams: Promise.resolve({ staff: C }) }));
    expect(loadUpcomingBookings).toHaveBeenCalledWith(C);
    expect(html.match(/<section/g)).toHaveLength(2); // two days
    expect(html).toContain("Friday, Nov 6");
    expect(html).toContain("Saturday, Nov 7");
    expect(html).toContain('href="tel:+16135550199"');
    expect(html).toContain('href="sms:+16135550199"');
    expect(html).toContain("Filter by barber or stylist");
    expect(html).toContain('Barber A<span class="font-normal"> · Barber</span>');
    expect(html).toContain('Barber C<span class="font-normal"> · Hairstylist</span>');
    const current = html.match(/<a [^>]*aria-current="page"[^>]*>/g) ?? [];
    expect(current).toHaveLength(1);
    expect(current[0]).toContain(`href="/staff?staff=${C}"`);
  });

  it("A7 a filter that is not a staff id is ignored (no injection into the query)", async () => {
    access.current = { state: "staff", email: "aubin@example.com" };
    await StaffPage({ searchParams: Promise.resolve({ staff: "' or 1=1 --" }) });
    expect(loadUpcomingBookings).toHaveBeenCalledWith(undefined);
  });

  it("shows bookings to staff", async () => {
    access.current = { state: "staff", email: "aubin@example.com" };
    const html = renderToStaticMarkup(await StaffPage({ searchParams: params }));
    expect(loadUpcomingBookings).toHaveBeenCalledOnce();
    expect(html).toContain("No upcoming bookings");
  });

  it("STAFF_EMAILS: case-insensitive, comma or space separated, empty = nobody", () => {
    const raw = " Aubin@Example.com, barber.a@example.com  barber.b@example.com ";
    expect(staffEmails(raw).size).toBe(3);
    expect(isStaffEmail("aubin@example.com", raw)).toBe(true);
    expect(isStaffEmail("AUBIN@EXAMPLE.COM", raw)).toBe(true);
    expect(isStaffEmail("intruder@example.com", raw)).toBe(false);
    expect(isStaffEmail("aubin@example.com", "")).toBe(false);
    expect(isStaffEmail("aubin@example.com", undefined)).toBe(false);
    expect(isStaffEmail(null, raw)).toBe(false);
  });
});

function testBooking(id: string, startsAt: string, date: string, staffName: string): StaffBooking {
  return {
    id,
    startsAt: new Date(startsAt),
    endsAt: new Date(new Date(startsAt).getTime() + 35 * 60_000),
    date,
    staffId: "x",
    staffName,
    service: "Classic Haircut",
    addons: [],
    customerName: "TEST-Customer Name",
    customerPhone: "+16135550199",
    customerEmail: "test-customer@example.com",
    notes: null,
  };
}
