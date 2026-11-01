// Who the customer can pick in the "Pick a person" step (Change Request #2, A4).
// The service's TEAM decides, not the page side: Simple Cornrows on the Men page is a
// stylist service, so it shows Barber C and D (plus "Anyone available"), never A or B.
// The server checks the same rule again (loadEligibleStaff), so the page cannot cross teams.
// A service with only_staff narrows the team further: Hair Color shows only Noël (Aubin, Nov 1).
import { staffForService, type Service, type StaffMember } from "@/lib/catalog";

type Who = Pick<Service, "team" | "onlyStaffKeys">;

/** The people who do this service, in display order. "Anyone available" is added by the step. */
export function staffChoicesFor(service: Who): StaffMember[] {
  return staffForService(service);
}

/** Keep a preselected person only if they do this service; otherwise "Anyone available". */
export function resolveStaffChoice(service: Who, staffId: string): string {
  if (staffId === "any") return "any";
  return staffChoicesFor(service).some((p) => p.id === staffId) ? staffId : "any";
}
