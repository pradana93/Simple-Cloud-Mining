import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/games/api-guard";
import { getActiveRound } from "@/lib/games/mines-engine";

export async function GET() {
  const gate = await requirePlayer();
  if ("error" in gate) return gate.error;

  const active = await getActiveRound(gate.player.id);
  return NextResponse.json({ ok: true, ...active });
}
