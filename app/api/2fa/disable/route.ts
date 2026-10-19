import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getTwoFactor, verifyUserCode } from "@/lib/two-factor";
import { MFA_COOKIE, mfaCookieOptions } from "@/lib/mfa-cookie";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = (await req.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const code = String(body.code ?? "");

  const row = await getTwoFactor(user.id);
  if (!row?.enabled) {
    return NextResponse.json({ ok: false, error: "Two-factor is not on." }, { status: 400 });
  }

  const result = await verifyUserCode(user.id, code);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "That code is not valid." }, { status: 400 });
  }

  const admin = createAdminSupabase();
  await admin.from("user_2fa").delete().eq("user_id", user.id);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(MFA_COOKIE, "", { ...mfaCookieOptions(), maxAge: 0 });
  return res;
}
