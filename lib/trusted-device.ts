import { cookies, headers } from "next/headers";
import { createAdminSupabase } from "./supabase/admin";
import {
  hashTrustedDeviceToken,
  newTrustedDeviceToken,
  trustedDeviceExpiry,
} from "./trusted-device-token";

export const TRUSTED_DEVICE_COOKIE = "mfa_trust";

export function trustedDeviceCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.VERCEL === "1",
    path: "/",
  };
}

async function requestUserAgent(): Promise<string | null> {
  try {
    return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  } catch {
    return null;
  }
}

export async function trustDevice(userId: string, userAgent?: string | null): Promise<string | null> {
  try {
    const token = newTrustedDeviceToken();
    const admin = createAdminSupabase();
    await admin
      .from("trusted_devices")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date().toISOString());

    const ua = userAgent === undefined ? await requestUserAgent() : userAgent?.slice(0, 300) ?? null;
    const { error } = await admin.from("trusted_devices").insert({
      user_id: userId,
      token_hash: hashTrustedDeviceToken(token),
      user_agent: ua,
      expires_at: trustedDeviceExpiry(),
    });
    return error ? null : token;
  } catch {
    return null;
  }
}

export async function hasTrustedDevice(
  userId: string,
  userAgent?: string | null
): Promise<boolean> {
  const token = (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value;
  if (!token) return false;

  const admin = createAdminSupabase();
  const { data } = await admin
    .from("trusted_devices")
    .select("id,user_agent,expires_at")
    .eq("user_id", userId)
    .eq("token_hash", hashTrustedDeviceToken(token))
    .maybeSingle();
  const row = data as { id: string; user_agent: string | null; expires_at: string } | null;
  if (!row) return false;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    await admin.from("trusted_devices").delete().eq("id", row.id);
    return false;
  }

  const ua = userAgent === undefined ? await requestUserAgent() : userAgent?.slice(0, 300) ?? null;
  if (row.user_agent && ua && row.user_agent !== ua) return false;
  return true;
}

export async function revokeCurrentTrustedDevice(): Promise<void> {
  try {
    const token = (await cookies()).get(TRUSTED_DEVICE_COOKIE)?.value;
    if (!token) return;
    await createAdminSupabase()
      .from("trusted_devices")
      .delete()
      .eq("token_hash", hashTrustedDeviceToken(token));
  } catch {
    // Logout must still clear the session if trust revocation fails.
  }
}

export async function revokeAllTrustedDevices(userId: string): Promise<void> {
  try {
    await createAdminSupabase().from("trusted_devices").delete().eq("user_id", userId);
  } catch {
    // The caller still needs to complete the security action.
  }
}
