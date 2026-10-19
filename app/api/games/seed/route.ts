import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getSeedView, rotateSeed, setClientSeed } from "@/lib/games/engine";

async function playerId(): Promise<string | null> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const id = await playerId();
  if (!id) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const settings = await getSettings();
  if (!settings.games_enabled) {
    return NextResponse.json({ ok: false, error: "The casino is closed" }, { status: 403 });
  }
  const seed = await getSeedView(id);
  return NextResponse.json({ ok: true, seed });
}

export async function POST(req: Request) {
  const id = await playerId();
  if (!id) return NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 });
  const settings = await getSettings();
  if (!settings.games_enabled) {
    return NextResponse.json({ ok: false, error: "The casino is closed" }, { status: 403 });
  }

  let body: { action?: unknown; clientSeed?: unknown };
  try {
    body = (await req.json()) as { action?: unknown; clientSeed?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const action = String(body.action ?? "");
  if (action === "rotate") {
    const seed = await rotateSeed(id);
    return NextResponse.json({ ok: true, seed });
  }
  if (action === "set-client") {
    const seed = await setClientSeed(id, String(body.clientSeed ?? ""));
    return NextResponse.json({ ok: true, seed });
  }
  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
}
