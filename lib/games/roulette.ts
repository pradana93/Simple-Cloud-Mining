import type { InstantGame, PlayResult } from "./types";
import { toInt } from "./util";

// European roulette, single zero, 37 pockets. Even money bets return 2x,
// a straight number returns 36x. Both carry a 2.70 percent house edge, which
// is the true edge of a single-zero wheel.

export type RouletteBet =
  | "red"
  | "black"
  | "green"
  | "odd"
  | "even"
  | "low"
  | "high"
  | "number";

export type RouletteParams = { bet: RouletteBet; number?: number };

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BETS: RouletteBet[] = ["red", "black", "green", "odd", "even", "low", "high", "number"];

export function pocketColor(n: number): "green" | "red" | "black" {
  if (n === 0) return "green";
  return RED.has(n) ? "red" : "black";
}

export function rouletteWins(bet: RouletteBet, number: number, pocket: number): boolean {
  switch (bet) {
    case "red":
      return pocket !== 0 && RED.has(pocket);
    case "black":
      return pocket !== 0 && !RED.has(pocket);
    case "green":
      return pocket === 0;
    case "odd":
      return pocket !== 0 && pocket % 2 === 1;
    case "even":
      return pocket !== 0 && pocket % 2 === 0;
    case "low":
      return pocket >= 1 && pocket <= 18;
    case "high":
      return pocket >= 19 && pocket <= 36;
    case "number":
      return pocket === number;
    default:
      return false;
  }
}

export function rouletteMultiplier(bet: RouletteBet): number {
  return bet === "number" || bet === "green" ? 36 : 2;
}

export const roulette: InstantGame<RouletteParams> = {
  id: "roulette",
  floats: () => 1,
  normalize(raw: unknown): RouletteParams {
    const r = (raw ?? {}) as { bet?: unknown; number?: unknown };
    const bet = BETS.includes(r.bet as RouletteBet) ? (r.bet as RouletteBet) : "red";
    if (bet === "number") {
      const n = toInt(r.number, -1);
      if (n < 0 || n > 36) throw new Error("Pick a number from 0 to 36");
      return { bet, number: n };
    }
    return { bet };
  },
  play(p, [f]): PlayResult {
    const pocket = Math.min(36, Math.floor((f ?? 0) * 37));
    const won = rouletteWins(p.bet, p.number ?? -1, pocket);
    const multiplier = won ? rouletteMultiplier(p.bet) : 0;
    return {
      multiplier,
      won,
      detail: { pocket, color: pocketColor(pocket), bet: p.bet, number: p.number ?? null },
    };
  },
};
