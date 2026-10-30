"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminClient } from "@/lib/server/supabase";
import { getAuthClient, getStaffAccess, isStaffEmail } from "@/lib/server/staff-auth";

export interface LoginState {
  sent: boolean;
  error?: string;
}

/** Sends a magic link, but only to emails on STAFF_EMAILS. Same answer either way. */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { sent: false, error: "email" };

  if (isStaffEmail(email.data)) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    const supabase = await getAuthClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.data,
      options: { emailRedirectTo: `${proto}://${host}/auth/callback`, shouldCreateUser: true },
    });
    if (error) console.error(`[staff] magic link failed: ${error.status ?? ""} ${error.code ?? error.name}`);
  }
  return { sent: true };
}

export async function signOut() {
  const supabase = await getAuthClient();
  await supabase.auth.signOut();
  redirect("/staff/login");
}

/** Staff only. Marks a booking cancelled (frees the slot: the overlap lock only counts "booked"). */
export async function cancelBooking(formData: FormData) {
  const access = await getStaffAccess();
  if (access.state !== "staff") throw new Error("Not allowed");
  const id = z.uuid().parse(formData.get("id"));
  const { error } = await getAdminClient()
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "booked");
  if (error) throw new Error("Could not cancel the booking");
  revalidatePath("/staff");
}
