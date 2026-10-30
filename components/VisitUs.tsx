import { shop } from "@/lib/catalog";
import { t } from "@/lib/i18n";

export function VisitUs() {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(shop.address)}&output=embed`;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <dl className="space-y-5 rounded-xl border border-line bg-surface p-6">
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">{t.visit.address}</dt>
          <dd className="mt-1 font-serif text-lg">{shop.address}</dd>
          <dd className="mt-2">
            <a
              href={shop.directionsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-gold-text underline-offset-4 hover:underline"
            >
              {t.visit.directions} →
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">{t.visit.hours}</dt>
          <dd className="mt-1 font-serif text-lg">{t.visit.hoursSummary}</dd>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wider text-muted">{t.visit.phone}</dt>
            <dd className="mt-1">
              <a href={shop.phoneHref} className="font-medium text-gold-text underline-offset-4 hover:underline">
                {shop.phone}
              </a>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wider text-muted">{t.visit.email}</dt>
            <dd className="mt-1 break-all">
              <a href={`mailto:${shop.email}`} className="font-medium text-gold-text underline-offset-4 hover:underline">
                {shop.email}
              </a>
            </dd>
          </div>
        </div>
      </dl>
      <iframe
        title={t.visit.mapTitle}
        src={mapSrc}
        className="h-80 w-full rounded-xl border border-line md:h-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
