import Image from "next/image";
import Link from "next/link";
import { categoriesFor, staff, type Service } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { menPhotos, womenPhotos } from "@/lib/photos";
import { Portfolio } from "@/components/Portfolio";
import { TeamGrid } from "@/components/Team";
import { VisitUs } from "@/components/VisitUs";
import { bilingual, FromPrice, SectionTitle } from "@/components/ui";

const pick = (side: "men" | "women", slugs: string[]) =>
  slugs
    .map((slug) => categoriesFor(side).flatMap((c) => c.services).find((s) => s.slug === slug))
    .filter((s): s is Service => !!s);

const menExamples = pick("men", ["classic-haircut", "haircut-beard-trim", "simple-cornrows"]);
const womenExamples = pick("women", ["knotless-braids", "passion-twists-human-hair-twist", "french-curl-braids"]);

function Door({
  href,
  title,
  text,
  examples,
  accent,
  image,
}: {
  href: string;
  title: string;
  text: string;
  examples: Service[];
  accent: "gold" | "rose";
  image: React.ReactNode;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-surface">
      <Link href={href} className="relative block aspect-[4/3] overflow-hidden">
        {image}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        <h3 className="absolute bottom-4 left-5 font-serif text-4xl text-ivory">{title}</h3>
      </Link>
      <div className="p-5">
        <p className="text-muted">{text}</p>
        <ul className="mt-4 divide-y divide-line">
          {examples.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
              <span>{bilingual(s)}</span>
              <span className="shrink-0 text-muted">
                <FromPrice service={s} />
              </span>
            </li>
          ))}
        </ul>
        <Link
          href={href}
          className={`mt-4 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline ${
            accent === "rose" ? "text-rose-text" : "text-gold-text"
          }`}
        >
          {t.doors.seeAll} →
        </Link>
      </div>
    </article>
  );
}

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[78dvh] items-center justify-center overflow-hidden">
        <Image
          src="/images/salon.jpg"
          alt="Inside Fresh Look: black chairs, white walls, wood floor and gold lamps"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-black/60" />
        <div className="px-4 py-20 text-center text-ivory">
          <p className="text-xs uppercase tracking-[0.35em] text-gold">Ottawa · Rideau St</p>
          <h1 className="mt-4 font-serif text-6xl sm:text-8xl">{t.hero.title}</h1>
          <div className="gold-rule mx-auto mt-5 max-w-[16rem]" aria-hidden>
            <span className="text-xs">✦</span>
          </div>
          <p className="mt-5 text-lg text-ivory/85 sm:text-xl">{t.hero.subtitle}</p>
          <div className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-3">
            <Link
              href="/book?side=men"
              className="rounded-full bg-gold px-4 py-4 text-base font-semibold text-onyx shadow-lg transition hover:brightness-110"
            >
              {t.hero.men}
            </Link>
            <Link
              href="/book?side=women"
              className="rounded-full border border-ivory/80 bg-white/5 px-4 py-4 text-base font-semibold text-ivory backdrop-blur transition hover:bg-ivory hover:text-onyx"
            >
              {t.hero.women}
            </Link>
          </div>
        </div>
      </section>

      {/* Two doors */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <SectionTitle title={t.doors.heading} />
        <div className="grid gap-6 md:grid-cols-2">
          <Door
            href="/men"
            title={t.doors.menTitle}
            text={t.doors.menText}
            examples={menExamples}
            accent="gold"
            image={
              <Image
                src="/images/men/cut-1.jpg"
                alt="Men's haircut"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-top transition duration-700 group-hover:scale-105"
              />
            }
          />
          <Door
            href="/women"
            title={t.doors.womenTitle}
            text={t.doors.womenText}
            examples={womenExamples}
            accent="rose"
            image={
              <Image
                src="/images/women/women-boho-curls.jpg"
                alt="Boho knotless braids with caramel curly ends"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition duration-700 group-hover:scale-105"
                style={{ objectPosition: "center 30%" }}
              />
            }
          />
        </div>
      </section>

      {/* Portfolio */}
      <section className="bg-oak-soft py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title={t.portfolio.heading} sub={t.portfolio.sub} />
          <h3 className="mb-4 font-serif text-2xl">{t.portfolio.men}</h3>
          <Portfolio photos={menPhotos} />
          <h3 className="mb-4 mt-12 font-serif text-2xl">{t.portfolio.women}</h3>
          <Portfolio photos={womenPhotos} columns={4} />
        </div>
      </section>

      {/* Team */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <SectionTitle id="team" title={t.team.heading} sub={t.team.sub} />
        <TeamGrid people={staff} />
      </section>

      {/* About */}
      <section className="border-y border-line bg-surface py-16">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="font-serif text-3xl">{t.about.heading}</h2>
          <p className="mt-5 text-lg leading-relaxed text-muted">{t.about.text}</p>
        </div>
      </section>

      {/* Visit us */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <SectionTitle id="visit" title={t.visit.heading} />
        <VisitUs />
      </section>
    </>
  );
}
