"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { categoriesFor, findService, rules, shop, type Service, type Side } from "@/lib/catalog";
import { getDurationMinutes } from "@/lib/duration";
import { t } from "@/lib/i18n";
import { DEFAULT_LENGTH, LENGTH_OPTIONS, lengthSteps } from "@/lib/lengths";
import { normalizePhone } from "@/lib/phone";
import { estimatePrice, formatCents, type Estimate } from "@/lib/pricing";
import { Avatar } from "@/components/Team";
import { bilingual, FromPrice } from "@/components/ui";
import { resolveStaffChoice, staffChoicesFor } from "@/components/booking/staff-choices";
import { DateChip, SlotArea, type Day } from "@/components/booking/TimeSlots";

const TZ = shop.timezone;
type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface Details {
  name: string;
  phone: string;
  email: string;
  notes: string;
  website: string;
}

export function BookingStepper({
  initialSide,
  initialServiceId,
  initialStaffId,
}: {
  initialSide: Side | null;
  initialServiceId: string | null;
  initialStaffId: string;
}) {
  const router = useRouter();
  const initialService = initialServiceId ? findService(initialServiceId) : undefined;

  const [side, setSide] = useState<Side | null>(initialSide);
  const [serviceId, setServiceId] = useState<string | null>(initialService?.id ?? null);
  const [variantId, setVariantId] = useState<string | null>(
    initialService?.kind === "cut" ? initialService.variants[0].id : null,
  );
  const [lengthLabel, setLengthLabel] = useState(DEFAULT_LENGTH);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  // A preselected person (?staff=) who does not do this service falls back to "Anyone available".
  const [staffId, setStaffId] = useState(
    initialService ? resolveStaffChoice(initialService, initialStaffId) : initialStaffId,
  );
  const [slotStart, setSlotStart] = useState<string | null>(null);
  const [details, setDetails] = useState<Details>({ name: "", phone: "", email: "", notes: "", website: "" });
  const [step, setStep] = useState<Step>(
    !initialSide ? 1 : initialService?.kind === "cut" ? 3 : 2,
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const service = serviceId ? findService(serviceId) : undefined;
  const variant = service?.variants.find((v) => v.id === variantId);
  const addons = service?.addons.filter((a) => addonIds.includes(a.id)) ?? [];
  // Only the service's team (CR2 A4): cornrows from the Men side show the stylists.
  const people = service ? staffChoicesFor(service) : [];
  const chosenStaffId = service ? resolveStaffChoice(service, staffId) : staffId;
  const person = people.find((p) => p.id === chosenStaffId);

  const estimate: Estimate | null =
    service && variant
      ? estimatePrice({
          variant,
          addons,
          lengthSteps: service.lengthBased ? (lengthSteps(lengthLabel) ?? 0) : 0,
          extraLengthCents: rules.extraLengthCents,
        })
      : null;
  const duration = service && variant ? getDurationMinutes({ service, variant, addons }) : null;

  const go = (s: Step) => {
    setError(null);
    setStep(s);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function chooseSide(s: Side) {
    if (s !== side) {
      setServiceId(null);
      setVariantId(null);
      setAddonIds([]);
      setSlotStart(null);
    }
    setSide(s);
    go(2);
  }

  function chooseService(s: Service) {
    setServiceId(s.id);
    setStaffId((cur) => resolveStaffChoice(s, cur));
    setAddonIds([]);
    setLengthLabel(DEFAULT_LENGTH);
    setSlotStart(null);
    if (s.kind === "cut") {
      setVariantId(s.variants[0].id);
      go(3);
    } else {
      setVariantId(null);
    }
  }

  async function submit() {
    if (!service || !variant || !slotStart) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          variantId: variant.id,
          addonIds,
          lengthLabel: service.lengthBased ? lengthLabel : null,
          staffId: chosenStaffId,
          startsAt: slotStart,
          ...details,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.id) {
        router.push(`/book/confirmed/${body.id}`);
        return;
      }
      if (res.status === 409) {
        setSlotStart(null);
        setReloadKey((k) => k + 1);
        setStep(4);
        setError(body.error ?? t.book.errorTaken);
      } else if (res.status === 400 && body.fields) {
        setFieldErrors(Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, (v as string[])[0]])));
        setStep(5);
        setError(body.error ?? t.book.errorInvalid);
      } else {
        setError(body.error ?? t.book.errorGeneric);
      }
    } catch {
      setError(t.book.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-28">
      <Progress step={step} onJump={(s) => s < step && go(s)} />

      {error && (
        <p role="alert" className="mb-5 rounded-lg border border-rose bg-rose/15 px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {step === 1 && (
        <StepShell title={t.book.chooseSide}>
          <div className="grid grid-cols-2 gap-3">
            {(["men", "women"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => chooseSide(s)}
                className={`rounded-2xl border-2 px-4 py-10 font-serif text-2xl transition ${
                  side === s ? "border-gold bg-gold/10" : "border-line bg-surface hover:border-gold"
                }`}
              >
                {s === "men" ? t.hero.men : t.hero.women}
              </button>
            ))}
          </div>
        </StepShell>
      )}

      {step === 2 && side && (
        <StepShell title={service && service.kind === "style" ? t.book.chooseSize : t.book.chooseService} onBack={() => go(1)}>
          {service && service.kind === "style" ? (
            <StyleConfigurator
              service={service}
              variantId={variantId}
              setVariantId={setVariantId}
              lengthLabel={lengthLabel}
              setLengthLabel={setLengthLabel}
              addonIds={addonIds}
              setAddonIds={setAddonIds}
              onChangeStyle={() => {
                setServiceId(null);
                setVariantId(null);
              }}
              onContinue={() => go(3)}
            />
          ) : (
            <ServicePicker side={side} selectedId={serviceId} onPick={chooseService} />
          )}
        </StepShell>
      )}

      {step === 3 && service && (
        <StepShell title={t.book.choosePerson} onBack={() => go(2)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <PersonCard
              selected={chosenStaffId === "any"}
              onClick={() => {
                setStaffId("any");
                setSlotStart(null);
                go(4);
              }}
              title={t.book.anyone}
              sub={t.book.anyoneSub}
              avatar={<span className="grid h-14 w-14 place-items-center rounded-full bg-gold text-xl text-onyx">✦</span>}
            />
            {people.map((p) => (
              <PersonCard
                key={p.id}
                selected={chosenStaffId === p.id}
                onClick={() => {
                  setStaffId(p.id);
                  setSlotStart(null);
                  go(4);
                }}
                title={p.name}
                sub={p.team === "stylist" ? t.book.teamStylist : t.book.teamBarber}
                avatar={<Avatar person={p} size={56} />}
              />
            ))}
          </div>
        </StepShell>
      )}

      {step === 4 && service && variant && (
        <StepShell title={t.book.chooseTime} onBack={() => go(3)}>
          <TimePicker
            key={`${service.id}-${variant.id}-${addonIds.join(",")}-${chosenStaffId}-${reloadKey}`}
            query={{ serviceId: service.id, variantId: variant.id, addonIds, staffId: chosenStaffId }}
            selected={slotStart}
            onPick={(s) => {
              setSlotStart(s);
              go(5);
            }}
          />
        </StepShell>
      )}

      {step === 5 && (
        <StepShell title={t.book.yourDetails} onBack={() => go(4)}>
          <DetailsForm
            value={details}
            onChange={(d) => setDetails(d)}
            errors={fieldErrors}
            onSubmit={() => {
              const errs: Record<string, string> = {};
              if (!details.name.trim()) errs.name = t.book.required;
              if (!normalizePhone(details.phone)) errs.phone = t.book.errorPhone;
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) errs.email = t.book.errorEmail;
              setFieldErrors(errs);
              if (!Object.keys(errs).length) go(6);
            }}
          />
        </StepShell>
      )}

      {step === 6 && service && variant && slotStart && (
        <StepShell title={t.book.review} onBack={() => go(5)}>
          <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
            <Row label={t.book.service} value={bilingual(service)} />
            {service.kind === "style" && <Row label={t.book.size} value={variant.label} />}
            {service.lengthBased && <Row label={t.book.length} value={lengthLabel} />}
            {addons.length > 0 && <Row label={t.book.addons} value={addons.map((a) => a.name).join(", ")} />}
            <Row label={t.book.person} value={person?.name ?? t.book.anyone} />
            <Row label={t.book.date} value={formatInTimeZone(new Date(slotStart), TZ, "EEEE, MMMM d")} />
            <Row label={t.book.time} value={formatInTimeZone(new Date(slotStart), TZ, "h:mm a")} />
            {duration && <Row label={t.book.duration} value={formatDuration(duration)} />}
            <Row label={t.book.estimate} value={<EstimateText estimate={estimate} />} strong />
          </dl>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="mt-6 w-full rounded-full bg-gold py-4 text-lg font-semibold text-onyx shadow transition hover:brightness-110 disabled:opacity-60"
          >
            {submitting ? t.book.confirming : t.book.confirm}
          </button>
          <p className="mt-3 text-center text-sm text-muted">{t.book.noDeposit}</p>
        </StepShell>
      )}

      {service && step >= 2 && step <= 5 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {service.nameEn}
                {variant && service.kind === "style" ? ` · ${variant.label}` : ""}
              </p>
              <p className="text-xs text-muted">{t.book.estimateNote}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs uppercase tracking-wider text-muted">{t.book.estimate}</p>
              <p className="font-serif text-xl text-gold-text">
                {estimate ? <EstimateText estimate={estimate} /> : <FromPrice service={service} />}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function formatDuration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? String(m).padStart(2, "0") : ""}` : `${m} min`;
}

function EstimateText({ estimate }: { estimate: Estimate | null }) {
  if (!estimate) return null;
  if (estimate.askInSalon) return <>{t.book.askInSalon}</>;
  if (estimate.cents == null) return <>{t.book.toDiscuss}</>;
  return (
    <>
      {estimate.isFrom ? `${t.service.from} ` : ""}
      {formatCents(estimate.cents)}
      {estimate.hasConsult && <span className="block font-sans text-xs text-muted">{t.book.toDiscuss}</span>}
    </>
  );
}

function Progress({ step, onJump }: { step: Step; onJump: (s: Step) => void }) {
  return (
    <ol className="mb-8 grid grid-cols-6 gap-1.5" aria-label="Progress">
      {t.book.steps.map((label, i) => {
        const n = (i + 1) as Step;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={label}>
            <button
              type="button"
              onClick={() => onJump(n)}
              disabled={state !== "done"}
              aria-current={state === "current" ? "step" : undefined}
              className="w-full text-left"
            >
              <span className={`block h-1.5 rounded-full ${state === "todo" ? "bg-line" : "bg-gold"}`} />
              <span
                className={`mt-1.5 hidden text-xs sm:block ${state === "current" ? "font-semibold text-ink" : "text-muted"}`}
              >
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepShell({ title, onBack, children }: { title: string; onBack?: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-serif text-2xl">{title}</h2>
        {onBack && (
          <button type="button" onClick={onBack} className="text-sm text-muted underline-offset-4 hover:underline">
            ← {t.book.back}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ServicePicker({ side, selectedId, onPick }: { side: Side; selectedId: string | null; onPick: (s: Service) => void }) {
  const cats = categoriesFor(side);
  const [catId, setCatId] = useState(cats[0].id);
  const showTabs = side === "women";
  const visible = showTabs ? cats.filter((c) => c.id === catId) : cats;
  return (
    <div>
      {showTabs && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          {cats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCatId(c.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${
                c.id === catId ? "border-rose bg-rose/20 font-medium" : "border-line"
              }`}
            >
              {c.nameEn}
            </button>
          ))}
        </div>
      )}
      {visible.map((c) => (
        <div key={c.id} className="mb-6">
          {!showTabs && <h3 className="mb-3 text-xs uppercase tracking-wider text-muted">{bilingual(c)}</h3>}
          <ul className="space-y-2">
            {c.services.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-surface p-4 text-left transition hover:border-gold ${
                    selectedId === s.id ? "border-gold" : "border-line"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block font-medium">{bilingual(s)}</span>
                    <span className="block text-sm text-muted">
                      {s.team === "barber" &&
                        `${t.service.aboutMin.replace("{n}", String(getDurationMinutes({ service: s, variant: s.variants[0] })))} · `}
                      <FromPrice service={s} />
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
                    {t.book.select}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function StyleConfigurator(props: {
  service: Service;
  variantId: string | null;
  setVariantId: (id: string) => void;
  lengthLabel: string;
  setLengthLabel: (l: string) => void;
  addonIds: string[];
  setAddonIds: (ids: string[]) => void;
  onChangeStyle: () => void;
  onContinue: () => void;
}) {
  const { service, variantId, setVariantId, lengthLabel, setLengthLabel, addonIds, setAddonIds } = props;
  const chip = (on: boolean) =>
    `rounded-xl border px-3 py-2.5 text-left text-sm transition ${on ? "border-gold bg-gold/15" : "border-line bg-surface hover:border-gold"}`;
  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-oak-soft p-4">
        <p className="font-serif text-lg">{bilingual(service)}</p>
        <button type="button" onClick={props.onChangeStyle} className="shrink-0 text-sm underline underline-offset-4">
          {t.book.change}
        </button>
      </div>

      <fieldset>
        <legend className="mb-3 font-medium">{t.book.chooseSize}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {service.variants.map((v) => (
            <button key={v.id} type="button" className={chip(v.id === variantId)} onClick={() => setVariantId(v.id)} aria-pressed={v.id === variantId}>
              <span className="block font-medium">{v.label}</span>
              <span className="block text-gold-text">
                {v.priceCents != null ? formatCents(v.priceCents) : v.isConsult ? t.service.toDiscuss : t.service.askInSalon}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {service.lengthBased && (
        <fieldset>
          <legend className="mb-1 font-medium">{t.book.chooseLength}</legend>
          <p className="mb-3 text-sm text-muted">{t.book.normalLength}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {LENGTH_OPTIONS.map((l) => (
              <button key={l.label} type="button" className={chip(l.label === lengthLabel)} onClick={() => setLengthLabel(l.label)} aria-pressed={l.label === lengthLabel}>
                <span className="block font-medium">{l.label}</span>
                <span className="block text-xs text-muted">{l.steps ? `+${formatCents(l.steps * rules.extraLengthCents)}` : "+$0"}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {service.addons.length > 0 && (
        <fieldset>
          <legend className="mb-3 font-medium">{t.book.chooseAddons}</legend>
          <div className="space-y-2">
            {service.addons.map((a) => {
              const on = addonIds.includes(a.id);
              return (
                <label key={a.id} className={`flex cursor-pointer items-center justify-between gap-3 ${chip(on)}`}>
                  <span className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--gold)]"
                      checked={on}
                      onChange={() => setAddonIds(on ? addonIds.filter((x) => x !== a.id) : [...addonIds, a.id])}
                    />
                    {a.name}
                  </span>
                  <span className="text-gold-text">
                    {a.priceCents == null || a.isConsult
                      ? t.service.toDiscuss
                      : `${a.isFrom ? `${t.service.startAt} ` : ""}+${formatCents(a.priceCents)}`}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      <button
        type="button"
        disabled={!variantId}
        onClick={props.onContinue}
        className="w-full rounded-full bg-ink py-3.5 font-semibold text-paper transition hover:bg-gold hover:text-onyx disabled:opacity-40"
      >
        {t.book.next}
      </button>
    </div>
  );
}

function PersonCard(props: { selected: boolean; onClick: () => void; title: string; sub: string; avatar: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      className={`flex items-center gap-4 rounded-xl border bg-surface p-4 text-left transition hover:border-gold ${
        props.selected ? "border-gold ring-1 ring-gold" : "border-line"
      }`}
    >
      {props.avatar}
      <span>
        <span className="block font-serif text-lg">{props.title}</span>
        <span className="block text-sm text-muted">{props.sub}</span>
      </span>
    </button>
  );
}

function TimePicker({
  query,
  selected,
  onPick,
}: {
  query: { serviceId: string; variantId: string; addonIds: string[]; staffId: string };
  selected: string | null;
  onPick: (start: string) => void;
}) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(selected ? formatInTimeZone(new Date(selected), TZ, "yyyy-MM-dd") : null);

  const qs = useMemo(
    () =>
      new URLSearchParams({
        serviceId: query.serviceId,
        variantId: query.variantId,
        addonIds: query.addonIds.join(","),
        staffId: query.staffId,
        days: "60",
      }).toString(),
    [query.serviceId, query.variantId, query.addonIds, query.staffId],
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/availability?${qs}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? t.book.errorGeneric);
        return body.days as Day[];
      })
      .then((d) => {
        if (cancelled) return;
        setDays(d);
        setDate((cur) => cur ?? d.find((x) => x.slots.length)?.date ?? d[0]?.date ?? null);
      })
      .catch((e: Error) => !cancelled && setFailed(e.message));
    return () => {
      cancelled = true;
    };
  }, [qs]);

  if (failed) return <p className="rounded-lg border border-rose bg-rose/15 p-4 text-sm">{failed}</p>;
  if (!days) return <p className="py-10 text-center text-muted">{t.book.loadingTimes}</p>;

  const current = days.find((d) => d.date === date);
  return (
    <div>
      <div className="no-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2" role="listbox" aria-label={t.book.date}>
        {days.map((d) => (
          <DateChip key={d.date} day={d} selected={d.date === date} onSelect={() => setDate(d.date)} />
        ))}
      </div>

      <div className="mt-5">
        <SlotArea day={current} selected={selected} onPick={onPick} />
      </div>
    </div>
  );
}

function DetailsForm({
  value,
  onChange,
  errors,
  onSubmit,
}: {
  value: Details;
  onChange: (d: Details) => void;
  errors: Record<string, string>;
  onSubmit: () => void;
}) {
  const field = "mt-1 w-full rounded-lg border bg-surface px-3 py-3 text-base outline-none focus:border-gold";
  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [k]: e.target.value });
  const err = (k: string) =>
    errors[k] && (
      <span className="mt-1 block text-sm text-rose-text" role="alert">
        {errors[k]}
      </span>
    );
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <label className="block">
        <span className="text-sm font-medium">{t.book.name} *</span>
        <input className={`${field} ${errors.name ? "border-rose" : "border-line"}`} value={value.name} onChange={set("name")} autoComplete="name" maxLength={80} required />
        {err("name")}
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.book.phone} *</span>
        <input className={`${field} ${errors.phone ? "border-rose" : "border-line"}`} value={value.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} required />
        {err("phone")}
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.book.email} *</span>
        <input className={`${field} ${errors.email ? "border-rose" : "border-line"}`} value={value.email} onChange={set("email")} type="email" inputMode="email" autoComplete="email" maxLength={254} required />
        <span className="mt-1 block text-xs text-muted">{t.book.emailHelp}</span>
        {err("email")}
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.book.notes}</span>
        <textarea className={`${field} border-line`} rows={3} value={value.notes} onChange={set("notes")} maxLength={500} placeholder={t.book.notesPlaceholder} />
        {err("notes")}
      </label>
      {/* Honeypot: hidden from people, bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={value.website} onChange={set("website")} />
        </label>
      </div>
      <button type="submit" className="w-full rounded-full bg-ink py-3.5 font-semibold text-paper transition hover:bg-gold hover:text-onyx">
        {t.book.next}
      </button>
    </form>
  );
}

function Row({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`text-right ${strong ? "font-serif text-xl text-gold-text" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
