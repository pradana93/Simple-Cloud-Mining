import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/games/api-guard";
import { getSeedView, rotateSeed, setClientSeed } from "@/lib/games/engine";

// Seed management stays available while the tables are paused. It changes no
// balance and a member may need to reveal a seed to check an old round.

export async function GET() {
  const gate = await requirePlayer({ allowClosed: true });
  if ("error" in gate) return gate.error;
  const seed = await getSeedView(gate.player.id);
  return NextResponse.json({ ok: true, seed });
}

export async function POST(req: Request) {
  const gate = await requirePlayer({ allowClosed: true });
  if ("error" in gate) return gate.error;

  let body: { action?: unknown; clientSeed?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; clientSeed?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  if (action === "rotate") {
    const seed = await rotateSeed(gate.player.id);
    return NextResponse.json({ ok: true, seed });
  }
  if (action === "set-client") {
    const seed = await setClientSeed(gate.player.id, String(body.clientSeed ?? ""));
    return NextResponse.json({ ok: true, seed });
  }
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
