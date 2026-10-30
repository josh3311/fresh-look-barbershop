// Live Supabase checks against the real project. Opt in:  LIVE_SUPABASE_TESTS=1 npm test
// Needs NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, and
// SUPABASE_SERVICE_ROLE_KEY for the TEST- booking round trip (deleted by id afterwards).
import { afterAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = process.env.LIVE_SUPABASE_TESTS === "1";
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
vi.setConfig({ testTimeout: 20_000 });

describe.skipIf(!live || !url || !anonKey)("RLS: the anon key cannot touch bookings", () => {
  const anon = () => createClient(url!, anonKey!, opts);

  it("cannot list bookings", async () => {
    const { data, error } = await anon().from("bookings").select("id, customer_name, customer_phone, customer_email").limit(5);
    expect(data ?? []).toEqual([]);
    expect(error?.code).toBe("42501"); // permission denied
  });

  it("cannot insert a booking directly (only the server API can)", async () => {
    const { error } = await anon().from("bookings").insert({
      staff_id: "00000000-0000-4000-8000-000000000000",
      service_id: "00000000-0000-4000-8000-000000000000",
      variant_id: "00000000-0000-4000-8000-000000000000",
      customer_name: "TEST-anon",
      customer_phone: "+16135550199",
      customer_email: "test@example.com",
      starts_at: "2030-01-01T15:00:00Z",
      ends_at: "2030-01-01T15:30:00Z",
    });
    expect(error?.code).toBe("42501");
  });

  it("still reads the public catalog", async () => {
    const { data, error } = await anon().from("services").select("id").limit(1);
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });
});

describe.skipIf(!live || !url || !anonKey || !serviceKey)("RLS: a TEST- booking stays hidden from anon", () => {
  const admin = () => createClient(url!, serviceKey!, opts);
  const anon = () => createClient(url!, anonKey!, opts);
  const created: string[] = [];

  afterAll(async () => {
    // Delete only what this test created, by id.
    for (const id of created) await admin().from("bookings").delete().eq("id", id);
  });

  it("anon cannot read a booking the server created", async () => {
    const [{ data: staff }, { data: variant }] = await Promise.all([
      admin().from("staff").select("id").limit(1).single(),
      admin().from("service_variants").select("id, service_id").limit(1).single(),
    ]);
    const { data, error } = await admin()
      .from("bookings")
      .insert({
        staff_id: staff!.id,
        service_id: variant!.service_id,
        variant_id: variant!.id,
        customer_name: "TEST-rls",
        customer_phone: "+16135550100",
        customer_email: "test-rls@example.com",
        starts_at: "2030-01-01T15:00:00Z",
        ends_at: "2030-01-01T15:30:00Z",
        status: "cancelled", // never blocks a real slot
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    created.push(data!.id);

    const res = await anon().from("bookings").select("id").eq("id", data!.id);
    expect(res.data ?? []).toEqual([]);
    expect(res.error?.code).toBe("42501");
  });
});
