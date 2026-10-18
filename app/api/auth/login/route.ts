import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { Database } from "@/lib/types";

export const dynamic = "force-dynamic";

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
  const password = String(body.password ?? "");
  if (!raw || !password) {
    return NextResponse.json({ ok: false, error: "Username and password are required" }, { status: 400 });
  }

  try {
    const admin = createAdminSupabase();
    const ip = (req.headers.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 45);
    const since = Date.now() - 10 * 60 * 1000;
    const { count } = await admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("login", raw)
      .gte("time", since);
    if ((count ?? 0) >= 10) {
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
      await admin.from("login_attempts").insert({ ip_address: ip, login: raw, time: Date.now() });
      return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = NextResponse.json({ ok: true, isAdmin: Boolean(row.is_admin) });
    const supabase = createServerClient<Database>(url, anon, {
      cookies: {
        getAll() {
          return cookies().getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    });

    const { error } = await supabase.auth.signInWithPassword({ email: row.email, password });
    if (error) {
      await admin.from("login_attempts").insert({ ip_address: ip, login: raw, time: Date.now() });
      return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
    }
    await admin.from("login_attempts").delete().eq("login", raw);
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Sign-in is unavailable right now" }, { status: 500 });
  }
}
