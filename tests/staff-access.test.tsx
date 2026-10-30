import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const access = vi.hoisted(() => ({ current: { state: "anonymous" } as { state: string; email?: string } }));
const loadUpcomingBookings = vi.hoisted(() => vi.fn(async () => ({ bookings: [], staff: [] })));

vi.mock("@/lib/server/staff-auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/staff-auth")>()),
  getStaffAccess: async () => access.current,
}));
vi.mock("@/lib/server/staff-bookings", () => ({ loadUpcomingBookings }));
vi.mock("@/app/staff/actions", () => ({ signOut: async () => {}, cancelBooking: async () => {} }));
vi.mock("@/components/staff/CancelButton", () => ({ CancelButton: () => null }));

import StaffPage from "@/app/staff/page";
import { isStaffEmail, staffEmails } from "@/lib/server/staff-auth";

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
