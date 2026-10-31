// Who the customer can pick in the "Pick a person" step (Change Request #2, A4).
// The service's TEAM decides, not the page side: Simple Cornrows on the Men page is a
// stylist service, so it shows Barber C and D (plus "Anyone available"), never A or B.
// The server checks the same rule again (loadEligibleStaff), so the page cannot cross teams.
import { staffForTeam, type Service, type StaffMember } from "@/lib/catalog";

/** The people who do this service, in display order. "Anyone available" is added by the step. */
export function staffChoicesFor(service: Pick<Service, "team">): StaffMember[] {
  return staffForTeam(service.team);
}

/** Keep a preselected person only if they do this service; otherwise "Anyone available". */
export function resolveStaffChoice(service: Pick<Service, "team">, staffId: string): string {
  if (staffId === "any") return "any";
  return staffChoicesFor(service).some((p) => p.id === staffId) ? staffId : "any";
}
