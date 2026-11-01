"use client";

import Link from "next/link";
import { useState } from "react";
import type { Service } from "@/lib/catalog";
import { choiceLabel, t } from "@/lib/i18n";
import { formatCents } from "@/lib/pricing";
import { getDurationMinutes } from "@/lib/duration";
import { bilingual, FromPrice, PhotoOrPlaceholder } from "@/components/ui";

const bookHref = (s: Service) => `/book?side=${s.side}&service=${s.id}`;

/** Square-style row: name (EN / FR), time, price, Book. */
export function CutCard({ service, badge }: { service: Service; badge?: boolean }) {
  const v = service.variants[0];
  return (
    <article className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="min-w-0">
        {badge && v.priceCents != null && (
          <span className="mb-2 inline-block rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-onyx">
            {t.men.fromBadge} {formatCents(v.priceCents)}
          </span>
        )}
        <h3 className="font-serif text-lg leading-snug">{bilingual(service)}</h3>
        <p className="mt-1 text-sm text-muted">
          {/* "about 35 min": barber cuts only (owner decision, CR2 A2); style cards show no time. */}
          {service.team === "barber" && (
            <>{t.service.aboutMin.replace("{n}", String(getDurationMinutes({ service, variant: v })))} · </>
          )}
          <FromPrice service={service} />
        </p>
      </div>
      <Link
        href={bookHref(service)}
        className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper transition hover:bg-gold hover:text-onyx"
      >
        {t.service.book}
      </Link>
    </article>
  );
}

function priceCell(v: Service["variants"][number]) {
  if (v.priceCents != null) return formatCents(v.priceCents);
  return v.isConsult ? t.service.toDiscuss : t.service.askInSalon;
}

function addonPrice(a: Service["addons"][number]) {
  if (a.priceCents == null || a.isConsult) return t.service.toDiscuss;
  return `${a.isFrom ? `${t.service.startAt} ` : ""}+${formatCents(a.priceCents)}`;
}

/**
 * Hair Color: the price table lists the kinds (Color only $50, Color + haircut $75), then the
 * colours to choose from, instead of all 8 kind x colour combinations.
 */
function ChoiceTable({ service }: { service: Service }) {
  return (
    <div className="mt-4 space-y-4 text-sm">
      {service.choiceGroups.map((g) =>
        g.options.some((o) => o.priceCents != null) ? (
          <table key={g.key} className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="pb-1 font-medium">{t.service.kind}</th>
                <th className="pb-1 text-right font-medium">{t.service.price}</th>
              </tr>
            </thead>
            <tbody>
              {g.options.map((o) => (
                <tr key={o.label} className="border-t border-line">
                  <td className="py-1.5">{choiceLabel(o.label)}</td>
                  <td className="py-1.5 text-right font-medium text-gold-text">
                    {o.priceCents != null ? formatCents(o.priceCents) : t.service.askInSalon}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div key={g.key}>
            <p className="text-xs uppercase tracking-wider text-muted">{t.service.colors}</p>
            <p className="mt-1 border-t border-line py-1.5">{g.options.map((o) => choiceLabel(o.label)).join(" · ")}</p>
          </div>
        ),
      )}
    </div>
  );
}

/** Style card: photo, name, "from $X", Book. Tap to open the full price table + add-ons. */
export function StyleCard({ service }: { service: Service }) {
  const [open, setOpen] = useState(false);
  const accent = service.side === "women" ? "rose" : "gold";
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-left"
        aria-label={`${service.nameEn}: ${open ? t.service.hide : t.service.details}`}
      >
        <PhotoOrPlaceholder
          src={service.imageUrl}
          alt={service.nameEn}
          label={service.nameEn}
          accent={accent}
          className={service.imageUrl ? "aspect-[4/3] w-full" : "aspect-[3/1] w-full sm:aspect-[4/3]"}
        />
      </button>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-serif text-lg leading-snug">{bilingual(service)}</h3>
        <p className="mt-1 text-sm text-muted">
          <FromPrice service={service} />
        </p>

        {open && service.choiceGroups.length > 0 && <ChoiceTable service={service} />}

        {open && !service.choiceGroups.length && (
          <div className="mt-4 space-y-4 text-sm">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="pb-1 font-medium">{t.service.size}</th>
                  <th className="pb-1 text-right font-medium">{t.service.price}</th>
                </tr>
              </thead>
              <tbody>
                {service.variants.map((v) => (
                  <tr key={v.id} className="border-t border-line">
                    <td className="py-1.5">{v.label}</td>
                    <td className="py-1.5 text-right font-medium text-gold-text">{priceCell(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {service.addons.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">{t.service.addons}</p>
                <ul className="mt-1">
                  {service.addons.map((a) => (
                    <li key={a.id} className="flex justify-between border-t border-line py-1.5">
                      <span>{a.name}</span>
                      <span className="font-medium text-gold-text">{addonPrice(a)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-sm text-muted underline-offset-4 hover:underline"
          >
            {open ? t.service.hide : t.service.details}
          </button>
          <Link
            href={bookHref(service)}
            className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper transition hover:bg-gold hover:text-onyx"
          >
            {t.service.book}
          </Link>
        </div>
      </div>
    </article>
  );
}
