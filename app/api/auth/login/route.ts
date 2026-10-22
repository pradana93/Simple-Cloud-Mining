import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { recordEvent } from "@/lib/risk-telemetry";
import { isTwoFactorEnabled } from "@/lib/two-factor";
import { MFA_COOKIE, issueMfaToken, mfaCookieOptions } from "@/lib/mfa-cookie";
import { hasTrustedDevice } from "@/lib/trusted-device";
import {
  LOGIN_IP_LIMIT,
  LOGIN_NAME_LIMIT,
  LOGIN_WINDOW_MS,
  clientIp,
  limitReached,
  normalizeLogin,
} from "@/lib/login-throttle";
import type { Database } from "@/lib/types";

export const dynamic = "force-dynamic";

async function attachSession(
  res: NextResponse,
  accessToken: string,
  refreshToken: string
): Promise<NextResponse> {
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
  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  return res;
}

// Credentials are username + password only. Usernames live on `profiles`,
// which RLS hides from the browser, so the lookup runs with the service role
// and the password is verified against the resolved email.
export async function POST(req: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const raw = String(body.username ?? "").trim();
  const loginKey = normalizeLogin(raw);
  const password = String(body.password ?? "");
  if (!raw || !password) {
    return NextResponse.json({ ok: false, error: "Username and password are required" }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    const ip = clientIp(req);
    const since = Date.now() - LOGIN_WINDOW_MS;
    const [{ count: nameCount }, { count: ipCount }] = await Promise.all([
      admin
        .from("login_attempts")
        .select("id", { count: "exact", head: true })
        .eq("login", loginKey)
        .gte("time", since),
      ip
        ? admin
            .from("login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_address", ip)
            .gte("time", since)
        : Promise.resolve({ count: 0 }),
    ]);
    if (limitReached(nameCount, LOGIN_NAME_LIMIT) || limitReached(ipCount, LOGIN_IP_LIMIT)) {
      return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
    }
    type Lite = { email: string | null; is_admin: boolean };
    let row: Lite | null = null;

    const { data: exact } = await admin
      .from("profiles")
      .select("email,is_admin")
      .eq("username", raw)
      .maybeSingle();
    row = (exact as Lite | null) ?? null;

    if (!row) {
      const pattern = raw.replace(/([%_\\])/g, "\\$1");
      const { data: ci } = await admin
        .from("profiles")
        .select("email,is_admin")
        .ilike("username", pattern)
        .limit(2);
      const rows = (ci ?? []) as Lite[];
      if (rows.length === 1) row = rows[0];
    }

    if (!row?.email) {
      await admin.from("login_attempts").insert({ ip_address: ip, login: loginKey, time: Date.now() });
      return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Verify the password on a throwaway client so no session is granted yet.
    const plain = createClient<Database>(url, anon, { auth: { persistSession: false } });
    const { data: signIn, error } = await plain.auth.signInWithPassword({ email: row.email, password });
    if (error || !signIn.session || !signIn.user) {
      await admin.from("login_attempts").insert({ ip_address: ip, login: loginKey, time: Date.now() });
      return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
    }
    await admin.from("login_attempts").delete().eq("login", loginKey);
    await recordEvent({ userId: signIn.user.id, kind: "login", req });

    // Members with 2FA on are not signed in until they clear the code gate,
    // unless this browser was previously trusted after a valid code.
    if (await isTwoFactorEnabled(signIn.user.id)) {
      const userAgent = req.headers.get("user-agent");
      let trusted = false;
      try {
        trusted = await hasTrustedDevice(signIn.user.id, userAgent);
      } catch {
        trusted = false;
      }
      if (trusted) {
        const res = NextResponse.json({
          ok: true,
          isAdmin: Boolean(row.is_admin),
          trustedDevice: true,
        });
        await attachSession(res, signIn.session.access_token, signIn.session.refresh_token);
        res.cookies.set(MFA_COOKIE, issueMfaToken(signIn.user.id), {
          ...mfaCookieOptions(),
          maxAge: 900,
        });
        return res;
      }

      const { data: pending } = await admin
        .from("login_pending_2fa")
        .insert({
          user_id: signIn.user.id,
          access_token: signIn.session.access_token,
          refresh_token: signIn.session.refresh_token,
          exp: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        })
        .select("id")
        .maybeSingle();
      const ticket = (pending as { id: string } | null)?.id ?? null;
      return NextResponse.json({ ok: true, totpRequired: true, ticket });
    }

    const res = NextResponse.json({ ok: true, isAdmin: Boolean(row.is_admin) });
    return attachSession(res, signIn.session.access_token, signIn.session.refresh_token);
  } catch {
    return NextResponse.json({ ok: false, error: "Sign-in is unavailable right now" }, { status: 500 });
  }
}
