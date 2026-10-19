import type { InstantGame, PlayResult } from "./types";
import { clamp, floorTo, toNumber } from "./util";

// Roll a number from 0.00 to 99.99 and bet whether it lands under or over a
// target. Win chance is the target width, payout is 0.99 / chance, so the
// expected return is 99 percent on any target. A 1 percent house edge.

export type DiceParams = { target: number; mode: "under" | "over" };

export function diceChance(p: DiceParams): number {
  return p.mode === "under" ? p.target / 100 : (100 - p.target) / 100;
}

export function diceMultiplier(p: DiceParams): number {
  return floorTo(0.99 / diceChance(p), 2);
}

export const dice: InstantGame<DiceParams> = {
  id: "dice",
  floats: () => 1,
  normalize(raw: unknown): DiceParams {
    const r = (raw ?? {}) as { target?: unknown; mode?: unknown };
    const mode = r.mode === "over" ? "over" : "under";
    const target = floorTo(clamp(toNumber(r.target, 50), 2, 98), 2);
    return { target, mode };
  },
  play(p, [f]): PlayResult {
    const roll = floorTo((f ?? 0) * 100, 2);
    const won = p.mode === "under" ? roll < p.target : roll > p.target;
    const multiplier = won ? diceMultiplier(p) : 0;
    return { multiplier, won, detail: { roll, target: p.target, mode: p.mode } };
  },
};
