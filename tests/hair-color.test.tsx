// Hair Color (owner Aubin, Nov 1): a men's barber service done by Noël only.
//   "Color only" $50 / 30 min, "Color + haircut" $75 / 60 min (any cut, named in the notes),
//   colour required: White, Orange, Purple, Burgundy red -> 8 variants (kind x colour).
// Expected answers come from the owner's request and the answer key, not from the code.
// Fixed clock, TEST- customer data, in-memory database built from the seed rows.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import MenPage from "@/app/men/page";
import { StaffStep, StyleConfigurator } from "@/components/booking/BookingStepper";
import { resolveStaffChoice, staffChoicesFor } from "@/components/booking/staff-choices";
import { resolveChoiceVariant } from "@/components/booking/variant-choices";
import { StyleCard } from "@/components/ServiceCards";
import seed from "@/data/services-seed.json";
import { getFreeStartTimes, slotMinutesForTeam } from "@/lib/availability";
import { categoriesFor, onlyStaffIdsFor, services, staff, type Service } from "@/lib/catalog";
import { getDurationMinutes } from "@/lib/duration";
import { dict } from "@/lib/i18n";
import { buildSeedRows, type SeedRows } from "@/lib/seed-rows";
import { computeAvailability, HttpError, loadEligibleStaff } from "@/lib/server/booking-context";
import { createBooking } from "@/lib/server/create-booking";
import { fakeSupabase, seedTables } from "./helpers/fake-supabase";

const TZ = "America/Toronto";
const DAY = "2026-11-06"; // a Friday
const FAR_PAST = new Date("2026-10-01T12:00:00Z");
const at = (hm: string, date = DAY) => fromZonedTime(`${date}T${hm}:00`, TZ);
const labels = (ds: Date[]) => ds.map((d) => formatInTimeZone(d, TZ, "HH:mm"));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const cardNames = (html: string) => [...html.matchAll(/<span class="block font-serif text-lg">([^<]+)<\/span>/g)].map((m) => m[1]);

const NOEL_ID = "2f834e1c-72d7-5604-bd77-b724c9d21a3a";
const svc = (slug: string) => services.find((s) => s.slug === slug)!;
const person = (name: string) => staff.find((p) => p.name === name)!;
const hair = () => svc("hair-color");
const variantOf = (label: string) => hair().variants.find((v) => v.label === label)!;

const COLOURS = ["White", "Orange", "Purple", "Burgundy red"];
const ONLY = COLOURS.map((c) => `Color only · ${c}`);
const WITH_CUT = COLOURS.map((c) => `Color + haircut · ${c}`);

/** buildSeedRows() at db3a762 (roster, before Hair Color), frozen. */
const roster = JSON.parse(readFileSync(join(__dirname, "fixtures/roster-seed-rows.json"), "utf8")) as SeedRows;

describe("T-401 catalog", () => {
  it("hair-color: men side, barber team, in its own men's category Hair Color / Coloration", () => {
    const s = hair();
    expect(s).toBeDefined();
    expect([s.side, s.team, s.nameEn, s.nameFr]).toEqual(["men", "barber", "Hair Color", "Coloration"]);
    const cat = categoriesFor("men").find((c) => c.id === s.categoryId)!;
    expect([cat.nameEn, cat.nameFr, cat.team, cat.side]).toEqual(["Hair Color", "Coloration", "barber", "men"]);
    expect(cat.services.map((x) => x.slug)).toEqual(["hair-color"]);
    // Third men's category, after Cuts and Braids, Twists & Locs.
    expect(categoriesFor("men").map((c) => c.nameEn)).toEqual(["Haircuts & Beard", "Braids, Twists & Locs", "Hair Color"]);
  });

  it("8 variants with exactly these labels, in this order", () => {
    expect(hair().variants.map((v) => v.label)).toEqual([...ONLY, ...WITH_CUT]);
  });
});

describe("T-402 prices (cents)", () => {
  it("every Color only variant = 5000, every Color + haircut variant = 7500", () => {
    for (const l of ONLY) expect(variantOf(l).priceCents, l).toBe(5000);
    for (const l of WITH_CUT) expect(variantOf(l).priceCents, l).toBe(7500);
    for (const v of hair().variants) expect(v.isConsult, v.label).toBe(false);
  });

  it("every other service, variant and add-on is unchanged vs the roster seed (db3a762); only Hair Color rows are new", () => {
    const now = buildSeedRows();
    const hairId = hair().id;
    const hairVariantIds = new Set(hair().variants.map((v) => v.id));

    expect(now.service_variants.filter((v) => !hairVariantIds.has(v.id))).toEqual(roster.service_variants);
    expect(now.service_variants.filter((v) => hairVariantIds.has(v.id))).toHaveLength(8);
    expect(now.service_addons).toEqual(roster.service_addons);
    expect(now.services.filter((s) => s.id !== hairId)).toEqual(roster.services);
    expect(now.categories.filter((c) => c.id !== hair().categoryId)).toEqual(roster.categories);
    expect(now.staff).toEqual(roster.staff);
    expect(now.working_hours).toEqual(roster.working_hours);
    expect(now.settings).toEqual(roster.settings);
  });
});

describe("T-403 getDurationMinutes", () => {
  it("Color only = 30, Color + haircut = 60, for every colour", () => {
    for (const l of ONLY) expect(getDurationMinutes({ service: hair(), variant: variantOf(l) }), l).toBe(30);
    for (const l of WITH_CUT) expect(getDurationMinutes({ service: hair(), variant: variantOf(l) }), l).toBe(60);
  });
});

describe("T-404 colour is required", () => {
  const kind = (k: string) => ({ kind: k });
  const render = (picks: Record<string, string>) =>
    renderToStaticMarkup(
      <StyleConfigurator
        service={hair()}
        variantId={resolveChoiceVariant(hair(), picks)}
        picks={picks}
        onPick={() => {}}
        setVariantId={() => {}}
        lengthLabel="Normal"
        setLengthLabel={() => {}}
        addonIds={[]}
        setAddonIds={() => {}}
        onChangeStyle={() => {}}
        onContinue={() => {}}
      />,
    );
  const continueButton = (html: string) => html.match(/<button[^>]*>Continue<\/button>/)![0];
  /** The disabled attribute (not the "disabled:opacity-40" class). */
  const DISABLED = /\sdisabled=""/;

  it("picking only a kind resolves to no variant and keeps Continue disabled", () => {
    expect(resolveChoiceVariant(hair(), {})).toBeNull();
    expect(resolveChoiceVariant(hair(), kind("Color only"))).toBeNull();
    expect(resolveChoiceVariant(hair(), { color: "White" })).toBeNull();
    expect(continueButton(render({}))).toMatch(DISABLED);
    expect(continueButton(render(kind("Color + haircut")))).toMatch(DISABLED);
  });

  it("kind + colour selects the matching variant id and enables Continue", () => {
    expect(resolveChoiceVariant(hair(), { kind: "Color only", color: "White" })).toBe(variantOf("Color only · White").id);
    expect(resolveChoiceVariant(hair(), { kind: "Color + haircut", color: "Burgundy red" })).toBe(
      variantOf("Color + haircut · Burgundy red").id,
    );
    const html = render({ kind: "Color + haircut", color: "Purple" });
    expect(continueButton(html)).not.toMatch(DISABLED);
    // Two required chip groups (kind, then colour); the picked chips are pressed.
    const t = text(html);
    expect(t.indexOf(dict.en.book.chooseKind)).toBeGreaterThan(-1);
    expect(t.indexOf(dict.en.book.chooseColor)).toBeGreaterThan(t.indexOf(dict.en.book.chooseKind));
    const pressed = [...html.matchAll(/aria-pressed="true"[^>]*><span class="block font-medium">([^<]+)</g)].map((m) => m[1]);
    expect(pressed).toEqual(["Color + haircut", "Purple"]);
    // No size picker for Hair Color.
    expect(t).not.toContain(dict.en.book.chooseSize);
  });

  it("server: a variantId that is not a Hair Color variant is refused (400), nothing inserted", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    try {
      const { db, inserted } = fakeSupabase(seedTables());
      const res = await createBooking(
        db,
        {
          serviceId: hair().id,
          variantId: svc("classic-haircut").variants[0].id,
          staffId: "any",
          startsAt: "2026-11-06T15:00:00.000Z",
          name: "TEST-Customer",
          phone: "613 555 0199",
          email: "TEST-customer@example.com",
        },
        async () => undefined,
      );
      expect(res.status).toBe(400);
      expect(inserted).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("T-405 seed routing (staff_services)", () => {
  const rows = buildSeedRows();
  const key = (r: { staff_id: string; service_id: string }) => `${r.staff_id}:${r.service_id}`;

  it("hair-color is mapped to Noël only", () => {
    expect(rows.staff_services.filter((r) => r.service_id === hair().id).map((r) => r.staff_id)).toEqual([NOEL_ID]);
    expect(person("Noël").id).toBe(NOEL_ID);
  });

  it("95 pairs (94 + 1), no duplicates", () => {
    expect(rows.staff_services).toHaveLength(95);
    expect(new Set(rows.staff_services.map(key)).size).toBe(95);
  });

  it("no barber other than Noël maps to hair-color", () => {
    for (const name of ["Jackson", "Joshua", "Duckel", "Reine", "Olga"]) {
      expect(rows.staff_services.some((r) => r.service_id === hair().id && r.staff_id === person(name).id), name).toBe(false);
    }
  });

  it("every other mapping is unchanged vs the roster seed", () => {
    expect(rows.staff_services.filter((r) => r.service_id !== hair().id)).toEqual(roster.staff_services);
  });

  it("the data says it with a staff key, never a name or an email", () => {
    const raw = (seed.men as { services: { name_en?: string; only_staff?: string[] }[] }[])
      .flatMap((c) => c.services)
      .find((s) => s.name_en === "Hair Color")!;
    expect(raw.only_staff).toEqual(["barber-a"]);
    expect(hair().onlyStaffKeys).toEqual(["barber-a"]);
    expect(onlyStaffIdsFor(hair())).toEqual([NOEL_ID]);
    expect(onlyStaffIdsFor(svc("classic-haircut"))).toBeNull();
  });
});

describe("T-406 staff step for Hair Color", () => {
  it("cards are exactly Anyone available + Noël", () => {
    expect(staffChoicesFor(hair()).map((p) => p.name)).toEqual(["Noël"]);
    const html = renderToStaticMarkup(<StaffStep service={hair()} staffId="any" onPick={() => {}} />);
    expect(cardNames(html)).toEqual(["Anyone available", "Noël"]);
  });

  it("a preselected Jackson falls back to Anyone available", () => {
    expect(resolveStaffChoice(hair(), person("Jackson").id)).toBe("any");
    expect(resolveStaffChoice(hair(), NOEL_ID)).toBe(NOEL_ID);
    const html = renderToStaticMarkup(<StaffStep service={hair()} staffId={person("Jackson").id} onPick={() => {}} />);
    expect(cardNames(html)).toEqual(["Anyone available", "Noël"]);
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?Anyone available/);
  });

  it("other barber services still show all 4 barbers", () => {
    expect(staffChoicesFor(svc("classic-haircut")).map((p) => p.name)).toEqual(["Noël", "Jackson", "Joshua", "Duckel"]);
  });
});

describe("T-407 server routing (fakes)", () => {
  const hairRef = () => ({ id: hair().id, team: "barber" as const });

  it("loadEligibleStaff(hair-color, Jackson) -> HttpError 400", async () => {
    const err = await loadEligibleStaff(fakeSupabase(seedTables()).db, hairRef(), person("Jackson").id).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(400);
  });

  it("'any' -> [Noël] with the seed rows", async () => {
    const people = await loadEligibleStaff(fakeSupabase(seedTables()).db, hairRef(), "any");
    expect(people.map((p) => p.name)).toEqual(["Noël"]);
  });

  // loadEligibleStaff applies only_staff on top of staff_services + team, so a wrong
  // staff_services row (Jackson is a barber too) still cannot book Hair Color.
  it("'any' -> [Noël] only, even if a wrong staff_services row maps Jackson", async () => {
    const tables = seedTables();
    const jackson = tables.staff.find((p) => p.name === "Jackson")!;
    tables.staff_services.push({ staff_id: jackson.id, service_id: hair().id, staff: jackson });
    const people = await loadEligibleStaff(fakeSupabase(tables).db, hairRef(), "any");
    expect(people.map((p) => p.name)).toEqual(["Noël"]);
  });

  describe("createBooking", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    });
    afterEach(() => vi.useRealTimers());

    it("'any' for hair-color inserts Noël's id", async () => {
      const { db, inserted } = fakeSupabase(seedTables());
      const res = await createBooking(
        db,
        {
          serviceId: hair().id,
          variantId: variantOf("Color only · Orange").id,
          staffId: "any",
          startsAt: "2026-11-06T15:00:00.000Z",
          name: "TEST-Customer",
          phone: "613 555 0199",
          email: "TEST-customer@example.com",
          notes: "TEST-",
        },
        async () => undefined,
      );
      expect(res.status).toBe(201);
      expect(inserted.map((i) => i.row.staff_id)).toEqual([NOEL_ID]);
      expect(inserted[0].row.ends_at).toBe("2026-11-06T15:30:00.000Z");
    });
  });
});

describe("T-408 start-time grid (5 min) and closing", () => {
  const settings = buildSeedRows().settings[0];
  const startsFor = (label: string, busy: { start: Date; end: Date }[] = []) =>
    getFreeStartTimes({
      date: DAY,
      durationMinutes: getDurationMinutes({ service: hair(), variant: variantOf(label) }),
      working: [{ start: "10:00", end: "20:00" }],
      busy,
      now: FAR_PAST,
      minNoticeMinutes: settings.min_notice_minutes,
      slotIntervalMinutes: slotMinutesForTeam(hair().team, settings),
      timeZone: TZ,
    });

  it("Noël busy 10:00-10:30 -> first Color only start 10:30, then 10:35 (through the database rows)", async () => {
    const tables = seedTables();
    tables.bookings.push({ staff_id: NOEL_ID, status: "booked", starts_at: at("10:00").toISOString(), ends_at: at("10:30").toISOString() });
    const byDate = await computeAvailability(fakeSupabase(tables).db, {
      staffIds: [NOEL_ID],
      fromDate: DAY,
      days: 1,
      durationMinutes: 30,
      settings,
      team: "barber",
      now: FAR_PAST,
    });
    expect(labels(byDate[DAY][NOEL_ID]!).slice(0, 2)).toEqual(["10:30", "10:35"]);
    expect(labels(startsFor("Color only · White", [{ start: at("10:00"), end: at("10:30") }]))[0]).toBe("10:30");
  });

  it("Color + haircut (60) last start 19:00; Color only (30) last start 19:30", () => {
    expect(labels(startsFor("Color + haircut · White")).at(-1)).toBe("19:00");
    expect(labels(startsFor("Color only · White")).at(-1)).toBe("19:30");
  });

  it("no start for any of the 8 variants ends after 20:00", () => {
    for (const v of hair().variants) {
      const minutes = getDurationMinutes({ service: hair(), variant: v });
      const list = startsFor(v.label);
      expect(list.length, v.label).toBeGreaterThan(0);
      expect(list.filter((t) => t.getTime() + minutes * 60000 > at("20:00").getTime()), v.label).toEqual([]);
    }
  });
});

describe("T-409 tampered price", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("Color + haircut with priceCents 1 in the body -> inserted price_estimate_cents 7500, 60 min block", async () => {
    const { db, inserted } = fakeSupabase(seedTables());
    const res = await createBooking(
      db,
      {
        serviceId: hair().id,
        variantId: variantOf("Color + haircut · Purple").id,
        staffId: NOEL_ID,
        startsAt: "2026-11-06T15:00:00.000Z",
        priceCents: 1,
        price_estimate_cents: 1,
        name: "TEST-Customer",
        phone: "613 555 0199",
        email: "TEST-customer@example.com",
      },
      async () => undefined,
    );
    expect(res.status).toBe(201);
    expect(inserted[0].row.price_estimate_cents).toBe(7500);
    expect(inserted[0].row.ends_at).toBe("2026-11-06T16:00:00.000Z");
  });
});

describe("T-411 Extensions add-on: not added, only on the TODO list", () => {
  it("no service has an Extensions add-on", () => {
    const all: Service[] = services;
    expect(all.flatMap((s) => s.addons.filter((a) => /extension/i.test(a.name)).map((a) => `${s.slug}: ${a.name}`))).toEqual([]);
    expect(buildSeedRows().service_addons.filter((a) => /extension/i.test(a.name))).toEqual([]);
  });

  it("the TODO is in services-seed.json flags", () => {
    expect(seed.flags).toContain("Extensions add-on: price from Aubin, then add to those 3 styles (Knotless Braids, Stitch Braids, Knotless Bones Straight Braids).");
  });
});

describe("/men page and card", () => {
  it("Hair Color is the third tab, after Cuts and Braids, Twists & Locs", () => {
    const html = renderToStaticMarkup(MenPage());
    const tabs = [...html.matchAll(/<button role="tab"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(tabs).toEqual([dict.en.men.cutsTab, dict.en.men.stylesTab, dict.en.men.colorTab]);
    expect(dict.en.men.colorTab).toBe("Hair Color / Coloration");
  });

  it("the card says 'from $50'", () => {
    const html = text(renderToStaticMarkup(<StyleCard service={hair()} />));
    expect(html).toContain("from $50");
    expect(html).toContain("Hair Color / Coloration");
  });

  it("French text exists for the new words", () => {
    expect(dict.fr.choices).toMatchObject({
      "Color only": "Couleur seulement",
      "Color + haircut": "Couleur + coupe",
      White: "Blanc",
      Orange: "Orange",
      Purple: "Violet",
      "Burgundy red": "Rouge bordeaux",
    });
    for (const k of ["chooseKind", "chooseColor", "cutInNotes"] as const) expect(dict.fr.book[k], k).toBeTruthy();
    expect(dict.fr.men.colorTab).toBe("Hair Color / Coloration");
  });
});
