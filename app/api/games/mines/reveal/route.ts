import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/games/api-guard";
import { revealMines } from "@/lib/games/mines-engine";

export async function POST(req: Request) {
  const gate = await requirePlayer();
  if ("error" in gate) return gate.error;

  let body: { roundId?: unknown; tile?: unknown };
  try {
    body = (await req.json()) as { roundId?: unknown; tile?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const roundId = Number(body.roundId);
  if (!Number.isInteger(roundId)) {
    return NextResponse.json({ ok: false, error: "Invalid round" }, { status: 400 });
  }

  const outcome = await revealMines({
    userId: gate.player.id,
    roundId,
    tile: Number(body.tile),
    req,
  });
  if (!outcome.ok) return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status });
  return NextResponse.json(outcome);
}
