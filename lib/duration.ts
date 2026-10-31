// The one place that decides how long a booking blocks (spec 6.4).
//
// Change Request #2 (Oct 31): the minutes are data now.
//   Barbers: Classic 35, Haircut & Beard Trim 45, Kids 30, Beard 15, Outline 15
//            (services.base_duration_minutes / duration_min in services-seed.json).
//   Stylists: every braid / twist / loc / cornrow service blocks 60 min
//            (base_duration_minutes = 60). This replaced the old 180/150/120 size rule.
// When Aubin sends real times per style, set variant.durationMinutes (one size) or
// service.baseDurationMinutes (the whole style). Nothing else needs to change.
import type { Team } from "@/lib/catalog";

/**
 * Used only when the data has no minutes at all for a stylist service: the 60-min stylist
 * block Aubin confirmed. Remove it once every style has its own minutes.
 * A barber service with no minutes is a data error and throws: never guess a haircut length.
 */
export const STYLIST_FALLBACK_MINUTES = 60;

export interface DurationInput {
  service: { baseDurationMinutes: number | null; team?: Team };
  variant: { durationMinutes: number | null };
  addons?: { extraMinutes: number }[];
}

export function getDurationMinutes({ service, variant, addons = [] }: DurationInput): number {
  const base =
    variant.durationMinutes ??
    service.baseDurationMinutes ??
    (service.team === "stylist" ? STYLIST_FALLBACK_MINUTES : null);
  if (base == null) throw new Error("Service has no duration (set base_duration_minutes)");
  return base + addons.reduce((sum, a) => sum + (a.extraMinutes || 0), 0);
}
