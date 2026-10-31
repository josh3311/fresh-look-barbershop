"use client";

// The day row and the time buttons of the "Pick a day and time" step.
import { t } from "@/lib/i18n";

export interface Slot {
  start: string;
  label: string;
}
export interface Day {
  date: string;
  slots: Slot[];
  /** The person (or, for "any", the whole team) has no working hours that day (CR2 A5). */
  notWorking?: boolean;
}

export function DateChip({ day, selected, onSelect }: { day: Day; selected: boolean; onSelect: () => void }) {
  const [y, m, dd] = day.date.split("-").map(Number);
  const local = new Date(y, m - 1, dd);
  const empty = day.slots.length === 0;
  const weekday = local.toLocaleDateString("en-CA", { weekday: "short" });
  const month = local.toLocaleDateString("en-CA", { month: "short" });
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      // A day off stays tappable so the customer can read why there are no times.
      disabled={empty && !day.notWorking}
      onClick={onSelect}
      title={day.notWorking ? t.book.notWorking : undefined}
      className={`w-[calc((100%-3rem)/7)] min-w-14 shrink-0 snap-start rounded-xl border py-2.5 text-center transition ${
        selected
          ? "border-gold bg-gold text-onyx"
          : day.notWorking
            ? "border-dashed border-line text-muted" // enabled, so no opacity: text keeps its contrast
            : empty
              ? "border-line opacity-35"
              : "border-line bg-surface hover:border-gold"
      }`}
    >
      <span className="block text-[11px] uppercase tracking-wide">{weekday}</span>
      <span className={`block font-serif text-xl ${day.notWorking ? "line-through" : ""}`}>{dd}</span>
      <span className="block text-[11px]">{month}</span>
      {day.notWorking && <span className="sr-only">{t.book.notWorking}</span>}
    </button>
  );
}

export function SlotArea({
  day,
  selected,
  onPick,
}: {
  day: Day | undefined;
  selected: string | null;
  onPick: (start: string) => void;
}) {
  if (day && day.slots.length) {
    return (
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {day.slots.map((s) => (
          <button
            key={s.start}
            type="button"
            onClick={() => onPick(s.start)}
            className={`rounded-lg border py-2.5 text-sm font-medium transition ${
              selected === s.start ? "border-gold bg-gold text-onyx" : "border-line bg-surface hover:border-gold"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    );
  }
  return <p className="py-6 text-center text-muted">{day?.notWorking ? t.book.notWorking : t.book.noTimes}</p>;
}
