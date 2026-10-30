import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Staff", robots: { index: false } };

// Phase 2: Supabase magic-link login + dashboard.
export default function StaffLoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-serif text-3xl">{t.staff.title}</h1>
      <p className="mt-4 text-muted">{t.staff.soon}</p>
      <Link href="/" className="mt-8 inline-block underline underline-offset-4">
        {t.confirmed.backHome}
      </Link>
    </div>
  );
}
