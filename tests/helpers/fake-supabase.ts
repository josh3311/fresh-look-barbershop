// A tiny in-memory stand-in for the Supabase query builder, only as much as
// lib/server/booking-context.ts and lib/server/create-booking.ts use.
// Backed by the real seed rows (buildSeedRows), so tests read the same data the
// database gets. Bookings added by tests use TEST- customer data.
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSeedRows } from "@/lib/seed-rows";

type Row = Record<string, unknown>;

export interface FakeTables {
  [table: string]: Row[];
}

/** Seed rows + staff_services pre-joined like `staff:staff_id (...)` returns them. */
export function seedTables(): FakeTables {
  const rows = buildSeedRows();
  const staffById = new Map(rows.staff.map((p) => [p.id, p]));
  return {
    settings: rows.settings.map((r) => ({ ...r })),
    services: rows.services.map((r) => ({ ...r })),
    service_variants: rows.service_variants.map((r) => ({ ...r })),
    service_addons: rows.service_addons.map((r) => ({ ...r })),
    staff: rows.staff.map((r) => ({ ...r })),
    working_hours: rows.working_hours.map((r) => ({ ...r })),
    staff_services: rows.staff_services.map((r) => ({ ...r, staff: staffById.get(r.staff_id) })),
    time_off: [],
    bookings: [],
  };
}

const time = (v: unknown) => new Date(String(v)).getTime();

export function fakeSupabase(tables: FakeTables) {
  const inserted: { table: string; row: Row }[] = [];
  let nextId = 1;

  const db = {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      let countMode = false;
      const q = {
        select(_cols?: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.count) countMode = true;
          return q;
        },
        eq(col: string, v: unknown) {
          rows = rows.filter((r) => r[col] === v);
          return q;
        },
        in(col: string, vs: unknown[]) {
          rows = rows.filter((r) => vs.includes(r[col]));
          return q;
        },
        lt(col: string, v: unknown) {
          rows = rows.filter((r) => time(r[col]) < time(v));
          return q;
        },
        gt(col: string, v: unknown) {
          rows = rows.filter((r) => time(r[col]) > time(v));
          return q;
        },
        gte(col: string, v: unknown) {
          rows = rows.filter((r) => time(r[col]) >= time(v));
          return q;
        },
        maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
        single: async () =>
          rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: "no rows", code: "PGRST116" } },
        insert(row: Row) {
          return {
            select: () => ({
              single: async () => {
                // Same rule as the no_overlap exclusion constraint (status 'booked').
                if (table === "bookings") {
                  const clash = (tables.bookings ?? []).some(
                    (b) =>
                      b.status === "booked" &&
                      row.status === "booked" &&
                      b.staff_id === row.staff_id &&
                      time(b.starts_at) < time(row.ends_at) &&
                      time(row.starts_at) < time(b.ends_at),
                  );
                  if (clash) return { data: null, error: { code: "23P01", message: "no_overlap" } };
                }
                const id = `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;
                (tables[table] ??= []).push({ id, ...row });
                inserted.push({ table, row });
                return { data: { id }, error: null };
              },
            }),
          };
        },
        then<T>(resolve: (v: { data: Row[] | null; count?: number; error: null }) => T) {
          return Promise.resolve(
            countMode ? { data: null, count: rows.length, error: null } : { data: rows, error: null },
          ).then(resolve);
        },
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, inserted, tables };
}
