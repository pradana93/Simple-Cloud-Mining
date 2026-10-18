import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";

function generatePassword(len = 20) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function POST(req: Request) {
  const supabase = createServerSupabase();
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  }

  try {
    const admin = createAdminSupabase();
    const { data: me } = await admin.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
    if (!(me as { is_admin?: boolean } | null)?.is_admin) {
      return NextResponse.json({ ok: false, error: "Admins only" }, { status: 403 });
    }

    let target: string | null = null;
    try {
      const body = (await req.json()) as { userId?: unknown };
      target = typeof body?.userId === "string" ? body.userId : null;
    } catch {
      target = null;
    }
    if (!target) {
      return NextResponse.json({ ok: false, error: "userId is required" }, { status: 400 });
    }

    const password = generatePassword();
    const { error } = await admin.auth.admin.updateUserById(target, { password });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, password });
  } catch {
    return NextResponse.json({ ok: false, error: "Reset failed" }, { status: 500 });
  }
}
