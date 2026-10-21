import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

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

    const { data: profile } = await admin
      .from("profiles")
      .select("email,is_admin,username")
      .eq("id", target)
      .maybeSingle();
    const p = profile as { email: string | null; is_admin: boolean | null; username: string | null } | null;
    if (!p?.email) {
      return NextResponse.json({ ok: false, error: "Member has no email on file" }, { status: 400 });
    }
    if (p.is_admin && target !== gate.userId) {
      return NextResponse.json(
        { ok: false, error: "Use the other admin's own account to reset their password." },
        { status: 403 }
      );
    }

    const baseUrl = new URL(req.url).origin;
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: p.email,
      options: { redirectTo: `${baseUrl}/reset-password` },
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    const link = (data as { properties?: { action_link?: string } } | null)?.properties?.action_link;
    if (!link) {
      return NextResponse.json({ ok: false, error: "Could not create a reset link" }, { status: 500 });
    }

    await recordAudit({
      actor: { id: gate.userId, name: gate.name },
      action: "member.reset_password",
      target,
      detail: { username: p.username, method: "recovery_link" },
      req,
    });
    return NextResponse.json({ ok: true, resetLink: link });
  } catch {
    return NextResponse.json({ ok: false, error: "Reset failed" }, { status: 500 });
  }
}
