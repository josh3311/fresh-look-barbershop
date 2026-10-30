import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { shop } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { todayIn } from "@/lib/server/booking-context";
import { getStaffAccess } from "@/lib/server/staff-auth";
import { loadUpcomingBookings } from "@/lib/server/staff-bookings";
import { SignOutButton, StaffDashboard } from "@/components/staff/StaffDashboard";

export const metadata: Metadata = { title: "Staff", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ staff?: string }> }) {
  const access = await getStaffAccess();
  if (access.state === "anonymous") redirect("/staff/login");
  if (access.state === "forbidden") {
    // Signed in, but not on STAFF_EMAILS: no booking data is loaded at all.
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-serif text-3xl">{t.staff.title}</h1>
        <p className="mt-4 text-muted">{t.staff.notStaff}</p>
        <div className="mt-8 flex justify-center">
          <SignOutButton />
        </div>
      </div>
    );
  }

  const { staff: staffParam } = await searchParams;
  const filter = staffParam && UUID.test(staffParam) ? staffParam : undefined;
  const { bookings, staff } = await loadUpcomingBookings(filter);

  return (
    <StaffDashboard bookings={bookings} staff={staff} filter={filter} email={access.email} today={todayIn(shop.timezone)} />
  );
}
