import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { t } from "@/lib/i18n";
import { getStaffAccess } from "@/lib/server/staff-auth";
import { LoginForm } from "@/components/staff/LoginForm";

export const metadata: Metadata = { title: "Staff login", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await getStaffAccess()).state === "staff") redirect("/staff");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:py-24">
      <h1 className="text-center font-serif text-3xl">{t.staff.loginTitle}</h1>
      <p className="mt-3 text-center text-muted">{t.staff.loginText}</p>
      {error === "link" && (
        <p role="alert" className="mt-6 rounded-lg border border-rose bg-rose/15 px-4 py-3 text-sm">
          {t.staff.linkError}
        </p>
      )}
      <LoginForm />
    </div>
  );
}
