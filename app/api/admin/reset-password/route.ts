import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";

function generatePassword(len = 20) {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  try {
    const admin = createAdminSupabase();

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
    await recordAudit({ actor: { id: gate.userId, name: gate.name }, action: "member.reset_password", target, req });
    return NextResponse.json({ ok: true, password });
  } catch {
    return NextResponse.json({ ok: false, error: "Reset failed" }, { status: 500 });
  }
}
