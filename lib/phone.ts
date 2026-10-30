/**
 * Canadian (North American numbering plan) phone -> "+1XXXXXXXXXX".
 * Accepts "(613) 555-0199", "613-555-0199", "+1 613 555 0199", "1-613-555-0199".
 * Area code and exchange can't start with 0 or 1. Returns null otherwise.
 */
export function normalizePhone(raw: string): string | null {
  if (!/^[0-9+().\-\s]+$/.test(raw.trim())) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `+1${digits}`;
}

/** "+16135550199" -> "(613) 555-0199" for display. */
export function formatPhone(e164: string): string {
  const d = e164.replace(/^\+1/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : e164;
}
