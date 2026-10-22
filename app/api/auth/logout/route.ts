import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";
import {
  TRUSTED_DEVICE_COOKIE,
  revokeCurrentTrustedDevice,
  trustedDeviceCookieOptions,
} from "@/lib/trusted-device";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createServerClient<Database>(url, anon, {
    cookies: {
      async getAll() {
        return (await cookies()).getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  await revokeCurrentTrustedDevice();
  await supabase.auth.signOut();
  res.cookies.set(TRUSTED_DEVICE_COOKIE, "", {
    ...trustedDeviceCookieOptions(),
    maxAge: 0,
  });
  return res;
}
