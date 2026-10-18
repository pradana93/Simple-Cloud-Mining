import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
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
  const action = String(body.action ?? "");
  const id = Number(body.id);
  if (!Number.isFinite(id)) return NextResponse.json({ ok: false, error: "Withdrawal id is required" }, { status: 400 });

  const admin = createAdminSupabase();
  try {
    const { data: row } = await admin.from("user_withdrawal").select("id,user_id,amount,status").eq("id", id).maybeSingle();
    if (!row) return NextResponse.json({ ok: false, error: "Withdrawal not found" }, { status: 404 });
    const w = row as { user_id: string; amount: number; status: string };
    const current = String(w.status ?? "").toUpperCase();
    if (current === "SUCCESS" || current === "CANCELED") {
      return NextResponse.json({ ok: false, error: `Already ${current.toLowerCase()}` }, { status: 409 });
    }

    if (action === "approve") {
      const tx = String(body.tx ?? "").trim().slice(0, 191) || null;
      const { error } = await admin
        .from("user_withdrawal")
        .update({ status: "SUCCESS", tx, date_paid: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      revalidateTag("payouts");
      return NextResponse.json({ ok: true, message: "Withdrawal marked paid" });
    }

    if (action === "reject") {
      const { error } = await admin
        .from("user_withdrawal")
        .update({ status: "CANCELED", date_paid: new Date().toISOString() })
        .eq("id", id);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      const { data: profile } = await admin.from("profiles").select("balance").eq("id", w.user_id).maybeSingle();
      if (profile) {
        const next = Number((profile as { balance: number }).balance) + Number(w.amount);
        await admin.from("profiles").update({ balance: next }).eq("id", w.user_id);
      }
      revalidateTag("payouts");
      return NextResponse.json({ ok: true, message: `Rejected and refunded ${Number(w.amount).toFixed(8)}` });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Action failed" }, { status: 500 });
  }
}
