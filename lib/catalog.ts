// The service catalog, built once from data/services-seed.json.
// Pages, the booking stepper and the seed script all read from here, so prices
// are never retyped by hand.
import seed from "@/data/services-seed.json";
import { slugify, stableId } from "@/lib/ids";

export type Side = "men" | "women";
export type StaffSide = Side | "both";
/**
 * Who does a service (Change Request #2, Oct 31). "barber" = Barber A, B (haircuts);
 * "stylist" = Barber C, D (every braid / twist / loc / French curl / cornrow service,
 * on both sides). `side` only says which page shows a service or a person.
 */
export type Team = "barber" | "stylist";
export const TEAMS: readonly Team[] = ["barber", "stylist"];

export interface Variant {
  id: string;
  label: string;
  priceCents: number | null;
  /** "to discuss" in the salon. A blank price that is not consult shows "Ask in salon". */
  isConsult: boolean;
  durationMinutes: number | null;
  sortOrder: number;
  /**
   * For a service with choice groups (Hair Color): the option picked in each group,
   * e.g. { kind: "Color only", color: "White" }. null for ordinary sizes.
   */
  choices: Record<string, string> | null;
}

/** One required option group (Hair Color: "kind", then "color"). Every combination is one variant. */
export interface ChoiceGroup {
  key: string;
  options: { label: string; priceCents: number | null; durationMinutes: number | null }[];
}

export interface Addon {
  id: string;
  name: string;
  priceCents: number | null;
  isFrom: boolean;
  isConsult: boolean;
  extraMinutes: number;
}

export interface Service {
  id: string;
  slug: string;
  categoryId: string;
  side: Side;
  /** Which team does it (from the category's "team" in services-seed.json). */
  team: Team;
  /** "cut" = fixed price + fixed time (men's cuts). "style" = sizes, add-ons, maybe length. */
  kind: "cut" | "style";
  nameEn: string;
  nameFr: string;
  imageUrl: string | null;
  baseDurationMinutes: number | null;
  /** Shows the length picker (+$15 per step past mid-back). */
  lengthBased: boolean;
  variants: Variant[];
  addons: Addon[];
  sortOrder: number;
  /**
   * Required option groups shown instead of the size picker (Hair Color: kind, then colour).
   * Empty for every other service.
   */
  choiceGroups: ChoiceGroup[];
  /**
   * Staff keys (staff_demo "key", e.g. "barber-a") who do this service, inside its team.
   * null = everyone on the team. Hair Color = ["barber-a"] (Noël only, Aubin Nov 1).
   */
  onlyStaffKeys: string[] | null;
}

export interface Category {
  id: string;
  slug: string;
  side: Side;
  team: Team;
  nameEn: string;
  nameFr: string;
  sortOrder: number;
  services: Service[];
}

export interface StaffMember {
  id: string;
  slug: string;
  name: string;
  /** Which page shows the person (Men / Women). */
  side: StaffSide;
  /** Which services they do. Emails are private: they are never in the catalog (it reaches the browser). */
  team: Team;
  photoUrl: string | null;
  sortOrder: number;
}

interface RawVariant {
  size: string;
  price: number | null;
  consult?: boolean;
  note?: string;
}
interface RawAddon {
  name: string;
  price: number | null;
  from?: boolean;
  consult?: boolean;
}
interface RawChoiceOption {
  label: string;
  price?: number | null;
  duration_min?: number | null;
}
interface RawChoiceGroup {
  key: string;
  options: RawChoiceOption[];
}
interface RawService {
  name?: string;
  name_en?: string;
  name_fr?: string;
  price?: number;
  duration_min: number | null;
  variants?: RawVariant[];
  addons?: RawAddon[];
  /** Staff keys (never names or emails). */
  only_staff?: string[];
  choices?: RawChoiceGroup[];
}
interface RawCategory {
  category_en: string;
  category_fr: string;
  team: string;
  services: RawService[];
}

function toTeam(value: string, where: string): Team {
  if (value === "barber" || value === "stylist") return value;
  throw new Error(`services-seed.json: ${where} has team "${value}" (expected "barber" or "stylist")`);
}

const toCents = (dollars: number | null | undefined) =>
  dollars == null ? null : Math.round(dollars * 100);

// Men's tabs: Cuts · Braids, Twists & Locs · Hair Color.
// Women's tabs follow the spec order: Braids · Twists · French Curls · Locs.
const CATEGORY_ORDER: Record<string, number> = {
  "haircuts-beard": 1,
  "braids-twists-locs": 2,
  "hair-color": 3,
  braids: 1,
  twists: 2,
  "french-curls": 3,
  locs: 4,
};

// Real photos per style go in /public/images/women/<slug>.jpg (and men/<slug>.jpg).
// Add the slug here when a photo lands; anything else shows the neutral oak box.
const STYLE_PHOTOS = new Set<string>([]);

const REMOVED = /locs installation/i;

// Extra length (+$15 per step) applies to women's long styles only (confirmed by Josh, Oct 30).
// Bob / Short styles have no length option; neither do men's braids, twists or re-twist.
const NO_LENGTH = new Set([
  "bob-boho-braids",
  "bob-boho-fulani",
  "short-fulani-marley-twists",
  "short-boho-marley-twists",
]);

/** Joins the options of one combination: "Color only · White". */
export const CHOICE_SEPARATOR = " · ";

/** Every combination of the groups' options, in order (first group varies slowest). */
function combinations(groups: RawChoiceGroup[]): RawChoiceOption[][] {
  return groups.reduce<RawChoiceOption[][]>(
    (acc, g) => acc.flatMap((combo) => g.options.map((o) => [...combo, o])),
    [[]],
  );
}

/** Sum of the options' values; null when no option has one. */
const sumOrNull = (values: (number | null | undefined)[]) =>
  values.some((v) => v != null) ? values.reduce<number>((n, v) => n + (v ?? 0), 0) : null;

function buildSide(side: Side, raw: RawCategory[]): Category[] {
  return raw
    .map((cat) => {
      const catSlug = slugify(cat.category_en);
      const categoryId = stableId(`category:${side}:${catSlug}`);
      const team = toTeam(cat.team, `category "${cat.category_en}"`);
      const services: Service[] = cat.services
        .filter((s) => !REMOVED.test(s.name ?? s.name_en ?? ""))
        .map((s, i) => {
          const nameEn = (s.name_en ?? s.name)!;
          // Style names have no French version yet (TODO Aubin): show the same name.
          const nameFr = s.name_fr ?? nameEn;
          const slug = slugify(nameEn);
          const id = stableId(`service:${side}:${slug}`);
          const isCut = s.price != null && !s.variants && !s.choices;
          const choiceGroups: ChoiceGroup[] = (s.choices ?? []).map((g) => ({
            key: g.key,
            options: g.options.map((o) => ({
              label: o.label,
              priceCents: toCents(o.price),
              durationMinutes: o.duration_min ?? null,
            })),
          }));
          if (s.choices && s.variants) throw new Error(`services-seed.json: "${nameEn}" has both choices and variants`);
          const variants: Variant[] = s.choices
            ? // Hair Color: one variant per combination ("Color only · White"), with the summed
              // price and minutes of its options (only the kind carries them).
              combinations(s.choices).map((combo, vi) => {
                const label = combo.map((o) => o.label).join(CHOICE_SEPARATOR);
                return {
                  id: stableId(`variant:${slug}:${slugify(label)}`),
                  label,
                  priceCents: toCents(sumOrNull(combo.map((o) => o.price))),
                  isConsult: false,
                  durationMinutes: sumOrNull(combo.map((o) => o.duration_min)),
                  sortOrder: vi,
                  choices: Object.fromEntries(s.choices!.map((g, gi) => [g.key, combo[gi].label])),
                };
              })
            : isCut
            ? [
                {
                  id: stableId(`variant:${slug}:standard`),
                  label: "Standard",
                  priceCents: toCents(s.price),
                  isConsult: false,
                  durationMinutes: null,
                  sortOrder: 0,
                  choices: null,
                },
              ]
            : (s.variants ?? []).map((v, vi) => ({
                id: stableId(`variant:${slug}:${slugify(v.size)}`),
                label: v.size,
                priceCents: toCents(v.price),
                // A variant with a note (Knotless Large) is a blank price, not "to discuss".
                isConsult: !!v.consult && !v.note,
                durationMinutes: null,
                sortOrder: vi,
                choices: null,
              }));
          const addons: Addon[] = (s.addons ?? []).map((a) => ({
            id: stableId(`addon:${slug}:${slugify(a.name)}`),
            name: a.name,
            priceCents: toCents(a.price),
            isFrom: !!a.from,
            isConsult: !!a.consult,
            extraMinutes: 0,
          }));
          return {
            id,
            slug,
            categoryId,
            side,
            team,
            kind: isCut ? "cut" : "style",
            nameEn,
            nameFr,
            imageUrl: STYLE_PHOTOS.has(slug) ? `/images/${side}/${slug}.jpg` : null,
            baseDurationMinutes: s.duration_min ?? null,
            lengthBased: side === "women" && !NO_LENGTH.has(slug),
            variants,
            addons,
            sortOrder: i,
            choiceGroups,
            onlyStaffKeys: s.only_staff ? [...s.only_staff] : null,
          } satisfies Service;
        });
      return {
        id: categoryId,
        slug: catSlug,
        side,
        team,
        nameEn: cat.category_en,
        nameFr: cat.category_fr,
        sortOrder: CATEGORY_ORDER[catSlug] ?? 99,
        services,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export const categories: Category[] = [
  ...buildSide("men", seed.men as RawCategory[]),
  ...buildSide("women", seed.women as RawCategory[]),
];

export const services: Service[] = categories.flatMap((c) => c.services);

// `key` (not the name) makes the id, so renaming someone never creates a new person.
export const staff: StaffMember[] = (seed.staff_demo as { key?: string; name: string; side: string; team: string }[]).map((s, i) => {
  const slug = s.key ?? slugify(s.name);
  return {
    id: stableId(`staff:${slug}`),
    slug,
    name: s.name,
    side: s.side as StaffSide,
    team: toTeam(s.team, `staff "${s.name}"`),
    photoUrl: null,
    sortOrder: i,
  };
});

// only_staff must name real people (by key) on the service's own team: fail the build otherwise.
for (const s of services) {
  for (const key of s.onlyStaffKeys ?? []) {
    const p = staff.find((x) => x.slug === key);
    if (!p) throw new Error(`services-seed.json: "${s.nameEn}" only_staff "${key}" is not a staff_demo key`);
    if (p.team !== s.team) throw new Error(`services-seed.json: "${s.nameEn}" only_staff "${key}" is not on team ${s.team}`);
  }
  if (s.onlyStaffKeys && !s.onlyStaffKeys.length) throw new Error(`services-seed.json: "${s.nameEn}" only_staff is empty`);
}

export const shop = {
  name: seed.shop.name,
  tagline: seed.shop.tagline_fr,
  address: seed.shop.address,
  phone: seed.shop.phone,
  directionsHref: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(seed.shop.address)}`,
  phoneHref: `tel:+1${seed.shop.phone.replace(/\D/g, "")}`,
  email: seed.shop.email,
  timezone: "America/Toronto",
};

export const rules = {
  extraLengthCents: toCents(seed.rules.extra_length_price)!,
  lengthStepsAfterNormal: seed.rules.length_steps_after_normal,
  sizeGuideNotes: seed.size_guide_notes,
};

/** Open every day 10:00-20:00 (confirmed Oct 30). weekday 0 = Sunday. */
export const OPENING_HOURS: { weekday: number; start: string; end: string }[] = [0, 1, 2, 3, 4, 5, 6].map(
  (weekday) => ({ weekday, start: "10:00", end: "20:00" }),
);

export function categoriesFor(side: Side) {
  return categories.filter((c) => c.side === side);
}

export function staffFor(side: Side) {
  return staff.filter((s) => s.side === side || s.side === "both");
}

/** The people who do a team's services ("Anyone available" picks only from these). */
export function staffForTeam(team: Team) {
  return staff.filter((s) => s.team === team);
}

/**
 * Staff ids allowed by the service's only_staff (Hair Color -> [Noël's id]); null = the whole team.
 * Ids are stableId(`staff:${key}`), the same ids as in the database.
 */
export function onlyStaffIdsFor(service: Pick<Service, "onlyStaffKeys">): string[] | null {
  if (!service.onlyStaffKeys) return null;
  return staff.filter((p) => service.onlyStaffKeys!.includes(p.slug)).map((p) => p.id);
}

/** The people who do this service: its team, narrowed by only_staff. Display order. */
export function staffForService(service: Pick<Service, "team" | "onlyStaffKeys">) {
  const only = onlyStaffIdsFor(service);
  return staffForTeam(service.team).filter((p) => !only || only.includes(p.id));
}

export function findService(id: string) {
  return services.find((s) => s.id === id);
}

/** Smallest known price, for "from $X". */
export function fromPriceCents(service: Service): number | null {
  const prices = service.variants.map((v) => v.priceCents).filter((p): p is number => p != null);
  return prices.length ? Math.min(...prices) : null;
}
