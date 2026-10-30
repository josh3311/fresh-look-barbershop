import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** STAFF_EMAILS="a@x.com, b@y.com" -> lower-cased set. Empty/unset = nobody. */
export function staffEmails(raw = process.env.STAFF_EMAILS): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

export function isStaffEmail(email: string | null | undefined, raw?: string): boolean {
  return !!email && staffEmails(raw).has(email.trim().toLowerCase());
}

/** Supabase client bound to the visitor's auth cookies (anon key: RLS applies). */
export async function getAuthClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are read-only there; middleware refreshes them.
        }
      },
    },
  });
}

export type StaffAccess =
  | { state: "anonymous" }
  | { state: "forbidden"; email: string }
  | { state: "staff"; email: string };

/** Who is asking? Signed in AND on STAFF_EMAILS = staff. */
export async function getStaffAccess(): Promise<StaffAccess> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { state: "anonymous" };
  const supabase = await getAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { state: "anonymous" };
  return isStaffEmail(user.email) ? { state: "staff", email: user.email } : { state: "forbidden", email: user.email };
}
