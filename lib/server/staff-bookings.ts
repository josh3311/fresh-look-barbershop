import "server-only";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { shop } from "@/lib/catalog";
import { getAdminClient } from "@/lib/server/supabase";
import { todayIn } from "@/lib/server/booking-context";

export interface StaffBooking {
  id: string;
  startsAt: Date;
  endsAt: Date;
  date: string;
  staffId: string;
  staffName: string;
  service: string;
  addons: string[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string | null;
}

interface Row {
  id: string;
  starts_at: string;
  ends_at: string;
  length_label: string | null;
  addon_ids: string[];
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  notes: string | null;
  staff: { id: string; name: string } | null;
  service: { name_en: string } | null;
  variant: { label: string } | null;
}

/** Today (from midnight, salon time) and upcoming "booked" bookings. Service role: call only after a staff check. */
export async function loadUpcomingBookings(staffId?: string) {
  const db = getAdminClient();
  const tz = shop.timezone;
  const from = fromZonedTime(`${todayIn(tz)}T00:00:00`, tz).toISOString();

  let query = db
    .from("bookings")
    .select(
      "id, starts_at, ends_at, length_label, addon_ids, customer_name, customer_phone, customer_email, notes, staff:staff_id (id, name), service:service_id (name_en), variant:variant_id (label)",
    )
    .eq("status", "booked")
    .gte("starts_at", from)
    .order("starts_at", { ascending: true })
    .limit(500);
  if (staffId) query = query.eq("staff_id", staffId);

  const [{ data, error }, staffRes] = await Promise.all([
    query,
    db.from("staff").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  if (error) throw new Error(`bookings: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];

  const addonIds = [...new Set(rows.flatMap((r) => r.addon_ids ?? []))];
  const addonNames = new Map<string, string>();
  if (addonIds.length) {
    const { data: addons } = await db.from("service_addons").select("id, name").in("id", addonIds);
    for (const a of addons ?? []) addonNames.set(a.id, a.name);
  }

  const bookings: StaffBooking[] = rows.map((r) => {
    const startsAt = new Date(r.starts_at);
    const size = r.variant && r.variant.label !== "Standard" ? r.variant.label : null;
    return {
      id: r.id,
      startsAt,
      endsAt: new Date(r.ends_at),
      date: formatInTimeZone(startsAt, tz, "yyyy-MM-dd"),
      staffId: r.staff?.id ?? "",
      staffName: r.staff?.name ?? "—",
      service: [r.service?.name_en ?? "—", size, r.length_label].filter(Boolean).join(" · "),
      addons: (r.addon_ids ?? []).map((id) => addonNames.get(id)).filter((n): n is string => !!n),
      customerName: r.customer_name,
      customerPhone: r.customer_phone,
      customerEmail: r.customer_email,
      notes: r.notes,
    };
  });

  return { bookings, staff: (staffRes.data ?? []) as { id: string; name: string }[] };
}
