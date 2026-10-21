import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/api-admin";
import { recordAudit } from "@/lib/audit";
import { firstRow } from "@/lib/ledger";

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
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  }

  const tx = String(body.tx ?? "").trim().slice(0, 191) || null;

  try {
    const { data, error } = await createAdminSupabase().rpc("settle_withdrawal", {
      p_id: id,
      p_action: action,
      p_tx: action === "approve" ? tx : null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const row = firstRow<{ status?: string; withdrawal_status?: string; balance?: unknown }>(data);
    const status = String(row?.status ?? "");

    if (status === "missing") {
      return NextResponse.json({ ok: false, error: "Withdrawal not found" }, { status: 404 });
    }
    if (status === "already_settled") {
      return NextResponse.json(
        { ok: false, error: `Already ${String(row?.withdrawal_status ?? "").toLowerCase()}` },
        { status: 409 }
      );
    }
    if (status === "invalid_state") {
      return NextResponse.json(
        { ok: false, error: "This payout is already processing at the wallet. Check it before refunding." },
        { status: 409 }
      );
    }
    if (status !== "applied") {
      return NextResponse.json({ ok: false, error: "Could not settle the withdrawal" }, { status: 500 });
    }

    revalidateTag("payouts");
    await recordAudit({
      actor: { id: gate.userId, name: gate.name },
      action: action === "approve" ? "withdrawal.approve" : "withdrawal.reject",
      target: String(id),
      detail: { tx, balance: row?.balance },
      req,
    });

    return NextResponse.json({
      ok: true,
      message:
        action === "approve"
          ? "Withdrawal marked paid"
          : "Rejected and refunded the withdrawal amount",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "Action failed" }, { status: 500 });
  }
}
