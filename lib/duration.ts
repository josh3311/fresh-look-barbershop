// The one place that decides how long a booking takes (spec 6.4).
// When Aubin gives exact times per style, set variant.durationMinutes (or
// service.baseDurationMinutes) and this rule stops being used for that style.

const LONG_SIZES = new Set(["xmicro", "micro", "xsmall", "small"]); // 3h
const MID_SIZES = new Set(["smedium", "medium"]); // 2h30
// Everything else (Large, XLarge, Jumbo, "2-4 cornrows", "5-6 lines", "More") = 2h

export function sizeRuleMinutes(label: string): number {
  const key = label.trim().toLowerCase();
  if (LONG_SIZES.has(key)) return 180;
  if (MID_SIZES.has(key)) return 150;
  return 120;
}

export interface DurationInput {
  service: { baseDurationMinutes: number | null };
  variant: { label: string; durationMinutes: number | null };
  addons?: { extraMinutes: number }[];
}

export function getDurationMinutes({ service, variant, addons = [] }: DurationInput): number {
  const base =
    variant.durationMinutes ?? service.baseDurationMinutes ?? sizeRuleMinutes(variant.label);
  return base + addons.reduce((sum, a) => sum + (a.extraMinutes || 0), 0);
}
