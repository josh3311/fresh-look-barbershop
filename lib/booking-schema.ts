// Server-side validation for POST /api/bookings (Zod).
import { z } from "zod";
import { dict } from "@/lib/i18n";
import { normalizePhone } from "@/lib/phone";

const t = dict.en.book;

export const BookingBody = z.object({
  serviceId: z.uuid(),
  variantId: z.uuid(),
  addonIds: z.array(z.uuid()).max(10).default([]),
  lengthLabel: z.string().max(40).nullish(),
  staffId: z.union([z.literal("any"), z.uuid()]),
  startsAt: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(1).max(80),
  /** Canadian number, stored normalized as +1XXXXXXXXXX. */
  phone: z
    .string()
    .max(30)
    .transform((s, ctx) => {
      const phone = normalizePhone(s);
      if (!phone) {
        ctx.addIssue({ code: "custom", message: t.errorPhone });
        return z.NEVER;
      }
      return phone;
    }),
  email: z
    .string()
    .trim()
    .max(254)
    .pipe(z.email({ message: t.errorEmail }))
    .transform((s) => s.toLowerCase()),
  notes: z.string().trim().max(500).optional().default(""),
  /** Honeypot: humans never see this field. */
  website: z.string().max(0).optional().default(""),
});

export type BookingInput = z.infer<typeof BookingBody>;
