import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getTwoFactor, newRecoveryCodes } from "@/lib/two-factor";
import { verifyTotp } from "@/lib/totp";

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
  if (!row || row.enabled) {
    return NextResponse.json({ ok: false, error: "Start setup before confirming." }, { status: 400 });
  }

  const step = verifyTotp(row.secret, code, { window: 1 });
  if (step == null) {
    return NextResponse.json({ ok: false, error: "That code did not match. Try the next one." }, { status: 400 });
  }

  const { plain, stored } = newRecoveryCodes();
  const now = new Date().toISOString();
  const admin = createAdminSupabase();
  const { error } = await admin
    .from("user_2fa")
    .update({ enabled: true, confirmed_at: now, last_step: step, recovery: stored, updated_at: now })
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, recoveryCodes: plain });
}
