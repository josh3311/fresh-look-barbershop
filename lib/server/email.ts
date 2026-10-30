import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { shop } from "@/lib/catalog";
import { dict } from "@/lib/i18n";
import { formatPhone } from "@/lib/phone";
import { formatCents, type Estimate } from "@/lib/pricing";

const t = dict.en.email;

export interface BookingSummary {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceName: string;
  /** Size, for styles ("Small"). null for cuts. */
  variantLabel: string | null;
  lengthLabel: string | null;
  addons: string[];
  staffName: string;
  startsAt: Date;
  estimate: Estimate;
  notes: string | null;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

const DEFAULT_SALON_EMAIL = "freshlook.Ottawa@gmail.com";
// Resend's shared test sender. Set RESEND_FROM to an address on a verified domain to reach customers.
const DEFAULT_FROM = "Fresh Look <onboarding@resend.dev>";

export const salonNotifyEmail = () => process.env.SALON_NOTIFY_EMAIL?.trim() || DEFAULT_SALON_EMAIL;

/** "Sat Oct 31, 2:00 PM" in salon time. */
export const whenLabel = (d: Date) => formatInTimeZone(d, shop.timezone, "EEE MMM d, h:mm a");

export function estimateLabel(e: Estimate): string {
  if (e.askInSalon) return dict.en.book.askInSalon;
  if (e.cents == null) return dict.en.book.toDiscuss;
  const base = `${e.isFrom ? "from " : ""}${formatCents(e.cents)}`;
  return e.hasConsult ? `${base} (${dict.en.book.toDiscuss.toLowerCase()})` : base;
}

function serviceLine(s: BookingSummary) {
  return [s.serviceName, s.variantLabel, s.lengthLabel].filter(Boolean).join(" · ");
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function render(heading: string, intro: string | null, rows: [string, string][], footer: string[]) {
  const text = [heading, intro, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...footer]
    .filter((l) => l !== null)
    .join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f5f0;font-family:Arial,Helvetica,sans-serif;color:#111">
<div style="max-width:520px;margin:0 auto;padding:24px">
<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;margin:0 0 8px">${esc(heading)}</h1>
${intro ? `<p style="margin:0 0 16px">${esc(intro)}</p>` : ""}
<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e4dfd6">
${rows
  .map(
    ([k, v]) =>
      `<tr><td style="padding:8px 12px;border-bottom:1px solid #e4dfd6;color:#5c574f;font-size:13px;width:38%">${esc(k)}</td><td style="padding:8px 12px;border-bottom:1px solid #e4dfd6">${esc(v)}</td></tr>`,
  )
  .join("\n")}
</table>
${footer.map((f) => `<p style="margin:16px 0 0;font-size:14px">${esc(f)}</p>`).join("\n")}
<p style="margin:24px 0 0;font-size:12px;color:#5c574f">${esc(shop.name)} · ${esc(shop.address)}</p>
</div></body></html>`;
  return { text, html };
}

/** Email to the shop for every new booking. */
export function buildSalonEmail(s: BookingSummary, to = salonNotifyEmail()): EmailMessage {
  const when = whenLabel(s.startsAt);
  const rows: [string, string][] = [
    [t.customer, s.customerName],
    [t.phone, formatPhone(s.customerPhone)],
    [t.email, s.customerEmail],
    [t.service, serviceLine(s)],
    [t.addons, s.addons.length ? s.addons.join(", ") : t.none],
    [t.person, s.staffName],
    [t.when, `${when} (Ottawa time)`],
    [t.price, estimateLabel(s.estimate)],
    ...(s.notes ? ([[t.notes, s.notes]] as [string, string][]) : []),
    [t.bookingId, s.id],
  ];
  return {
    to,
    replyTo: s.customerEmail,
    subject: t.newSubject.replace("{service}", s.serviceName).replace("{person}", s.staffName).replace("{when}", when),
    ...render(t.newHeading, null, rows, []),
  };
}

/** Confirmation to the customer: same details + address + pay in salon. */
export function buildCustomerEmail(s: BookingSummary): EmailMessage {
  const when = whenLabel(s.startsAt);
  const rows: [string, string][] = [
    [t.service, serviceLine(s)],
    [t.addons, s.addons.length ? s.addons.join(", ") : t.none],
    [t.person, s.staffName],
    [t.when, when],
    [t.price, estimateLabel(s.estimate)],
    [t.customer, s.customerName],
    [t.phone, formatPhone(s.customerPhone)],
    [t.email, s.customerEmail],
    [t.address, shop.address],
    [t.bookingId, s.id],
  ];
  return {
    to: s.customerEmail,
    replyTo: salonNotifyEmail(),
    subject: t.customerSubject.replace("{when}", when),
    ...render(t.customerHeading, t.customerIntro.replace("{name}", s.customerName), rows, [
      t.payInSalon,
      t.changes.replace("{phone}", shop.phone),
    ]),
  };
}

/** Sends one email through Resend. Throws on failure. */
export async function sendEmail(msg: EmailMessage): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM?.trim() || DEFAULT_FROM,
      to: [msg.to],
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
      ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    // Only the status + Resend's error name: the message can echo addresses.
    const name = await res
      .json()
      .then((b: { name?: string }) => b?.name ?? "unknown")
      .catch(() => "unknown");
    throw new Error(`Resend ${res.status} ${name}`);
  }
}

/**
 * Salon notification + customer confirmation. Never throws: a failed email must not
 * undo a saved booking. Logs the booking id and the reason only, never customer details.
 */
export async function sendBookingEmails(s: BookingSummary): Promise<{ salon: boolean; customer: boolean }> {
  const jobs = [
    ["salon", () => buildSalonEmail(s)],
    ["customer", () => buildCustomerEmail(s)],
  ] as const;
  const results = await Promise.allSettled(jobs.map(([, build]) => sendEmail(build())));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const reason = r.reason instanceof Error ? r.reason.message : "unknown error";
      console.error(`[email] ${jobs[i][0]} email failed for booking ${s.id}: ${reason}`);
    }
  });
  return { salon: results[0].status === "fulfilled", customer: results[1].status === "fulfilled" };
}
