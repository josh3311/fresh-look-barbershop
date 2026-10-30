// The service catalog, built once from data/services-seed.json.
// Pages, the booking stepper and the seed script all read from here, so prices
// are never retyped by hand.
import seed from "@/data/services-seed.json";
import { slugify, stableId } from "@/lib/ids";

export type Side = "men" | "women";
export type StaffSide = Side | "both";

export interface Variant {
  id: string;
  label: string;
  priceCents: number | null;
  /** "to discuss" in the salon. A blank price that is not consult shows "Ask in salon". */
  isConsult: boolean;
  durationMinutes: number | null;
  sortOrder: number;
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
}

export interface Category {
  id: string;
  slug: string;
  side: Side;
  nameEn: string;
  nameFr: string;
  sortOrder: number;
  services: Service[];
}

export interface StaffMember {
  id: string;
  slug: string;
  name: string;
  side: StaffSide;
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
interface RawService {
  name?: string;
  name_en?: string;
  name_fr?: string;
  price?: number;
  duration_min: number | null;
  variants?: RawVariant[];
  addons?: RawAddon[];
}
interface RawCategory {
  category_en: string;
  category_fr: string;
  services: RawService[];
}

const toCents = (dollars: number | null | undefined) =>
  dollars == null ? null : Math.round(dollars * 100);

// Women's tabs follow the spec order: Braids · Twists · French Curls · Locs.
const CATEGORY_ORDER: Record<string, number> = {
  "haircuts-beard": 1,
  "braids-twists-locs": 2,
  braids: 1,
  twists: 2,
  "french-curls": 3,
  locs: 4,
};

// Real photos per style go in /public/images/women/<slug>.jpg (and men/<slug>.jpg).
// Add the slug here when a photo lands; anything else shows the neutral oak box.
const STYLE_PHOTOS = new Set<string>([]);

const REMOVED = /locs installation/i;

function buildSide(side: Side, raw: RawCategory[]): Category[] {
  return raw
    .map((cat) => {
      const catSlug = slugify(cat.category_en);
      const categoryId = stableId(`category:${side}:${catSlug}`);
      const services: Service[] = cat.services
        .filter((s) => !REMOVED.test(s.name ?? s.name_en ?? ""))
        .map((s, i) => {
          const nameEn = (s.name_en ?? s.name)!;
          // Style names have no French version yet (TODO Aubin): show the same name.
          const nameFr = s.name_fr ?? nameEn;
          const slug = slugify(nameEn);
          const id = stableId(`service:${side}:${slug}`);
          const isCut = s.price != null && !s.variants;
          const variants: Variant[] = isCut
            ? [
                {
                  id: stableId(`variant:${slug}:standard`),
                  label: "Standard",
                  priceCents: toCents(s.price),
                  isConsult: false,
                  durationMinutes: null,
                  sortOrder: 0,
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
            kind: isCut ? "cut" : "style",
            nameEn,
            nameFr,
            imageUrl: STYLE_PHOTOS.has(slug) ? `/images/${side}/${slug}.jpg` : null,
            baseDurationMinutes: s.duration_min ?? null,
            // Demo decision (TODO Aubin): length extra applies to women's styles only;
            // men's cornrows / barrel twists / re-twist sit on the head.
            lengthBased: side === "women",
            variants,
            addons,
            sortOrder: i,
          } satisfies Service;
        });
      return {
        id: categoryId,
        slug: catSlug,
        side,
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

export const staff: StaffMember[] = seed.staff_demo.map((s, i) => {
  const slug = slugify(s.name);
  return {
    id: stableId(`staff:${slug}`),
    slug,
    name: s.name,
    side: s.side as StaffSide,
    photoUrl: null,
    sortOrder: i,
  };
});

export const shop = {
  name: seed.shop.name,
  tagline: seed.shop.tagline_fr,
  address: seed.shop.address,
  phone: seed.shop.phone,
  phoneHref: `tel:+1${seed.shop.phone.replace(/\D/g, "")}`,
  email: seed.shop.email,
  timezone: "America/Toronto",
};

export const rules = {
  extraLengthCents: toCents(seed.rules.extra_length_price)!,
  lengthStepsAfterNormal: seed.rules.length_steps_after_normal,
  sizeGuideNotes: seed.size_guide_notes,
};

/** TODO Aubin: demo hours. weekday 0 = Sunday. */
export const DEMO_HOURS: { weekday: number; start: string; end: string }[] = [1, 2, 3, 4, 5, 6].map(
  (weekday) => ({ weekday, start: "10:00", end: "19:00" }),
);

export function categoriesFor(side: Side) {
  return categories.filter((c) => c.side === side);
}

export function staffFor(side: Side) {
  return staff.filter((s) => s.side === side || s.side === "both");
}

export function findService(id: string) {
  return services.find((s) => s.id === id);
}

/** Smallest known price, for "from $X". */
export function fromPriceCents(service: Service): number | null {
  const prices = service.variants.map((v) => v.priceCents).filter((p): p is number => p != null);
  return prices.length ? Math.min(...prices) : null;
}
