// Services with choice groups (Hair Color: kind, then colour). Each group is required;
// the picks resolve to exactly one variant, and only then can the customer continue.
import type { Service } from "@/lib/catalog";

export type ChoicePicks = Record<string, string>;

/** The variant matching one pick per group, or null while any group is still empty. */
export function resolveChoiceVariant(service: Pick<Service, "choiceGroups" | "variants">, picks: ChoicePicks): string | null {
  if (!service.choiceGroups.length) return null;
  if (service.choiceGroups.some((g) => !picks[g.key])) return null;
  const match = service.variants.find(
    (v) => v.choices && service.choiceGroups.every((g) => v.choices![g.key] === picks[g.key]),
  );
  return match?.id ?? null;
}

