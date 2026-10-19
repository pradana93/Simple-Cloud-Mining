import { NextResponse } from "next/server";
import { requirePlayer, playerEcon, gameClosed } from "@/lib/games/api-guard";
import { getActiveRound } from "@/lib/games/mines-engine";

export async function GET() {
  const gate = await requirePlayer();
  if ("error" in gate) return gate.error;

  const econ = await playerEcon(gate.player, gate.settings, "mines");
  const closed = gameClosed(econ, "mines");
  if (closed) return closed;

  const active = await getActiveRound(gate.player.id, econ);
  return NextResponse.json({ ok: true, ...active });
}
