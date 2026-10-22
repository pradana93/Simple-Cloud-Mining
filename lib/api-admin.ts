import { NextResponse } from "next/server";
import { createServerSupabase } from "./supabase/server";
import { createAdminSupabase } from "./supabase/admin";
import { hasFreshMfa } from "./mfa-cookie";
import { hasTrustedDevice } from "./trusted-device";
import { isTwoFactorEnabled } from "./two-factor";

// Shared guard for admin-only API routes: 401 for anonymous, 403 for non-admins.
// Admins must have TOTP enabled and either a fresh code (15 minutes) or a
// remembered device, so a stolen password alone cannot change money or config.
export async function requireAdminApi(): Promise<{ userId: string; name: string | null } | { error: NextResponse }> {
  let userId: string | null = null;
  try {
    const { data: { user } } = await createServerSupabase().auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  }
  try {
    const { data } = await createAdminSupabase().from("profiles").select("is_admin,username").eq("id", userId).maybeSingle();
    if (!(data as { is_admin?: boolean } | null)?.is_admin) {
      return { error: NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 }) };
    }
    if (!(await isTwoFactorEnabled(userId))) {
      return {
        error: NextResponse.json(
          { ok: false, error: "Enable two-factor authentication before using admin tools.", mfaSetupRequired: true },
          { status: 403 }
        ),
      };
    }
    let trusted = false;
    try {
      trusted = await hasTrustedDevice(userId);
    } catch {
      trusted = false;
    }
    if (!(await hasFreshMfa(userId)) && !trusted) {
      return {
        error: NextResponse.json(
          { ok: false, error: "Confirm your authenticator code to continue.", mfaRequired: true },
          { status: 403 }
        ),
      };
    }
    return { userId, name: (data as { username?: string | null }).username ?? null };
  } catch {
    return { error: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }
}
