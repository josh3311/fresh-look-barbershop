// Change Request #2 (Oct 31), UI: "about X min" on barber cuts (A2), staff step by team (A4),
// "Not working this day" (A5), Women home card label (A8).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

import Home from "@/app/page";
import { BookingStepper } from "@/components/booking/BookingStepper";
import { DateChip, SlotArea } from "@/components/booking/TimeSlots";
import { CutCard, StyleCard } from "@/components/ServiceCards";
import { services, staff } from "@/lib/catalog";
import { dict } from "@/lib/i18n";

const svc = (slug: string) => services.find((s) => s.slug === slug)!;
const person = (name: string) => staff.find((p) => p.name === name)!;
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("A8 home page cards", () => {
  const html = renderToStaticMarkup(Home());
  const doors = html.match(/<article class="group[\s\S]*?<\/article>/g)!;

  it("T-216 Women label: solid black box, white text, no blur / opacity / transparency", () => {
    const women = doors.find((a) => a.includes('href="/women"'))!;
    const label = women.match(/<h3 class="([^"]*)"[^>]*>Women<\/h3>/);
    expect(label, "Women heading on the photo").not.toBeNull();
    const classes = label![1].split(/\s+/);
    expect(classes).toContain("bg-black");
    expect(classes).toContain("text-white");
    for (const c of classes) {
      expect(c, c).not.toMatch(/blur|opacity|transparent|\/\d+$|^bg-gradient|^from-|^via-|^to-/);
    }
    // The photo, its crop and the dark gradient stay (CR1 5.4); only the label changed.
    const gradient = '<div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent"></div>';
    expect(women).toContain(gradient);
    expect(doors.find((a) => a.includes('href="/men"'))).toContain(gradient);
    expect(women).toContain("women-boho-curls.jpg");
    expect(women).toContain("object-position:center 30%");
  });

  it("T-216 Men card markup is exactly what it was at HEAD (59cb41c)", () => {
    const men = doors.find((a) => a.includes('href="/men"'))!;
    const before = readFileSync(join(__dirname, "fixtures/home-men-card-head.html"), "utf8").trim();
    expect(men).toBe(before);
  });
});

describe("A2 time estimate on barber cut cards only", () => {
  it("T-217 'about 35 min' on the Classic cut card; no 'about' on braid / twist style cards", () => {
    expect(text(renderToStaticMarkup(<CutCard service={svc("classic-haircut")} badge />))).toContain("about 35 min");
    for (const slug of ["simple-cornrows", "barrel-twists", "knotless-braids", "passion-twists-human-hair-twist"]) {
      expect(text(renderToStaticMarkup(<StyleCard service={svc(slug)} />)), slug).not.toMatch(/about/i);
    }
  });

  it("stepper service list: Haircut & Beard 'about 45 min', cornrows row has no 'about'", () => {
    const html = renderToStaticMarkup(<BookingStepper initialSide="men" initialServiceId={null} initialStaffId="any" />);
    const rows = html.match(/<li>[\s\S]*?<\/li>/g)!.map(text);
    expect(rows.find((r) => r.includes("Haircut &amp; Beard Trim"))).toContain("about 45 min");
    expect(rows.find((r) => r.includes("Simple Cornrows"))).not.toMatch(/about/i);
  });

  it("French text exists for the new keys", () => {
    expect(dict.fr.service.aboutMin.replace("{n}", "35")).toBe("environ 35 min");
    expect(dict.en.service.aboutMin.replace("{n}", "35")).toBe("about 35 min");
    expect(dict.fr.book.notWorking).toBeTruthy();
  });
});

describe("A4 staff step shows the service's team only", () => {
  it("Classic: Anyone available + the 4 barbers; never a stylist; a preselected stylist falls back to Anyone", () => {
    const html = renderToStaticMarkup(
      <BookingStepper initialSide="men" initialServiceId={svc("classic-haircut").id} initialStaffId={person("Reine").id} />,
    );
    const cards = [...html.matchAll(/<span class="block font-serif text-lg">([^<]+)<\/span>/g)].map((m) => m[1]);
    expect(cards).toEqual(["Anyone available", "Noël", "Jackson", "Joshua", "Duckel"]);
    // The selected card is "Anyone available".
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>[\s\S]*?Anyone available/);
  });
});

describe("A5 'Not working this day' in the time step", () => {
  const off = { date: "2026-11-06", slots: [], notWorking: true };
  const full = { date: "2026-11-07", slots: [], notWorking: false };

  it("T-214 a day the person does not work says 'Not working this day' (date row and slot area)", () => {
    const chip = renderToStaticMarkup(<DateChip day={off} selected={false} onSelect={() => {}} />);
    expect(chip).toContain("Not working this day");
    expect(text(renderToStaticMarkup(<SlotArea day={off} selected={null} onPick={() => {}} />))).toContain(
      "Not working this day",
    );
  });

  it("a fully booked working day still says 'No free times', not 'Not working'", () => {
    const area = text(renderToStaticMarkup(<SlotArea day={full} selected={null} onPick={() => {}} />));
    expect(area).toContain(dict.en.book.noTimes);
    expect(area).not.toContain("Not working");
  });
});
