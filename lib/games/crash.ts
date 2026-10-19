import type { InstantGame, PlayResult } from "./types";
import { clamp, floorTo, toNumber } from "./util";

// Crash: you set a cashout multiplier. The round crashes at 0.99 / (1 - f), so
// the chance it reaches your target m is 0.99 / m. One round in a hundred
// crashes instantly at 1.00x, which is flavor: for any target above 1.00 the
// expected return is still 99 percent. A 1 percent house edge.

export type CrashParams = { target: number };

const INSTANT_CRASH_FLOOR = 0.01;

export function crashPoint(f: number): number {
  if (f < INSTANT_CRASH_FLOOR) return 1;
  const clamped = Math.min(f, 1 - 1e-9);
  return Math.max(1, floorTo(0.99 / (1 - clamped), 2));
}

export const crash: InstantGame<CrashParams> = {
  id: "crash",
  floats: () => 1,
  normalize(raw: unknown): CrashParams {
    const r = (raw ?? {}) as { target?: unknown };
    return { target: floorTo(clamp(toNumber(r.target, 2), 1.01, 1_000_000), 2) };
  },
  play(p, [f]): PlayResult {
    const at = crashPoint(f ?? 0);
    const won = at >= p.target;
    return { multiplier: won ? p.target : 0, won, detail: { crashAt: at, target: p.target } };
  },
};
