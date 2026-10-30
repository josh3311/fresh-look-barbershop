import Image from "next/image";
import type { Service } from "@/lib/catalog";
import { fromPriceCents } from "@/lib/catalog";
import { t } from "@/lib/i18n";
import { formatCents } from "@/lib/pricing";

export function SectionTitle({ title, sub, id }: { title: string; sub?: string; id?: string }) {
  return (
    <div id={id} className="mb-8 text-center">
      <h2 className="font-serif text-3xl sm:text-4xl">{title}</h2>
      <div className="gold-rule mx-auto mt-4 max-w-xs" aria-hidden>
        <span className="text-xs">✦</span>
      </div>
      {sub && <p className="mt-4 text-muted">{sub}</p>}
    </div>
  );
}

/** Neutral oak box with the service name when a photo is missing (spec 8). */
export function PhotoOrPlaceholder({
  src,
  alt,
  label,
  accent = "gold",
  className = "",
  sizes = "(max-width: 640px) 100vw, 33vw",
}: {
  src: string | null;
  alt: string;
  label: string;
  accent?: "gold" | "rose";
  className?: string;
  sizes?: string;
}) {
  if (src) {
    return (
      <div className={`relative overflow-hidden bg-oak ${className}`}>
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-oak-soft p-4 text-center ${className}`}
      role="img"
      aria-label={`${label}: ${t.service.photoSoon}`}
    >
      <div
        className={`absolute inset-3 rounded-sm border ${accent === "rose" ? "border-rose/60" : "border-gold/50"}`}
        aria-hidden
      />
      <div>
        <span className={`block text-2xl ${accent === "rose" ? "text-rose" : "text-gold"}`} aria-hidden>
          ✦
        </span>
        <span className="mt-2 block font-serif text-lg leading-snug">{label}</span>
      </div>
    </div>
  );
}

export function bilingual(s: Pick<Service, "nameEn" | "nameFr">) {
  return s.nameFr && s.nameFr !== s.nameEn ? `${s.nameEn} / ${s.nameFr}` : s.nameEn;
}

export function FromPrice({ service }: { service: Service }) {
  const cents = fromPriceCents(service);
  if (cents == null) return <span>{t.service.askInSalon}</span>;
  return (
    <span>
      {service.kind === "cut" ? "" : `${t.service.from} `}
      <span className="font-semibold text-gold-text">{formatCents(cents)}</span>
    </span>
  );
}
