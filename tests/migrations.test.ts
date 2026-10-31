// T-111: runs the real SQL migrations in Postgres (PGlite = Postgres compiled to WASM, no
// network, never the live Supabase project).
//
// "Live" scenario: the pre-CR2 migrations + the exact rows the live database was seeded with
// before Change Request #2 (tests/fixtures/pre-cr2-seed-rows.json: old prices, old durations,
// staff_services by side, no team / email) + a booking. Then the CR2 migration must turn that
// into exactly what the new seed describes, and a second run must change nothing.
//
// "Fresh" scenario: every migration on an empty database, then the new seed SQL twice.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildSeedRows, toSql, type SeedRows } from "@/lib/seed-rows";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const MIGRATIONS_DIR = join(__dirname, "../supabase/migrations");
const CR2_FILE = "20261031120000_cr2_teams_prices_durations.sql";
const MANUAL_FILE = join(__dirname, "../supabase/manual/cr2_teams_prices_durations.sql");
const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
const readMigration = (f: string) => readFileSync(join(MIGRATIONS_DIR, f), "utf8");
const CR2_SQL = readMigration(CR2_FILE);

const before = JSON.parse(readFileSync(join(__dirname, "fixtures/pre-cr2-seed-rows.json"), "utf8")) as SeedRows & {
  _read_me?: string;
};
delete before._read_me;
const after = buildSeedRows();

const PUBLIC_TABLES = [
  "settings",
  "staff",
  "categories",
  "services",
  "service_variants",
  "service_addons",
  "staff_services",
  "working_hours",
  "time_off",
  "bookings",
];

/** What Supabase has before any migration: roles, the auth schema, default grants. */
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  grant usage on schema public, auth, extensions to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

async function newDb() {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(SUPABASE_STUB);
  return db;
}

/** Sum of rows changed by every statement (PGlite keeps the last non-zero count, so 0 = none). */
async function execCounting(db: PGlite, sql: string) {
  const results = await db.exec(sql);
  return { results, affected: results.reduce((n, r) => n + (r.affectedRows ?? 0), 0) };
}

/** Every row of every public table, with its physical version (xmin, ctid): any UPDATE changes it. */
async function snapshot(db: PGlite) {
  const out: Record<string, unknown[]> = {};
  for (const t of PUBLIC_TABLES) {
    const { rows } = await db.query(
      `select xmin::text as _xmin, ctid::text as _ctid, to_jsonb(x) as row from public.${t} x order by ctid`,
    );
    out[t] = rows;
  }
  return out;
}

async function rowsOf<T>(db: PGlite, sql: string) {
  return (await db.query<T>(sql)).rows;
}

async function asRole<T>(db: PGlite, role: string, sql: string): Promise<{ rows?: T[]; error?: string }> {
  await db.exec(`set role ${role}`);
  try {
    return { rows: (await db.query<T>(sql)).rows };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  } finally {
    await db.exec("reset role");
  }
}

const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** The CR2 state the new seed describes, in DB terms. */
const expected = {
  services: after.services.map((s) => ({ id: s.id, team: s.team, base_duration_minutes: s.base_duration_minutes })),
  variants: after.service_variants.map((v) => ({ id: v.id, price_cents: v.price_cents, duration_minutes: v.duration_minutes })),
  staff: after.staff.map((p) => ({ id: p.id, name: p.name, side: p.side, team: p.team, email: p.email })),
  staffServices: after.staff_services.map((r) => `${r.staff_id}:${r.service_id}`).sort(),
};

async function assertCr2State(db: PGlite) {
  // Prices (T-101 / T-102) and every other price unchanged (T-103).
  const prices = await rowsOf<{ slug: string; price_cents: number }>(
    db,
    `select s.slug, v.price_cents from public.service_variants v join public.services s on s.id = v.service_id
     where s.slug in ('classic-haircut', 'haircut-beard-trim', 'kids', 'beard', 'outline') order by s.sort_order`,
  );
  expect(prices).toEqual([
    { slug: "classic-haircut", price_cents: 3000 },
    { slug: "haircut-beard-trim", price_cents: 3500 },
    { slug: "kids", price_cents: 2500 },
    { slug: "beard", price_cents: 2000 },
    { slug: "outline", price_cents: 2000 },
  ]);
  const variants = await rowsOf<{ id: string; price_cents: number | null; duration_minutes: number | null }>(
    db,
    "select id, price_cents, duration_minutes from public.service_variants",
  );
  expect(byId(variants)).toEqual(byId(expected.variants));

  // Durations and teams (T-104..T-106).
  const services = await rowsOf<{ id: string; team: string; base_duration_minutes: number }>(
    db,
    "select id, team, base_duration_minutes from public.services",
  );
  expect(byId(services)).toEqual(byId(expected.services));
  const perTeam = await rowsOf<{ team: string; n: number; minutes: number[] }>(
    db,
    "select team, count(*)::int as n, array_agg(distinct base_duration_minutes order by base_duration_minutes) as minutes from public.services group by team order by team",
  );
  expect(perTeam).toEqual([
    { team: "barber", n: 5, minutes: [15, 30, 35, 45] },
    { team: "stylist", n: 37, minutes: [60] },
  ]);

  // Staff teams + placeholder emails (T-107, T-109).
  const staff = await rowsOf(db, "select id, name, side, team, email from public.staff order by sort_order");
  expect(staff).toEqual(expected.staff);

  // Routing (T-108): exactly the new seed's 84 pairs, nothing cross-team.
  const pairs = await rowsOf<{ k: string }>(db, "select staff_id || ':' || service_id as k from public.staff_services");
  expect(pairs.map((p) => p.k).sort()).toEqual(expected.staffServices);
  expect(pairs).toHaveLength(84);
  const perPerson = await rowsOf(
    db,
    `select st.name, count(*)::int as n, bool_and(st.team = sv.team) as same_team
     from public.staff_services ss join public.staff st on st.id = ss.staff_id join public.services sv on sv.id = ss.service_id
     group by st.name order by st.name`,
  );
  expect(perPerson).toEqual([
    { name: "Barber A", n: 5, same_team: true },
    { name: "Barber B", n: 5, same_team: true },
    { name: "Barber C", n: 37, same_team: true },
    { name: "Barber D", n: 37, same_team: true },
  ]);
  const cornrows = await rowsOf<{ name: string }>(
    db,
    `select st.name from public.staff_services ss join public.staff st on st.id = ss.staff_id
     join public.services sv on sv.id = ss.service_id where sv.slug = 'simple-cornrows' order by st.name`,
  );
  expect(cornrows.map((r) => r.name)).toEqual(["Barber C", "Barber D"]);
  const classic = await rowsOf<{ name: string }>(
    db,
    `select st.name from public.staff_services ss join public.staff st on st.id = ss.staff_id
     join public.services sv on sv.id = ss.service_id where sv.slug = 'classic-haircut' order by st.name`,
  );
  expect(classic.map((r) => r.name)).toEqual(["Barber A", "Barber B"]);

  // Settings (T-110).
  expect(await rowsOf(db, "select slot_interval_minutes, barber_slot_minutes, stylist_slot_minutes from public.settings")).toEqual([
    { slot_interval_minutes: 15, barber_slot_minutes: 5, stylist_slot_minutes: 60 },
  ]);
}

async function assertStaffPrivacy(db: PGlite) {
  const email = await asRole(db, "anon", "select email from public.staff");
  expect(email.error).toMatch(/permission denied/);
  const star = await asRole(db, "anon", "select * from public.staff");
  expect(star.error).toMatch(/permission denied/);
  const signedInEmail = await asRole(db, "authenticated", "select email from public.staff");
  expect(signedInEmail.error).toMatch(/permission denied/);

  const pub = await asRole<{ name: string; team: string }>(db, "anon", "select name, team from public.staff order by sort_order");
  expect(pub.error).toBeUndefined();
  expect(pub.rows).toEqual([
    { name: "Barber A", team: "barber" },
    { name: "Barber B", team: "barber" },
    { name: "Barber C", team: "stylist" },
    { name: "Barber D", team: "stylist" },
  ]);
  const signedIn = await asRole(db, "authenticated", "select id, name, photo_url, bio, side, role, is_active, sort_order, team from public.staff");
  expect(signedIn.error).toBeUndefined();
  expect(signedIn.rows).toHaveLength(4);
  // The server (service role) still reads emails.
  const server = await asRole<{ email: string }>(db, "service_role", "select email from public.staff order by sort_order");
  expect(server.error).toBeUndefined();
  expect(server.rows!.map((r) => r.email)).toEqual(expected.staff.map((p) => p.email));
  // Customers still never read bookings.
  expect((await asRole(db, "anon", "select id from public.bookings")).error).toMatch(/permission denied/);
}

describe("T-111 CR2 migration on the live (pre-CR2) state", () => {
  let db: PGlite;
  let firstRunAffected = 0;
  const BOOKING_ID = "00000000-0000-4000-8000-0000000000b1";

  beforeAll(async () => {
    db = await newDb();
    for (const f of migrationFiles.filter((f) => f < CR2_FILE)) await db.exec(readMigration(f));
    await db.exec(toSql(before)); // exactly what the old seed wrote
    // A booking that must survive untouched (Barber A, Classic Haircut, old 30 min block).
    const classic = before.services.find((s) => s.slug === "classic-haircut")!;
    const variant = before.service_variants.find((v) => v.service_id === classic.id)!;
    const barberA = before.staff.find((p) => p.name === "Barber A")!;
    await db.query(
      `insert into public.bookings (id, staff_id, service_id, variant_id, customer_name, customer_phone, customer_email,
         starts_at, ends_at, price_estimate_cents)
       values ($1, $2, $3, $4, 'TEST-migration', '+16135550100', 'test@example.com',
         '2026-11-06 10:00-05', '2026-11-06 10:30-05', 2500)`,
      [BOOKING_ID, barberA.id, classic.id, variant.id],
    );
  });

  it("the starting point really is the old live state", async () => {
    expect(await rowsOf(db, "select count(*)::int as n from public.staff_services")).toEqual([{ n: 84 }]);
    const cross = await rowsOf(
      db,
      `select count(*)::int as n from public.staff_services ss join public.staff st on st.id = ss.staff_id
       join public.services sv on sv.id = ss.service_id where st.side <> sv.side`,
    );
    expect(cross).toEqual([{ n: 0 }]); // mapped by side: barbers A, B on the men's braid styles
    const barberBraids = await rowsOf(
      db,
      `select count(*)::int as n from public.staff_services ss join public.staff st on st.id = ss.staff_id
       join public.services sv on sv.id = ss.service_id where st.name = 'Barber A' and sv.slug = 'simple-cornrows'`,
    );
    expect(barberBraids).toEqual([{ n: 1 }]);
    expect(
      await rowsOf(
        db,
        `select s.slug, v.price_cents, s.base_duration_minutes from public.services s join public.service_variants v on v.service_id = s.id
         where s.slug in ('classic-haircut', 'haircut-beard-trim') order by s.sort_order`,
      ),
    ).toEqual([
      { slug: "classic-haircut", price_cents: 2500, base_duration_minutes: 30 },
      { slug: "haircut-beard-trim", price_cents: 3000, base_duration_minutes: 40 },
    ]);
    const cols = await rowsOf<{ column_name: string }>(
      db,
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'staff' and column_name in ('team', 'email')",
    );
    expect(cols).toEqual([]);
  });

  it("first run: prices, durations, teams, routing, emails and settings match the new seed", async () => {
    const bookingBefore = await rowsOf(db, "select xmin::text, to_jsonb(b) as row from public.bookings b");
    const { affected } = await execCounting(db, CR2_SQL);
    firstRunAffected = affected;
    expect(firstRunAffected).toBeGreaterThan(0);
    await assertCr2State(db);
    // The booking is untouched (same row version).
    expect(await rowsOf(db, "select xmin::text, to_jsonb(b) as row from public.bookings b")).toEqual(bookingBefore);
  });

  it("anon / signed-in users cannot read staff emails, but can read the public columns", async () => {
    await assertStaffPrivacy(db);
  });

  it("second run changes 0 rows: every statement reports 0 and every row keeps its version", async () => {
    const snap = await snapshot(db);
    const { results, affected } = await execCounting(db, CR2_SQL);
    expect(results.length).toBeGreaterThan(20);
    expect(results.map((r) => r.affectedRows ?? 0).filter((n) => n !== 0)).toEqual([]);
    expect(affected).toBe(0);
    expect(await snapshot(db)).toEqual(snap);
    await assertCr2State(db);
    await assertStaffPrivacy(db);
  });

  it("the seed (as the build runs it) adds nothing after the migration: already in sync", async () => {
    // --build only inserts missing rows; emulate it with "on conflict do nothing".
    const sql = toSql(after).replace(/on conflict \(([^)]+)\) do update set [^;]+;/g, "on conflict ($1) do nothing;");
    const { affected } = await execCounting(db, sql);
    expect(affected).toBe(0);
  });
});

describe("T-111 manual paste-ready file", () => {
  it("contains the migration word for word inside begin/commit", () => {
    const manual = readFileSync(MANUAL_FILE, "utf8");
    expect(manual).toContain(`begin;\n\n${CR2_SQL}\ncommit;`);
    // No destructive statements (comments stripped: they may say "no truncate").
    for (const sql of [manual, CR2_SQL]) {
      const code = sql.replace(/--.*$/gm, "");
      expect(code).not.toMatch(/\b(truncate|drop\s+(table|column|schema))\b/i);
      expect(code).not.toMatch(/\bbookings\b/i);
      // The only delete is the cross-team staff_services clean-up.
      expect(code.match(/\bdelete\s+from\s+[\w.]+/gi)).toEqual(["delete from public.staff_services"]);
    }
  });

  it("runs end to end on the live state; its read-only checks return the expected values", async () => {
    const db = await newDb();
    for (const f of migrationFiles.filter((f) => f < CR2_FILE)) await db.exec(readMigration(f));
    await db.exec(toSql(before));
    const results = await db.exec(readFileSync(MANUAL_FILE, "utf8"));
    const find = (field: string) => results.find((r) => r.fields.some((f) => f.name === field))!.rows;
    expect(find("cross_team_pairs")).toEqual([{ cross_team_pairs: 0 }]);
    expect(find("variants_with_own_duration")).toEqual([{ variants_with_own_duration: 0 }]);
    expect(find("anon_can_read_email")).toEqual([
      { anon_can_read_email: false, anon_can_read_name: true, anon_can_read_team: true, signed_in_can_read_email: false },
    ]);
    expect(find("barber_slot_minutes")).toEqual([{ barber_slot_minutes: 5, stylist_slot_minutes: 60, slot_interval_minutes: 15 }]);
    await assertCr2State(db);
    // And again (the owner may paste it twice).
    const snap = await snapshot(db);
    await db.exec(readFileSync(MANUAL_FILE, "utf8"));
    expect(await snapshot(db)).toEqual(snap);
  });
});

describe("T-111 fresh database: every migration, then the new seed", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await newDb();
    for (const f of migrationFiles) await db.exec(readMigration(f));
  });

  it("the new seed loads (team constraints accept it) and gives the CR2 state", async () => {
    await db.exec(toSql(after));
    await assertCr2State(db);
    await assertStaffPrivacy(db);
  });

  it("re-seeding creates no duplicates and never overwrites a real staff email", async () => {
    const counts = async () =>
      Object.fromEntries(
        await Promise.all(
          PUBLIC_TABLES.map(async (t) => [t, (await rowsOf<{ n: number }>(db, `select count(*)::int as n from public.${t}`))[0].n]),
        ),
      );
    const barberA = after.staff.find((p) => p.name === "Barber A")!.id;
    await db.query("update public.staff set email = 'real.person@example.test' where id = $1", [barberA]);
    const before = await counts();
    await db.exec(toSql(after));
    await db.exec(toSql(after));
    expect(await counts()).toEqual(before);
    expect(before.staff_services).toBe(84);
    expect(await rowsOf(db, `select email from public.staff where id = '${barberA}'`)).toEqual([{ email: "real.person@example.test" }]);
    await db.query("update public.staff set email = null where id = $1", [barberA]);
    await db.exec(toSql(after));
    expect(await rowsOf(db, `select email from public.staff where id = '${barberA}'`)).toEqual([{ email: "barber.a@example.invalid" }]);
  });

  it("running the CR2 migration again on the seeded database changes 0 rows", async () => {
    const snap = await snapshot(db);
    const { affected } = await execCounting(db, CR2_SQL);
    expect(affected).toBe(0);
    expect(await snapshot(db)).toEqual(snap);
  });

  it("a team outside barber/stylist is refused", async () => {
    await expect(db.exec("update public.services set team = 'nobody' where slug = 'kids'")).rejects.toThrow(/services_team_check/);
    await expect(db.exec("update public.staff set team = null where name = 'Barber A'")).rejects.toThrow(/null/);
  });
});
