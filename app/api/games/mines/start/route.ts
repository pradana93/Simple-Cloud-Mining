import { NextResponse } from "next/server";
import { requirePlayer, validateStake } from "@/lib/games/api-guard";
import { startMines } from "@/lib/games/mines-engine";

export async function POST(req: Request) {
  const gate = await requirePlayer();
  if ("error" in gate) return gate.error;

  let body: { stake?: unknown; mines?: unknown };
  try {
    body = (await req.json()) as { stake?: unknown; mines?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const stake = validateStake(body.stake, gate.settings);
  if ("error" in stake) return NextResponse.json({ ok: false, error: stake.error }, { status: 400 });

  const outcome = await startMines({
    userId: gate.player.id,
    stake: stake.stake,
    mines: body.mines,
    req,
  });
  if (!outcome.ok) {
    return NextResponse.json(
      { ok: false, error: outcome.error, roundId: outcome.roundId },
      { status: outcome.status }
    );
  }
  return NextResponse.json({ ...outcome, stake: stake.stake });
}
