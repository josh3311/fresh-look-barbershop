// Seeds the catalog, demo staff, demo hours and settings from data/services-seed.json.
//
//   npm run seed       -> upserts into Supabase, overwriting seeded rows (needs .env.local
//                         with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
//   npm run seed:sql   -> writes supabase/seed.sql (paste into the SQL editor)
//   --build            -> used by `npm run build`: only adds missing rows (never
//                         overwrites the owner's edits), skips if keys are missing,
//                         and never fails the deploy.
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

  for (const table of SEED_TABLES) {
    const { error } = await db.from(table).upsert(rows[table] as Record<string, unknown>[], {
      onConflict: primaryKey(table).replace(" ", ""),
      ignoreDuplicates: buildMode,
    });
    if (error) throw new Error(`${table}: ${error.message}`);
    console.log(`seed: ${table} ${rows[table].length} rows`);
  }
}

main().catch((e) => {
  console.error("seed failed:", e instanceof Error ? e.message : e);
  if (!buildMode) process.exit(1);
});
