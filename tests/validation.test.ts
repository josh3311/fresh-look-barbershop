import { describe, expect, it } from "vitest";
import { normalizePhone, formatPhone } from "@/lib/phone";
import { BookingBody } from "@/lib/booking-schema";

describe("normalizePhone (Canadian numbers -> +1XXXXXXXXXX)", () => {
  it.each([
    ["(613) 555-0199", "+16135550199"],
    ["613-555-0199", "+16135550199"],
    ["613.555.0199", "+16135550199"],
    ["6135550199", "+16135550199"],
    ["+1 613 555 0199", "+16135550199"],
    ["1-613-555-0199", "+16135550199"],
    ["(418) 255-2571", "+14182552571"],
    ["  514 555 0100  ", "+15145550100"],
  ])("%s -> %s", (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });

  it.each([
    ["555-0199", "too short"],
    ["+44 20 7946 0958", "not North American"],
    ["2-613-555-0199", "11 digits not starting with 1"],
    ["(013) 555-0199", "area code starts with 0"],
    ["(613) 155-0199", "exchange starts with 1"],
    ["613-555-019a", "letters"],
    ["", "empty"],
  ])("rejects %s (%s)", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("formats for display", () => {
    expect(formatPhone("+16135550199")).toBe("(613) 555-0199");
  });
});

const valid = {
  serviceId: "ebd617ad-57b2-5c4f-95f5-b9bd856d7320",
  variantId: "904ef66f-b8af-5664-8936-0166f25f3129",
  staffId: "any",
  startsAt: "2026-11-06T15:00:00.000Z",
  name: "TEST-customer",
  phone: "(613) 555-0199",
  email: "Test.Customer@Example.com",
};

describe("BookingBody (server-side Zod)", () => {
  it("stores the phone normalized and the email lower-cased", () => {
    const r = BookingBody.parse(valid);
    expect(r.phone).toBe("+16135550199");
    expect(r.email).toBe("test.customer@example.com");
  });

  it.each(["not-an-email", "a@b", "a b@c.com", "@example.com", "name@", ""])("rejects email %j", (email) => {
    const r = BookingBody.safeParse({ ...valid, email });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => i.path[0] === "email")).toBe(true);
  });

  it("requires phone and email", () => {
    const rest = Object.fromEntries(Object.entries(valid).filter(([k]) => k !== "phone" && k !== "email"));
    const r = BookingBody.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(["email", "phone"]);
  });

  it("rejects a non-Canadian phone with the phone message", () => {
    const r = BookingBody.safeParse({ ...valid, phone: "+44 20 7946 0958" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe("phone");
  });

  it("keeps the honeypot: a filled hidden field is rejected", () => {
    expect(BookingBody.safeParse({ ...valid, website: "http://spam" }).success).toBe(false);
  });
});
