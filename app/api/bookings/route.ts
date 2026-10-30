import { NextResponse, type NextRequest } from "next/server";
import { getAdminClient } from "@/lib/server/supabase";
import { createBooking } from "@/lib/server/create-booking";

export const dynamic = "force-dynamic";

// POST /api/bookings: validation, price + availability re-check, insert, emails.
// See lib/server/create-booking.ts.
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const { status, body } = await createBooking(getAdminClient(), json);
    return NextResponse.json(body, { status });
  } catch {
    return NextResponse.json({ error: "Booking is not available right now." }, { status: 503 });
  }
}
