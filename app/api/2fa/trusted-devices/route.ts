import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  TRUSTED_DEVICE_COOKIE,
  revokeAllTrustedDevices,
  trustedDeviceCookieOptions,
} from "@/lib/trusted-device";

export const dynamic = "force-dynamic";

export async function DELETE() {
  const { data: { user } } = await createServerSupabase().auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  await revokeAllTrustedDevices(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(TRUSTED_DEVICE_COOKIE, "", {
    ...trustedDeviceCookieOptions(),
    maxAge: 0,
  });
  return res;
}
