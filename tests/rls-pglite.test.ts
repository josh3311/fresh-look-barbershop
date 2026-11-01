// T-309: the anon key cannot read bookings, a signed-in non-staff user sees 0 rows, and
// staff.email is private. Real Postgres (PGlite, WASM) with EVERY migration applied, the
// same harness idea as tests/migrations.test.ts; never the live project.
// tests/rls.live.test.ts stays as the opt-in check against the real Supabase project.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildSeedRows, toSql } from "@/lib/seed-rows";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const MIGRATIONS_DIR = join(__dirname, "../supabase/migrations");

// What Supabase has before any migration. auth.uid() reads the JWT "sub" claim the same way
// Supabase does, so a test can act as any signed-in user.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const TEST_BOOKING_ID = "00000000-0000-4000-8000-0000000003a9";

async function as<T>(db: PGlite, role: string, sql: string, sub?: string) {
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [sub ?? ""]);
  try {
    return { rows: (await db.query<T>(sql)).rows, error: undefined as string | undefined };
  } catch (e) {
    return { rows: undefined, error: e instanceof Error ? e.message : String(e) };
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

describe("T-309 RLS on real Postgres (all migrations)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await PGlite.create({ extensions: { btree_gist } });
    await db.exec(SUPABASE_STUB);
    for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      await db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
    }
    const seed = buildSeedRows();
    await db.exec(toSql(seed));
    const classic = seed.services.find((s) => s.slug === "classic-haircut")!;
    const variant = seed.service_variants.find((v) => v.service_id === classic.id)!;
    await db.query(
      `insert into public.bookings (id, staff_id, service_id, variant_id, customer_name, customer_phone, customer_email,
         starts_at, ends_at, price_estimate_cents)
       values ($1, $2, $3, $4, 'TEST-rls', '+16135550100', 'test-rls@example.com',
         '2026-11-06 10:00-05', '2026-11-06 10:35-05', 3000)`,
      [TEST_BOOKING_ID, seed.staff[0].id, classic.id, variant.id],
    );
  });
  afterAll(async () => db?.close());

  it("the TEST- booking exists (service role sees it)", async () => {
    const r = await as<{ id: string }>(db, "service_role", "select id from public.bookings");
    expect(r.rows).toEqual([{ id: TEST_BOOKING_ID }]);
  });

  it("anon: select * from bookings -> permission denied", async () => {
    const r = await as(db, "anon", "select * from public.bookings");
    expect(r.error).toMatch(/permission denied/);
    expect(r.rows).toBeUndefined();
  });

  it("authenticated with a random auth.uid() that is not staff -> 0 rows", async () => {
    const r = await as(db, "authenticated", "select * from public.bookings", randomUUID());
    expect(r.error).toBeUndefined();
    expect(r.rows).toEqual([]);
  });

  it("anon cannot select staff.email (but can read public staff columns)", async () => {
    expect((await as(db, "anon", "select email from public.staff")).error).toMatch(/permission denied/);
    const pub = await as<{ name: string }>(db, "anon", "select name from public.staff order by sort_order");
    expect(pub.error).toBeUndefined();
    expect(pub.rows!.map((r) => r.name)).toEqual(["Noël", "Jackson", "Joshua", "Duckel", "Reine", "Olga"]);
  });
});
