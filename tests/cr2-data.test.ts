// Change Request #2 (Oct 31), data layer: prices, booking blocks, teams, routing, staff emails.
// Expected answers come from the change request, not from the code.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { services, staff, staffFor, staffForTeam } from "@/lib/catalog";
import { buildSeedRows, PLACEHOLDER_STAFF_EMAILS } from "@/lib/seed-rows";

const ROOT = join(__dirname, "..");
const BARBER_SLUGS = ["classic-haircut", "haircut-beard-trim", "kids", "beard", "outline"];

/** buildSeedRows() before CR2 (commit a896f5f), frozen. */
const before = JSON.parse(readFileSync(join(__dirname, "fixtures/pre-cr2-seed-rows.json"), "utf8")) as {
  services: { id: string; slug: string; base_duration_minutes: number | null }[];
  service_variants: { id: string; service_id: string; label: string; price_cents: number | null }[];
  service_addons: { id: string; price_cents: number | null }[];
};

const svc = (slug: string) => services.find((s) => s.slug === slug)!;
const byName = (name: string) => staff.find((p) => p.name === name)!;

describe("A1 prices (cents)", () => {
  it("T-101 Classic Haircut Standard = 3000", () => {
    const v = svc("classic-haircut").variants;
    expect(v.map((x) => [x.label, x.priceCents])).toEqual([["Standard", 3000]]);
  });

  it("T-102 Haircut & Beard Trim Standard = 3500", () => {
    const v = svc("haircut-beard-trim").variants;
    expect(v.map((x) => [x.label, x.priceCents])).toEqual([["Standard", 3500]]);
  });

  it("T-103 every other price (sizes and add-ons) is exactly what it was before CR2", () => {
    const changed = new Set([svc("classic-haircut").variants[0].id, svc("haircut-beard-trim").variants[0].id]);
    // Hair Color (Aubin, Nov 1) added 8 new sizes after CR2; they are checked in T-402
    // (tests/hair-color.test.tsx). Every size that existed before CR2 is compared here.
    const hairColor = new Set(svc("hair-color").variants.map((v) => v.id));
    const all = buildSeedRows();
    const now = { ...all, service_variants: all.service_variants.filter((v) => !hairColor.has(v.id)) };

    const oldVariants = new Map(before.service_variants.map((v) => [v.id, v.price_cents]));
    expect(now.service_variants.map((v) => v.id).sort()).toEqual([...oldVariants.keys()].sort());
    const diffs = now.service_variants.filter((v) => v.price_cents !== oldVariants.get(v.id)).map((v) => v.id);
    expect(diffs.sort()).toEqual([...changed].sort());

    const oldAddons = new Map(before.service_addons.map((a) => [a.id, a.price_cents]));
    expect(now.service_addons.map((a) => a.id).sort()).toEqual([...oldAddons.keys()].sort());
    for (const a of now.service_addons) expect(a.price_cents, a.id).toBe(oldAddons.get(a.id));

    // Kids, Beard, Outline unchanged.
    expect(["kids", "beard", "outline"].map((s) => svc(s).variants[0].priceCents)).toEqual([2500, 2000, 2000]);
    // The old snapshot really had the old prices (guards against a stale fixture).
    const oldPrice = (slug: string) =>
      before.service_variants.find((v) => v.service_id === before.services.find((s) => s.slug === slug)!.id)!.price_cents;
    expect([oldPrice("classic-haircut"), oldPrice("haircut-beard-trim")]).toEqual([2500, 3000]);
  });
});

describe("A2/A3 booking blocks (minutes, as data)", () => {
  it("T-104 barber services: Classic 35, Haircut & Beard 45, Kids 30, Beard 15, Outline 15", () => {
    expect(BARBER_SLUGS.map((s) => svc(s).baseDurationMinutes)).toEqual([35, 45, 30, 15, 15]);
  });

  it("T-105 all 37 stylist services block 60 min, and no size overrides it", () => {
    const stylist = services.filter((s) => s.team === "stylist");
    expect(stylist).toHaveLength(37);
    for (const s of stylist) {
      expect(s.baseDurationMinutes, s.slug).toBe(60);
      for (const v of s.variants) expect(v.durationMinutes, `${s.slug} ${v.label}`).toBeNull();
    }
  });
});

describe("teams", () => {
  // Hair Color (Aubin, Nov 1): 6 barber services, 43 total (was 5 / 42).
  it("T-106 6 barber services (5 cuts + Hair Color), 37 stylist services, 43 total; Locs Installation still absent", () => {
    expect(services).toHaveLength(43);
    expect(services.filter((s) => s.team === "barber").map((s) => s.slug)).toEqual([...BARBER_SLUGS, "hair-color"]);
    expect(services.filter((s) => s.team === "stylist")).toHaveLength(37);
    expect(services.some((s) => /locs installation/i.test(s.nameEn))).toBe(false);
    // The men's braid styles are stylist services but stay on the Men page.
    for (const slug of ["simple-cornrows", "stitch-cornrows", "barrel-twists", "locs-re-twist"]) {
      expect([svc(slug).side, svc(slug).team], slug).toEqual(["men", "stylist"]);
    }
    expect(services.filter((s) => s.side === "women").every((s) => s.team === "stylist")).toBe(true);
  });

  // Roster (Nov 1): 4 barbers, 2 stylists (was Barber A, B / Barber C, D).
  it("T-107 staff teams: Noël, Jackson, Joshua, Duckel barbers; Reine, Olga stylists", () => {
    expect(staff.map((p) => [p.name, p.side, p.team])).toEqual([
      ["Noël", "men", "barber"],
      ["Jackson", "men", "barber"],
      ["Joshua", "men", "barber"],
      ["Duckel", "men", "barber"],
      ["Reine", "women", "stylist"],
      ["Olga", "women", "stylist"],
    ]);
    expect(staffForTeam("barber").map((p) => p.name)).toEqual(["Noël", "Jackson", "Joshua", "Duckel"]);
    expect(staffForTeam("stylist").map((p) => p.name)).toEqual(["Reine", "Olga"]);
    // staffFor(side) still drives the Men / Women pages.
    expect(staffFor("men").map((p) => p.name)).toEqual(["Noël", "Jackson", "Joshua", "Duckel"]);
    expect(staffFor("women").map((p) => p.name)).toEqual(["Reine", "Olga"]);
  });
});

describe("A4 routing: staff_services from the seed", () => {
  const rows = buildSeedRows();
  const slugOf = new Map(rows.services.map((s) => [s.id, s.slug]));
  const nameOf = new Map(rows.staff.map((p) => [p.id, p.name]));
  const servicesOf = (name: string) =>
    rows.staff_services.filter((r) => nameOf.get(r.staff_id) === name).map((r) => slugOf.get(r.service_id)!);
  const staffOf = (slug: string) =>
    rows.staff_services.filter((r) => slugOf.get(r.service_id) === slug).map((r) => nameOf.get(r.staff_id)!);

  // Roster (Nov 1): 4 barbers x 5 + 2 stylists x 37 = 94 (was 2 x 5 + 2 x 37 = 84).
  // Hair Color (Aubin, Nov 1): + Noël only = 95.
  it("T-108 95 rows, no duplicates, no cross-team pair, each person exactly their team's services (Hair Color: Noël only)", () => {
    expect(rows.staff_services).toHaveLength(95);
    expect(new Set(rows.staff_services.map((r) => `${r.staff_id}:${r.service_id}`)).size).toBe(95);

    const teamOfService = new Map(rows.services.map((s) => [s.id, s.team]));
    const teamOfStaff = new Map(rows.staff.map((p) => [p.id, p.team]));
    expect(rows.staff_services.filter((r) => teamOfService.get(r.service_id) !== teamOfStaff.get(r.staff_id))).toEqual([]);

    const stylistSlugs = services.filter((s) => s.team === "stylist").map((s) => s.slug).sort();
    expect(servicesOf("Noël").sort()).toEqual([...BARBER_SLUGS, "hair-color"].sort());
    for (const name of ["Jackson", "Joshua", "Duckel"]) expect(servicesOf(name).sort(), name).toEqual([...BARBER_SLUGS].sort());
    for (const name of ["Reine", "Olga"]) expect(servicesOf(name).sort(), name).toEqual(stylistSlugs);

    expect(staffOf("simple-cornrows").sort()).toEqual(["Olga", "Reine"]);
    expect(staffOf("classic-haircut").sort()).toEqual(["Duckel", "Jackson", "Joshua", "Noël"]);
  });

  it("T-108 seed rows are stable: building twice gives identical rows (upserts never duplicate)", () => {
    expect(buildSeedRows()).toEqual(buildSeedRows());
    expect(rows.staff.map((p) => p.id)).toEqual(
      ["Noël", "Jackson", "Joshua", "Duckel", "Reine", "Olga"].map((n) => byName(n).id),
    );
    // Renaming keeps the database id: the original four keep the ids they had as Barber A-D.
    expect(["Noël", "Jackson", "Reine", "Olga"].map((n) => byName(n).id)).toEqual([
      "2f834e1c-72d7-5604-bd77-b724c9d21a3a",
      "a55a3a35-2276-51c8-9712-b566ab96d744",
      "c458bd2f-b0fa-5e66-91b2-ab5275a2541a",
      "36b78c9f-4271-5678-8ed8-6b4a8a989fd4",
    ]);
  });
});

describe("A6 staff emails stay private", () => {
  /** Every file under a folder (recursively). */
  const filesUnder = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? filesUnder(p) : [p];
    });

  it("T-109 seed emails are unique .invalid placeholders, never in browser-bound files", () => {
    const emails = buildSeedRows().staff.map((p) => p.email);
    expect(emails).toEqual([
      "barber.a@example.invalid", // Noël
      "barber.b@example.invalid", // Jackson
      "barber.e@example.invalid", // Joshua
      "barber.f@example.invalid", // Duckel
      "barber.c@example.invalid", // Reine
      "barber.d@example.invalid", // Olga
    ]);
    expect(new Set(emails).size).toBe(6);
    expect(emails.every((e) => e.endsWith(".invalid"))).toBe(true);
    expect(Object.values(PLACEHOLDER_STAFF_EMAILS).sort()).toEqual([...emails].sort());

    // The catalog reaches the browser: no email field on staff.
    expect(staff.every((p) => !("email" in p))).toBe(true);

    const browserBound = [
      join(ROOT, "data/services-seed.json"),
      join(ROOT, "lib/catalog.ts"),
      ...filesUnder(join(ROOT, "components")),
      ...filesUnder(join(ROOT, "app")),
    ];
    expect(browserBound.length).toBeGreaterThan(10);
    const leaks = browserBound.filter((f) => readFileSync(f, "utf8").includes("example.invalid"));
    expect(leaks).toEqual([]);
  });

  it("T-109 seed-rows (holds the placeholders) is never imported by app/ or components/", () => {
    const importers = [...filesUnder(join(ROOT, "components")), ...filesUnder(join(ROOT, "app"))].filter((f) =>
      /seed-rows/.test(readFileSync(f, "utf8")),
    );
    expect(importers).toEqual([]);
  });
});

describe("settings", () => {
  it("T-110 barber_slot_minutes 5, stylist_slot_minutes 60 (old slot_interval_minutes kept)", () => {
    const s = buildSeedRows().settings[0];
    expect(s.barber_slot_minutes).toBe(5);
    expect(s.stylist_slot_minutes).toBe(60);
    expect(s.slot_interval_minutes).toBe(15);
  });
});
