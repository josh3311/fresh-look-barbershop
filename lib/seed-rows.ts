// Turns the catalog (from services-seed.json) into database rows.
// Used by scripts/seed.ts. Ids are deterministic, so re-seeding is an upsert.
// Server/seed side only: never import this from app/ or components/ (it holds the
// placeholder staff emails, which must not reach the browser bundle).
import seed from "@/data/services-seed.json";
import { categories, OPENING_HOURS, services, shop, staff, rules } from "@/lib/catalog";
import { stableId } from "@/lib/ids";

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Placeholder staff emails (Change Request #2). `.invalid` can never receive mail.
 * TODO Aubin: real names and emails are coming. Set the REAL emails in the database
 * only (Supabase SQL editor: `update public.staff set email = '...' where name = 'Barber A';`).
 * NEVER commit a real email here: this repo is public. The seed only fills an email
 * that is still empty, so it never overwrites a real one.
 */
export const PLACEHOLDER_STAFF_EMAILS: Record<string, string> = {
  "barber-a": "barber.a@example.invalid",
  "barber-b": "barber.b@example.invalid",
  "barber-c": "barber.c@example.invalid",
  "barber-d": "barber.d@example.invalid",
};

function placeholderEmail(slug: string): string {
  const email = PLACEHOLDER_STAFF_EMAILS[slug];
  if (!email) throw new Error(`No placeholder email for staff "${slug}"`);
  return email;
}

export function buildSeedRows() {
  const opening_hours = Object.fromEntries(
    DAYS.map((d, i) => {
      const h = OPENING_HOURS.find((x) => x.weekday === i);
      return [d, h ? [h.start, h.end] : null];
    }),
  );

  return {
    settings: [
      {
        id: 1,
        shop_name: seed.shop.name,
        address: shop.address,
        email: shop.email,
        phone: shop.phone,
        timezone: shop.timezone,
        slot_interval_minutes: 15,
        // Change Request #2: barbers start every 5 min, stylists on the hour.
        barber_slot_minutes: 5,
        stylist_slot_minutes: 60,
        min_notice_minutes: 60,
        max_days_ahead: 60,
        extra_length_price_cents: rules.extraLengthCents,
        opening_hours,
      },
    ],
    categories: categories.map((c) => ({
      id: c.id,
      side: c.side,
      name_en: c.nameEn,
      name_fr: c.nameFr,
      sort_order: c.sortOrder,
    })),
    services: services.map((s) => ({
      id: s.id,
      category_id: s.categoryId,
      side: s.side,
      team: s.team,
      slug: s.slug,
      name_en: s.nameEn,
      name_fr: s.nameFr,
      image_url: s.imageUrl,
      base_duration_minutes: s.baseDurationMinutes,
      length_based: s.lengthBased,
      is_active: true,
      sort_order: s.sortOrder,
    })),
    service_variants: services.flatMap((s) =>
      s.variants.map((v) => ({
        id: v.id,
        service_id: s.id,
        label: v.label,
        price_cents: v.priceCents,
        is_consult: v.isConsult,
        duration_minutes: v.durationMinutes,
        sort_order: v.sortOrder,
      })),
    ),
    service_addons: services.flatMap((s) =>
      s.addons.map((a) => ({
        id: a.id,
        service_id: s.id,
        name: a.name,
        price_cents: a.priceCents,
        is_from: a.isFrom,
        is_consult: a.isConsult,
        extra_minutes: a.extraMinutes,
      })),
    ),
    staff: staff.map((p) => ({
      id: p.id,
      name: p.name,
      side: p.side,
      team: p.team,
      email: placeholderEmail(p.slug),
      role: "staff",
      is_active: true,
      sort_order: p.sortOrder,
    })),
    // Everyone works the opening hours (Mon-Sun 10:00-20:00).
    working_hours: staff.flatMap((p) =>
      OPENING_HOURS.map((h) => ({
        id: stableId(`wh:${p.slug}:${h.weekday}`),
        staff_id: p.id,
        weekday: h.weekday,
        start_time: h.start,
        end_time: h.end,
      })),
    ),
    // Each person does every service of their team (barbers: the 5 cuts; stylists:
    // every braid/twist/loc service on both sides). Never across teams.
    staff_services: staff.flatMap((p) =>
      services.filter((s) => s.team === p.team).map((s) => ({ staff_id: p.id, service_id: s.id })),
    ),
  };
}

export type SeedRows = ReturnType<typeof buildSeedRows>;

/** Insert order (parents first). */
export const SEED_TABLES = [
  "settings",
  "categories",
  "services",
  "service_variants",
  "service_addons",
  "staff",
  "working_hours",
  "staff_services",
] as const satisfies readonly (keyof SeedRows)[];

const PK: Record<(typeof SEED_TABLES)[number], string> = {
  settings: "id",
  categories: "id",
  services: "id",
  service_variants: "id",
  service_addons: "id",
  staff: "id",
  working_hours: "id",
  staff_services: "staff_id, service_id",
};

export const primaryKey = (table: (typeof SEED_TABLES)[number]) => PK[table];

function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Idempotent SQL (upserts) for the same rows. */
export function toSql(rows: SeedRows): string {
  const parts = ["-- Generated by `npm run seed:sql` from data/services-seed.json. Do not edit by hand.", "begin;"];
  for (const table of SEED_TABLES) {
    const list = rows[table] as Record<string, unknown>[];
    if (!list.length) continue;
    const cols = Object.keys(list[0]);
    const pk = PK[table];
    const pkCols = pk.split(", ");
    // A staff email is only filled while empty: never overwrite a real one set in the database.
    const updates = cols
      .filter((c) => !pkCols.includes(c))
      .map((c) =>
        table === "staff" && c === "email"
          ? `email = coalesce(public.staff.email, excluded.email)`
          : `${c} = excluded.${c}`,
      );
    parts.push(
      `insert into public.${table} (${cols.join(", ")}) values\n` +
        list.map((r) => `  (${cols.map((c) => sqlValue(r[c])).join(", ")})`).join(",\n") +
        `\non conflict (${pk}) do ${updates.length ? `update set ${updates.join(", ")}` : "nothing"};`,
    );
  }
  parts.push("commit;");
  return parts.join("\n\n") + "\n";
}
