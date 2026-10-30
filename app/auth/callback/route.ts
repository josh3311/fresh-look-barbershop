import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getAuthClient } from "@/lib/server/staff-auth";

export const dynamic = "force-dynamic";

// Magic-link landing page. Supports both link styles:
//   ?code=...                         (default Supabase template, same browser only)
//   ?token_hash=...&type=email        (recommended template, works in any browser)
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  try {
    const supabase = await getAuthClient();
    if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } catch {
    ok = false;
  }
  return NextResponse.redirect(new URL(ok ? "/staff" : "/staff/login?error=link", origin));
}
