import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";

export const dynamic = "force-dynamic";

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
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Invoice id is required" }, { status: 400 });

  try {
    const admin = createAdminSupabase();
    const { data: row } = await admin.from("transactions_history").select("id,status").eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });
    const status = String((row as { status: string }).status ?? "").toLowerCase();
    if (status === "paid") return NextResponse.json({ ok: false, error: "Paid invoices cannot be canceled" }, { status: 409 });
    if (status === "canceled") return NextResponse.json({ ok: false, error: "Already canceled" }, { status: 409 });

    const { error } = await admin.from("transactions_history").update({ status: "canceled" }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, message: "Invoice canceled" });
  } catch {
    return NextResponse.json({ ok: false, error: "Action failed" }, { status: 500 });
  }
}
