import type { SiteSettings } from "../types";
import { createAdminSupabase } from "../supabase/admin";
import { clamp, toLedger } from "./util";

// Operator controls for the casino. These let an owner dial profitability
// without touching the outcome itself: the result still comes from the
// committed seed and stays verifiable, while the payout is scaled by an extra
// edge and optionally capped. The raw roll/pocket/draw is always stored, so a
// member can still re-derive the round and check the receipt.

export const MAX_EDGE = 50;

export type CasinoEcon = {
  // Percent taken off every payout, 0 to 50.
  edgeBoost: number;
  // Absolute payout ceiling in the site currency. 0 means no ceiling.
  maxWin: number;
  // Stake floor and cap in the site currency. 0 means no bound.
  minBet: number;
  maxBet: number;
  // Game ids the owner has switched off.
  disabled: string[];
};

export type GameOverride = {
  edge?: number;
  maxWin?: number;
  min?: number;
  max?: number;
};

export type Tier = {
  id: string;
  name: string;
  minWager: number;
  edge?: number;
  maxWin?: number;
};

export type Schedule = {
  enabled: boolean;
  startHour: number;
  endHour: number;
  edgeDelta: number;
};

export const NEUTRAL_ECON: CasinoEcon = {
  edgeBoost: 0,
  maxWin: 0,
  minBet: 0,
  maxBet: 0,
  disabled: [],
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function optNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseConfig(v: unknown): Record<string, GameOverride> {
  const out: Record<string, GameOverride> = {};
  const rec = asRecord(v);
  const keys = Object.keys(rec);
  for (let i = 0; i < keys.length; i++) {
    const g = asRecord(rec[keys[i]]);
    out[keys[i].toLowerCase()] = {
      edge: optNum(g.edge),
      maxWin: optNum(g.maxWin),
      min: optNum(g.min),
      max: optNum(g.max),
    };
  }
  return out;
}

export function parseTiers(v: unknown): Tier[] {
  if (!Array.isArray(v)) return [];
  const out: Tier[] = [];
  for (let i = 0; i < v.length; i++) {
    const t = asRecord(v[i]);
    const name = String(t.name ?? "").trim();
    if (!name) continue;
    out.push({
      id: String(t.id ?? `tier-${i}`),
      name,
      minWager: Math.max(0, optNum(t.minWager) ?? 0),
      edge: optNum(t.edge),
      maxWin: optNum(t.maxWin),
    });
  }
  out.sort((a, b) => a.minWager - b.minWager);
  return out;
}

export function parseSchedule(v: unknown): Schedule {
  const s = asRecord(v);
  return {
    enabled: Boolean(s.enabled),
    startHour: clamp(Math.trunc(optNum(s.startHour) ?? 0), 0, 23),
    endHour: clamp(Math.trunc(optNum(s.endHour) ?? 0), 0, 23),
    edgeDelta: clamp(optNum(s.edgeDelta) ?? 0, -MAX_EDGE, MAX_EDGE),
  };
}

// Highest tier the wager qualifies for. Tiers are sorted ascending by minWager.
export function matchTier(tiers: Tier[], lifetimeWager: number): Tier | null {
  let best: Tier | null = null;
  for (let i = 0; i < tiers.length; i++) {
    if (tiers[i].minWager <= lifetimeWager) best = tiers[i];
  }
  return best;
}

// UTC-hour window. Equal hours means all day; start > end wraps midnight.
export function inWindow(s: Schedule, now: Date): boolean {
  if (!s.enabled) return false;
  const h = now.getUTCHours();
  if (s.startHour === s.endHour) return true;
  if (s.startHour < s.endHour) return h >= s.startHour && h < s.endHour;
  return h >= s.startHour || h < s.endHour;
}

// Global defaults from the settings row.
export function casinoEcon(settings: SiteSettings): CasinoEcon {
  const edgeBoost = clamp(Number(settings.games_edge_boost) || 0, 0, MAX_EDGE);
  const maxWin = Math.max(0, Number(settings.games_max_win) || 0);
  const minBet = Math.max(0, Number(settings.games_min_bet) || 0);
  const maxBet = Math.max(0, Number(settings.games_max_bet) || 0);
  const disabled = String(settings.games_disabled ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return { edgeBoost, maxWin, minBet, maxBet, disabled };
}

// Effective economy for one game and player: global -> per-game override ->
// tier -> time window. Later stages win for the fields they set.
export function resolveEcon(
  settings: SiteSettings,
  gameId: string,
  lifetimeWager: number,
  now: Date
): CasinoEcon {
  const econ = casinoEcon(settings);
  const cfg = parseConfig(settings.games_config)[gameId.toLowerCase()];
  if (cfg) {
    if (cfg.edge !== undefined) econ.edgeBoost = clamp(cfg.edge, 0, MAX_EDGE);
    if (cfg.maxWin !== undefined) econ.maxWin = Math.max(0, cfg.maxWin);
    if (cfg.min !== undefined) econ.minBet = Math.max(0, cfg.min);
    if (cfg.max !== undefined) econ.maxBet = Math.max(0, cfg.max);
  }
  const tier = matchTier(parseTiers(settings.games_tiers), lifetimeWager);
  if (tier) {
    if (tier.edge !== undefined) econ.edgeBoost = clamp(tier.edge, 0, MAX_EDGE);
    if (tier.maxWin !== undefined) econ.maxWin = Math.max(0, tier.maxWin);
  }
  const sched = parseSchedule(settings.games_schedule);
  if (inWindow(sched, now)) {
    econ.edgeBoost = clamp(econ.edgeBoost + sched.edgeDelta, 0, MAX_EDGE);
  }
  return econ;
}

export async function wagerOf(userId: string): Promise<number> {
  try {
    const { data } = await createAdminSupabase().rpc("game_wager_total", { p_user: userId });
    const n = Number(data ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function isGameDisabled(econ: CasinoEcon, gameId: string): boolean {
  return econ.disabled.includes(gameId.toLowerCase());
}

// Payout multiplier after the extra edge. Used for display so the numbers a
// member sees match what a cashout would pay.
export function scaleMultiplier(econ: CasinoEcon, multiplier: number): number {
  if (!(multiplier > 0)) return 0;
  return multiplier * (1 - econ.edgeBoost / 100);
}

export type AppliedPayout = {
  multiplier: number;
  payout: number;
  scaled: number;
  capped: boolean;
};

// Settles a win: apply the extra edge, floor to ledger precision, then clamp to
// the ceiling. The multiplier returned reflects the money actually paid.
export function applyPayout(econ: CasinoEcon, stake: number, multiplier: number): AppliedPayout {
  if (!(multiplier > 0) || !(stake > 0)) {
    return { multiplier: 0, payout: 0, scaled: 0, capped: false };
  }
  const scaled = scaleMultiplier(econ, multiplier);
  let payout = toLedger(stake * scaled);
  let capped = false;
  if (econ.maxWin > 0 && payout > econ.maxWin) {
    payout = toLedger(econ.maxWin);
    capped = true;
  }
  return { multiplier: payout / stake, payout, scaled, capped };
}
