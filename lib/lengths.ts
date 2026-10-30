import seed from "@/data/services-seed.json";

export interface LengthOption {
  label: string;
  /** Steps past "Normal". Each step adds settings.extra_length_price_cents. */
  steps: number;
}

// Shorter than normal costs the same as normal (spec 5.3).
export const LENGTH_OPTIONS: LengthOption[] = [
  { label: "Neck", steps: 0 },
  { label: "Shoulder", steps: 0 },
  { label: "Normal", steps: 0 },
  ...seed.rules.length_steps_after_normal.map((label, i) => ({ label, steps: i + 1 })),
];

export const DEFAULT_LENGTH = "Normal";

export function lengthSteps(label: string | null | undefined): number | null {
  if (!label) return 0;
  const opt = LENGTH_OPTIONS.find((o) => o.label === label);
  return opt ? opt.steps : null;
}
