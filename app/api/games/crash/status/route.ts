import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/games/api-guard";
import { crashStatus } from "@/lib/games/crash-engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requirePlayer({ allowClosed: true });
  if ("error" in gate) return gate.error;

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Missing round" }, { status: 400 });
  }

  const outcome = await crashStatus(gate.player.id, id);
  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json({
    ok: true,
    serverNow: new Date().toISOString(),
    round: outcome.round,
    balance: outcome.balance,
    paid: outcome.paid,
    multiplier: outcome.multiplier,
  });
}
