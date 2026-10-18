import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";

export const dynamic = "force-dynamic";

const STATUSES = ["unread", "read", "replied"];

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Message id is required" }, { status: 400 });

  if (body.action === "delete") {
    const { error } = await createAdminSupabase().from("contact").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Message deleted" });
  }

  const status = String(body.status ?? "");
  if (!STATUSES.includes(status)) return NextResponse.json({ ok: false, error: "Invalid status" }, { status: 400 });
  const { error } = await createAdminSupabase().from("contact").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, message: `Marked ${status}` });
}
