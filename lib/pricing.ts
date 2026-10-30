// Price estimate (spec 5.3). Used by the page for the live estimate AND by
// POST /api/bookings, which recalculates from database rows.

export interface PriceInput {
  variant: { priceCents: number | null; isConsult: boolean };
  addons: { priceCents: number | null; isFrom: boolean; isConsult: boolean }[];
  /** Steps past normal length (Waist = 1, Hip = 2, ...). */
  lengthSteps: number;
  extraLengthCents: number;
}

export interface Estimate {
  /** null when the base price is unknown. */
  cents: number | null;
  /** Show "from $X" (an add-on is "start at" or "to discuss"). */
  isFrom: boolean;
  /** Something chosen is "to discuss in the salon". */
  hasConsult: boolean;
  /** Base size has no price at all (e.g. Knotless Large): "Ask in salon". */
  askInSalon: boolean;
}

export function estimatePrice({ variant, addons, lengthSteps, extraLengthCents }: PriceInput): Estimate {
  const hasConsult = variant.isConsult || addons.some((a) => a.isConsult || a.priceCents == null);
  const isFrom = addons.some((a) => a.isFrom || a.isConsult || a.priceCents == null);
  if (variant.priceCents == null) {
    return { cents: null, isFrom, hasConsult, askInSalon: !variant.isConsult };
  }
  const addonCents = addons.reduce((sum, a) => sum + (a.priceCents ?? 0), 0);
  return {
    cents: variant.priceCents + Math.max(0, lengthSteps) * extraLengthCents + addonCents,
    isFrom,
    hasConsult,
    askInSalon: false,
  };
}

export function formatCents(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}
