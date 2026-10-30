import type { Metadata } from "next";
import { categoriesFor, staffFor } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { menPhotos } from "@/lib/photos";
import { CutCard, StyleCard } from "@/components/ServiceCards";
import { Portfolio } from "@/components/Portfolio";
import { Tabs } from "@/components/Tabs";
import { TeamGrid } from "@/components/Team";
import { SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Men / Hommes" };

export default function MenPage() {
  const [cuts, styles] = categoriesFor("men");
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <SectionTitle title={t.men.title} />
      <Tabs
        tabs={[
          {
            id: "cuts",
            label: t.men.cutsTab,
            content: (
              <div className="grid gap-3 md:grid-cols-2">
                {cuts.services.map((s, i) => (
                  <CutCard key={s.id} service={s} badge={i === 0} />
                ))}
              </div>
            ),
          },
          {
            id: "styles",
            label: t.men.stylesTab,
            content: (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {styles.services.map((s) => (
                  <StyleCard key={s.id} service={s} />
                ))}
              </div>
            ),
          },
        ]}
      />

      <section className="mt-16">
        <h2 className="mb-5 font-serif text-2xl">{t.men.portfolio}</h2>
        <Portfolio photos={menPhotos} strip />
      </section>

      <section className="mt-16">
        <h2 className="mb-5 font-serif text-2xl">{t.men.barbers}</h2>
        <TeamGrid people={staffFor("men")} />
      </section>
    </div>
  );
}
