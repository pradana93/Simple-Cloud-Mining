import { NextResponse } from "next/server";
import { requirePlayer, validateStake } from "@/lib/games/api-guard";
import { playInstant } from "@/lib/games/engine";

export async function POST(req: Request) {
  const gate = await requirePlayer();
  if ("error" in gate) return gate.error;

  let body: { game?: unknown; stake?: unknown; params?: unknown };
  try {
    body = (await req.json()) as { game?: unknown; stake?: unknown; params?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const gameId = String(body.game ?? "");
  const stake = validateStake(body.stake, gate.settings);
  if ("error" in stake) return NextResponse.json({ ok: false, error: stake.error }, { status: 400 });

  const outcome = await playInstant({
    userId: gate.player.id,
    gameId,
    stake: stake.stake,
    params: body.params,
    req,
  });

  if (!outcome.ok) {
    return NextResponse.json({ ok: false, error: outcome.error }, { status: outcome.status });
  }
  return NextResponse.json({
    ok: true,
    game: gameId,
    stake: stake.stake,
    multiplier: outcome.result.multiplier,
    payout: outcome.payout,
    won: outcome.result.won,
    detail: outcome.result.detail,
    balance: outcome.balance,
    seed: outcome.seed,
  });
}
