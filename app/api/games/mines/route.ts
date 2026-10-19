import { NextResponse } from "next/server";
import { requirePlayer, gameClosed } from "@/lib/games/api-guard";
import { getActiveRound } from "@/lib/games/mines-engine";

export async function GET() {
  const gate = await requirePlayer();
  if ("error" in gate) return gate.error;

  const closed = gameClosed(gate.econ, "mines");
  if (closed) return closed;

  const active = await getActiveRound(gate.player.id, gate.econ);
  return NextResponse.json({ ok: true, ...active });
}
