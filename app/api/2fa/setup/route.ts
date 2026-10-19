import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/settings";
import { getTwoFactor } from "@/lib/two-factor";
import { generateSecret, otpauthUri } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  const existing = await getTwoFactor(user.id);
  if (existing?.enabled) {
    return NextResponse.json({ ok: false, error: "Two-factor is already on." }, { status: 400 });
  }

  const secret = generateSecret();
  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();
  const account = (profile as { username?: string } | null)?.username ?? "member";
  const settings = await getSettings();

  const { error } = await admin.from("user_2fa").upsert(
    {
      user_id: user.id,
      secret,
      enabled: false,
      confirmed_at: null,
      last_step: null,
      recovery: [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const uri = otpauthUri({ secret, account, issuer: settings.sitename });
  return NextResponse.json({ ok: true, secret, uri });
}
