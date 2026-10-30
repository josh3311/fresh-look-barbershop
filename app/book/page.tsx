import type { Metadata } from "next";
import { findService, staff, type Side } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { BookingStepper } from "@/components/booking/BookingStepper";

export const metadata: Metadata = { title: "Book / Réserver" };

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function BookPage({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const service = one("service") ? findService(one("service")!) : undefined;
  const person = staff.find((s) => s.id === one("staff"));
  const sideParam = one("side");
  const side: Side | null =
    service?.side ??
    (sideParam === "men" || sideParam === "women" ? sideParam : null) ??
    (person && person.side !== "both" ? person.side : null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <h1 className="mb-6 text-center font-serif text-3xl sm:text-4xl">{t.book.title}</h1>
      <BookingStepper initialSide={side} initialServiceId={service?.id ?? null} initialStaffId={person?.id ?? "any"} />
    </div>
  );
}
