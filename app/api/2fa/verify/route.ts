import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { verifyUserCode } from "@/lib/two-factor";
import { MFA_COOKIE, issueMfaToken, mfaCookieOptions } from "@/lib/mfa-cookie";
import {
  TRUSTED_DEVICE_COOKIE,
  trustDevice,
  trustedDeviceCookieOptions,
} from "@/lib/trusted-device";
import { TRUSTED_DEVICE_MAX_AGE_SECONDS } from "@/lib/trusted-device-token";
import {
  TFA_LIMIT,
  TFA_WINDOW_MS,
  clientIp,
  limitReached,
  twoFactorAttemptKey,
} from "@/lib/login-throttle";
import type { Database } from "@/lib/types";

export const dynamic = "force-dynamic";

type Pending = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  exp: string;
};

// Two callers: the login step (holds a ticket, no session yet) and step-up for a
// sensitive action (already signed in). Both must clear the same TOTP gate.
export async function POST(req: Request) {
  let body: { ticket?: unknown; code?: unknown; remember?: unknown };
  try {
    body = (await req.json()) as { ticket?: unknown; code?: unknown; remember?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const ticket = typeof body.ticket === "string" ? body.ticket : "";
  const code = String(body.code ?? "");
  const remember = body.remember === true;
  const admin = createAdminSupabase();

  let userId: string | null = null;
  let pending: Pending | null = null;

  if (ticket) {
    const { data } = await admin
      .from("login_pending_2fa")
      .select("id,user_id,access_token,refresh_token,exp")
      .eq("id", ticket)
      .maybeSingle();
    const row = data as Pending | null;
    if (!row || new Date(row.exp).getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "That sign-in expired. Enter your password again.", expired: true },
        { status: 400 }
      );
    }
    pending = row;
    userId = row.user_id;
  } else {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
    userId = user.id;
  }

  const attemptKey = twoFactorAttemptKey(userId);
  const { count } = await admin
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("login", attemptKey)
    .gte("time", Date.now() - TFA_WINDOW_MS);
  if (limitReached(count, TFA_LIMIT)) {
    return NextResponse.json(
      { ok: false, error: "Too many codes. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const result = await verifyUserCode(userId, code);
  if (!result.ok) {
    await admin.from("login_attempts").insert({
      ip_address: clientIp(req),
      login: attemptKey,
      time: Date.now(),
    });
    return NextResponse.json({ ok: false, error: "That code is not valid." }, { status: 400 });
  }
  await admin.from("login_attempts").delete().eq("login", attemptKey);

  let isAdmin = false;
  if (pending) {
    const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
    isAdmin = Boolean((profile as { is_admin?: boolean } | null)?.is_admin);
  }

  const res = NextResponse.json({ ok: true, usedRecovery: result.usedRecovery, isAdmin });
  res.cookies.set(MFA_COOKIE, issueMfaToken(userId), { ...mfaCookieOptions(), maxAge: 900 });

  if (remember) {
    const token = await trustDevice(userId, req.headers.get("user-agent"));
    if (token) {
      res.cookies.set(TRUSTED_DEVICE_COOKIE, token, {
        ...trustedDeviceCookieOptions(),
        maxAge: TRUSTED_DEVICE_MAX_AGE_SECONDS,
      });
    }
  }

  if (pending) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const ssr = createServerClient<Database>(url, anon, {
      cookies: {
      async getAll() {
        return (await cookies()).getAll();
      },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });
    await ssr.auth.setSession({
      access_token: pending.access_token,
      refresh_token: pending.refresh_token,
    });
    await admin.from("login_pending_2fa").delete().eq("id", pending.id);
  }

  return res;
}
