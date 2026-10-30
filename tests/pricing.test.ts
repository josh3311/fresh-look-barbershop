import { describe, expect, it } from "vitest";
import { estimatePrice } from "@/lib/pricing";
import { lengthSteps } from "@/lib/lengths";
import { categoriesFor, rules, services } from "@/lib/catalog";

const knotless = services.find((s) => s.slug === "knotless-braids")!;
const variant = (label: string) => knotless.variants.find((v) => v.label === label)!;
const addon = (name: string) => knotless.addons.find((a) => a.name === name)!;

describe("estimatePrice (spec 5.3)", () => {
  it("Knotless Small + Hip + beads = $235", () => {
    const e = estimatePrice({
      variant: variant("Small"),
      addons: [addon("Beads at the ends")],
      lengthSteps: lengthSteps("Hip")!,
      extraLengthCents: rules.extraLengthCents,
    });
    expect(e.cents).toBe(23500);
    expect(e.isFrom).toBe(false);
  });

  it("length steps: +$15 per step past mid-back, shorter = normal", () => {
    expect(["Neck", "Shoulder", "Normal"].map(lengthSteps)).toEqual([0, 0, 0]);
    expect(lengthSteps("Waist")).toBe(1);
    expect(lengthSteps("Calf")).toBe(7);
    expect(lengthSteps("Nope")).toBeNull();
  });

  it("Knotless Large shows 'Ask in salon' (blank price) and is bookable", () => {
    const large = variant("Large");
    expect(large.priceCents).toBeNull();
    const e = estimatePrice({ variant: large, addons: [], lengthSteps: 0, extraLengthCents: 1500 });
    expect(e).toMatchObject({ cents: null, askInSalon: true });
  });

  it("a 'to discuss' add-on gives 'from $X' + consult", () => {
    const boho = services.find((s) => s.slug === "knotless-boho-braids-style-a")!;
    const e = estimatePrice({
      variant: boho.variants.find((v) => v.label === "Small")!,
      addons: [boho.addons.find((a) => a.name === "Full curl")!],
      lengthSteps: 0,
      extraLengthCents: 1500,
    });
    expect(e).toMatchObject({ cents: 20000, isFrom: true, hasConsult: true, askInSalon: false });
  });

  it("a 'More' size is to discuss, not 'Ask in salon'", () => {
    const cornrows = services.find((s) => s.slug === "simple-cornrows")!;
    const more = cornrows.variants.find((v) => v.label === "More")!;
    const e = estimatePrice({ variant: more, addons: [], lengthSteps: 0, extraLengthCents: 1500 });
    expect(e).toMatchObject({ cents: null, hasConsult: true, askInSalon: false });
  });
});

describe("catalog (spec 2, 10.5b, 10.10)", () => {
  it("never contains Locs Installation", () => {
    expect(services.some((s) => /locs installation/i.test(s.nameEn))).toBe(false);
  });

  it("Cornrows, Barrel Twists and Locs Re-twist are on the Men side only", () => {
    for (const slug of ["simple-cornrows", "stitch-cornrows", "barrel-twists", "locs-re-twist"]) {
      expect(services.filter((s) => s.slug === slug).map((s) => s.side)).toEqual(["men"]);
    }
  });

  it("has 9 men's services and 33 women's styles", () => {
    expect(services.filter((s) => s.side === "men")).toHaveLength(9);
    expect(services.filter((s) => s.side === "women")).toHaveLength(33);
  });

  it("Classic Haircut comes first at $25", () => {
    const first = categoriesFor("men")[0].services[0];
    expect(first.nameEn).toBe("Classic Haircut");
    expect(first.variants[0].priceCents).toBe(2500);
  });

  it("women's tabs are Braids, Twists, French Curls, Locs", () => {
    expect(categoriesFor("women").map((c) => c.nameEn)).toEqual(["Braids", "Twists", "French Curls", "Locs"]);
  });

  it("ids are stable and unique", () => {
    const ids = services.flatMap((s) => [s.id, ...s.variants.map((v) => v.id), ...s.addons.map((a) => a.id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);
  });
});
