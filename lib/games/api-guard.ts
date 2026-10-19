import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabase } from "../supabase/server";
import { getSettings } from "../settings";
import type { SiteSettings } from "../types";
import { toLedger } from "./util";

// Shared gate for every casino route: a signed-in member, the casino switched
// on, and a stake inside the configured bounds.

export type Player = { id: string };

export async function requirePlayer(): Promise<
  { player: Player; settings: SiteSettings } | { error: NextResponse }
> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ ok: false, error: "Not authenticated" }, { status: 401 }) };
  }
  const settings = await getSettings();
  if (!settings.games_enabled) {
    return { error: NextResponse.json({ ok: false, error: "The casino is closed" }, { status: 403 }) };
  }
  return { player: { id: (user as User).id }, settings };
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
