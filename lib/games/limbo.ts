import type { InstantGame, PlayResult } from "./types";
import { clamp, floorTo, toNumber } from "./util";

// A single number game. The result is 0.99 / (1 - f), so the chance of landing
// at or above a target m is 0.99 / m. Expected return is 99 percent for any
// target. A 1 percent house edge.

export type LimboParams = { target: number };

export function limboResult(f: number): number {
  const clamped = Math.min(f, 1 - 1e-9);
  return floorTo(0.99 / (1 - clamped), 2);
}

export const limbo: InstantGame<LimboParams> = {
  id: "limbo",
  floats: () => 1,
  normalize(raw: unknown): LimboParams {
    const r = (raw ?? {}) as { target?: unknown };
    return { target: floorTo(clamp(toNumber(r.target, 2), 1.01, 1_000_000), 2) };
  },
  play(p, [f]): PlayResult {
    const result = limboResult(f ?? 0);
    const won = result >= p.target;
    return { multiplier: won ? p.target : 0, won, detail: { result, target: p.target } };
  },
};
