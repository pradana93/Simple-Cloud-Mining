import { NextResponse } from "next/server";
import { requirePlayer, playerEcon, validateStake, gameClosed } from "@/lib/games/api-guard";
import { playInstant } from "@/lib/games/engine";

export async function POST(req: Request) {
  const gate = await requirePlayer();
  if ("error" in gate) return gate.error;

  let body: { game?: unknown; stake?: unknown; params?: unknown; idempotencyKey?: unknown };
  try {
    body = (await req.json()) as { game?: unknown; stake?: unknown; params?: unknown; idempotencyKey?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const gameId = String(body.game ?? "");
  const econ = await playerEcon(gate.player, gate.settings, gameId);
  const closed = gameClosed(econ, gameId);
  if (closed) return closed;
  const stake = validateStake(body.stake, econ, gate.settings.currency_code);
  if ("error" in stake) return NextResponse.json({ ok: false, error: stake.error }, { status: 400 });

  const outcome = await playInstant({
    userId: gate.player.id,
    gameId,
    stake: stake.stake,
    params: body.params,
    req,
    econ,
    idempotencyKey:
      typeof body.idempotencyKey === "string"
        ? body.idempotencyKey
        : req.headers.get("idempotency-key") ?? undefined,
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
