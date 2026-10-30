import type { Metadata } from "next";
import { categoriesFor, rules, staffFor } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { LENGTH_OPTIONS } from "@/lib/lengths";
import { formatCents } from "@/lib/pricing";
import { StyleCard } from "@/components/ServiceCards";
import { Tabs } from "@/components/Tabs";
import { TeamGrid } from "@/components/Team";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Women / Femmes" };

export default function WomenPage() {
  const cats = categoriesFor("women");
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <SectionTitle title={t.women.title} />
      <Tabs
        accent="rose"
        tabs={cats.map((c) => ({
          id: c.slug,
          label: c.nameEn,
          content: (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {c.services.map((s) => (
                <StyleCard key={s.id} service={s} />
              ))}
            </div>
          ),
        }))}
      />

      <div className="mt-16 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-serif text-2xl">{t.women.sizeGuide}</h2>
          <p className="mt-3 text-sm font-medium tracking-wide text-rose-text">{t.women.sizes}</p>
          <p className="mt-3 text-muted">{t.women.sizeGuideText}</p>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            {rules.sizeGuideNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-serif text-2xl">{t.women.lengthGuide}</h2>
          <p className="mt-3 text-muted">{t.women.lengthGuideText}</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 text-sm">
            {LENGTH_OPTIONS.filter((l) => l.steps > 0 || l.label === "Normal").map((l) => (
              <li key={l.label} className="flex justify-between border-b border-line py-1.5">
                <span>{l.label}</span>
                <span className="font-medium text-gold-text">
                  {l.steps ? `+${formatCents(l.steps * rules.extraLengthCents)}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="mb-5 font-serif text-2xl">{t.women.stylists}</h2>
        <TeamGrid people={staffFor("women")} />
      </section>
    </div>
  );
}
