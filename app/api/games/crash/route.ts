import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/games/api-guard";
import { crashState } from "@/lib/games/crash-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePlayer({ allowClosed: true });
  if ("error" in gate) return gate.error;

  const state = await crashState(gate.player.id);
  return NextResponse.json({ ok: true, serverNow: new Date().toISOString(), ...state });
}
