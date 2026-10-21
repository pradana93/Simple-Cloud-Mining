import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/audit";
import type { Database } from "@/lib/types";

export const dynamic = "force-dynamic";

const MIN_PASSWORD = 10;

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = (await req.json()) as { currentPassword?: unknown; newPassword?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const currentPassword = String(body.currentPassword ?? "");
  const newPassword = String(body.newPassword ?? "");
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ ok: false, error: "Current and new password are required" }, { status: 400 });
  }
  if (newPassword.length < MIN_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: `New password must be at least ${MIN_PASSWORD} characters` },
      { status: 400 }
    );
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ ok: false, error: "Choose a different password" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: profile } = await admin.from("profiles").select("email").eq("id", user.id).maybeSingle();
  const email = (profile as { email?: string | null } | null)?.email;
  if (!email) return NextResponse.json({ ok: false, error: "No email on file" }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const plain = createClient<Database>(url, anon, { auth: { persistSession: false } });
  const { error: checkError } = await plain.auth.signInWithPassword({ email, password: currentPassword });
  if (checkError) {
    return NextResponse.json({ ok: false, error: "Current password is not correct" }, { status: 400 });
  }

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  await recordAudit({
    actor: { id: user.id, name: null },
    action: "member.password_change",
    target: user.id,
    req,
  });
  return NextResponse.json({ ok: true, message: "Password updated" });
}
