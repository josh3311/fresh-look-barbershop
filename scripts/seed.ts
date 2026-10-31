// Seeds the catalog, demo staff, demo hours and settings from data/services-seed.json.
//
//   npm run seed       -> upserts into Supabase, overwriting seeded rows (needs .env.local
//                         with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//   npm run seed:sql   -> writes supabase/seed.sql (paste into the SQL editor)
//   --build            -> used by `npm run build`: only adds missing rows (never
//                         overwrites the owner's edits), skips if keys are missing,
//                         and never fails the deploy.
//
// Staff emails: the seed only fills an email that is still empty (placeholders from
// lib/seed-rows.ts). It never overwrites a real email set in the database.
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildSeedRows, primaryKey, SEED_TABLES, toSql } from "../lib/seed-rows";

const buildMode = process.argv.includes("--build");

async function main() {
  const rows = buildSeedRows();

  if (process.argv.includes("--sql")) {
    writeFileSync("supabase/seed.sql", toSql(rows));
    console.log("Wrote supabase/seed.sql");
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (buildMode) return console.log("seed: Supabase keys not set, skipping");
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  // A staff member's schedule is all-or-nothing: in build mode, only add hours for
  // people who have none yet (row ids change when hours are edited or migrated).
  if (buildMode) {
    const { data, error } = await db.from("working_hours").select("staff_id");
    if (error) throw new Error(`working_hours: ${error.message}`);
    const scheduled = new Set((data ?? []).map((r) => r.staff_id));
    rows.working_hours = rows.working_hours.filter((r) => !scheduled.has(r.staff_id));
  }

  for (const table of SEED_TABLES) {
    if (!rows[table].length) continue;
    // Upsert staff without the email column, then fill only the empty emails below.
    const list = (rows[table] as Record<string, unknown>[]).map((r) => {
      if (table !== "staff") return r;
      const copy = { ...r };
      delete copy.email;
      return copy;
    });
    const { error } = await db.from(table).upsert(list, {
      onConflict: primaryKey(table).replace(" ", ""),
      ignoreDuplicates: buildMode,
    });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`seed: ${table} ${rows[table].length} rows`);
  }

  for (const person of rows.staff) {
    const { error } = await db.from("staff").update({ email: person.email }).eq("id", person.id).is("email", null);
    if (error) throw new Error(`staff email: ${error.message}`);
  }
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : e);
  if (!buildMode) process.exit(1);
});
