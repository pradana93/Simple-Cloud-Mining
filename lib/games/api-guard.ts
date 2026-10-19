import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "../supabase/server";
import { getAdminSettings } from "../settings";
import type { SiteSettings } from "../types";
import { toLedger } from "./util";
import { casinoEcon, isGameDisabled, type CasinoEcon } from "./econ";

// Shared gate for every casino route: a signed-in member, the casino switched
// on, and a stake inside the configured bounds. The operator economy is read
// with the service role so the extra edge and win cap never leave the server.

export type Player = { id: string };

export async function requirePlayer(): Promise<
  { player: Player; settings: SiteSettings; econ: CasinoEcon } | { error: NextResponse }
> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 }) };
  }
  const settings = await getAdminSettings();
  if (!settings.games_enabled) {
    return { error: NextResponse.json({ ok: false, error: "The casino is closed" }, { status: 403 }) };
  }
  return { player: { id: (user as User).id }, settings, econ: casinoEcon(settings) };
}

// Blocks a route when the owner has switched that game off.
export function gameClosed(econ: CasinoEcon, gameId: string): NextResponse | null {
  if (isGameDisabled(econ, gameId)) {
    return NextResponse.json({ ok: false, error: "That game is closed" }, { status: 403 });
  }
  return null;
}

export function validateStake(
  raw: unknown,
  settings: SiteSettings
): { stake: number } | { error: string } {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { error: "Enter a stake above zero" };
  const stake = toLedger(n);
  if (stake <= 0) return { error: "Enter a stake above zero" };
  if (settings.games_min_bet > 0 && stake < settings.games_min_bet) {
    return { error: `Minimum stake is ${settings.games_min_bet} ${settings.currency_code}` };
  }
  if (settings.games_max_bet > 0 && stake > settings.games_max_bet) {
    return { error: `Maximum stake is ${settings.games_max_bet} ${settings.currency_code}` };
  }
  return { stake };
}
