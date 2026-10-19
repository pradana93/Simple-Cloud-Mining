import type { SiteSettings } from "../types";
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
  // Game ids the owner has switched off.
  disabled: string[];
};

export const NEUTRAL_ECON: CasinoEcon = { edgeBoost: 0, maxWin: 0, disabled: [] };

export function casinoEcon(settings: SiteSettings): CasinoEcon {
  const edgeBoost = clamp(Number(settings.games_edge_boost) || 0, 0, MAX_EDGE);
  const maxWin = Math.max(0, Number(settings.games_max_win) || 0);
  const disabled = String(settings.games_disabled ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return { edgeBoost, maxWin, disabled };
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
