import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { summarizeDay } from "@/lib/availability";
import { getAdminClient } from "@/lib/server/supabase";
import {
  computeAvailability,
  HttpError,
  loadEligibleStaff,
  loadSelection,
  todayIn,
} from "@/lib/server/booking-context";

export const dynamic = "force-dynamic";

const Query = z.object({
  serviceId: z.uuid(),
  variantId: z.uuid(),
  addonIds: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : []))
    .pipe(z.array(z.uuid()).max(10)),
  staffId: z.union([z.literal("any"), z.uuid()]).default("any"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Extra: how many days from `date` (default 1, max 60) so the stepper can grey out full days. */
  days: z.coerce.number().int().min(1).max(60).default(1),
});

// GET /api/availability?serviceId=&variantId=&addonIds=&staffId=&date=&days=
// Returns free start times only. Never booking details.
// days[]: { date, slots: [{ start, label }], notWorking }. notWorking = the chosen person
// (or, for "any", everyone on the service's team) has no working hours that day.
export async function GET(req: NextRequest) {
  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const q = parsed.data;

  try {
    const db = getAdminClient();
    const sel = await loadSelection(db, q);
    const people = await loadEligibleStaff(db, sel.service, q.staffId);
    const tz = sel.settings.timezone;
    const byDate = await computeAvailability(db, {
      staffIds: people.map((p) => p.id),
      fromDate: q.date ?? todayIn(tz),
      days: q.days,
      durationMinutes: sel.durationMinutes,
      settings: sel.settings,
      team: sel.team,
    });

    // For "anyone": a time shows if at least one person is free.
    const days = Object.entries(byDate).map(([date, perStaff]) => summarizeDay(date, perStaff, tz));

    return NextResponse.json(
      { timezone: tz, durationMinutes: sel.durationMinutes, days },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("availability failed", e);
    return NextResponse.json({ error: "Could not load times. Please try again." }, { status: 500 });
  }
}
