import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-admin";
import { runPayoutPass } from "@/lib/payout-reconcile";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gate = await requireAdminApi();
  if ("error" in gate) return gate.error;

  try {
    const summary = await runPayoutPass();
    await recordAudit({ actor: { id: gate.userId, name: gate.name }, action: "withdrawal.pass", detail: { ...summary }, req });
    const skipped = summary.skipped ? ` ${summary.skipped}` : "";
    return NextResponse.json({
      ok: true,
      message: `Sent ${summary.autoSent}, failed ${summary.autoFailed}, reset ${summary.staleReset}, aged ${summary.agedPending}.${skipped}`,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Payout pass failed" }, { status: 500 });
  }
}
