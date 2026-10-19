import type { InstantGame, PlayResult } from "./types";
import { pickIndices } from "./util";

// Keno: pick 1 to 10 numbers from 40, the house draws 10, and the payout climbs
// with the number of matches. The tier table is set so the expected return is
// below 1 for every pick count.

export type KenoParams = { picks: number[] };

export const KENO_MAX = 40;
export const KENO_DRAW = 10;

// Multiplier by match count, per pick count. A 0 means no prize at that tier.
const PAYOUTS: Record<number, Record<number, number>> = {
  1: { 1: 3.6 },
  2: { 2: 9, 1: 1 },
  3: { 3: 16, 2: 2, 1: 1 },
  4: { 4: 190, 3: 5, 2: 1.2 },
  5: { 5: 450, 4: 15, 3: 3, 2: 1.2 },
  6: { 6: 6000, 5: 70, 4: 9, 3: 1.6 },
  7: { 7: 20000, 6: 300, 5: 40, 4: 5, 3: 1.2 },
  8: { 8: 50000, 7: 3000, 6: 200, 5: 15, 4: 2.5 },
  9: { 9: 50000, 8: 12000, 7: 600, 6: 90, 5: 8, 4: 2 },
  10: { 10: 50000, 9: 20000, 8: 3000, 7: 250, 6: 35, 5: 5, 4: 1.2 },
};

export function kenoPayout(picks: number, matches: number): number {
  return PAYOUTS[picks]?.[matches] ?? 0;
}

export function kenoTable(picks: number): Record<number, number> {
  return PAYOUTS[picks] ?? {};
}

export const keno: InstantGame<KenoParams> = {
  id: "keno",
  floats: () => KENO_DRAW,
  normalize(raw: unknown): KenoParams {
    const r = (raw ?? {}) as { picks?: unknown };
    const seen = new Set<number>();
    if (Array.isArray(r.picks)) {
      for (const v of r.picks) {
        const n = Math.trunc(Number(v));
        if (Number.isInteger(n) && n >= 1 && n <= KENO_MAX) seen.add(n);
      }
    }
    const picks = Array.from(seen).sort((a, b) => a - b).slice(0, 10);
    if (picks.length < 1) throw new Error("Pick at least one number");
    return { picks };
  },
  play(p, floats): PlayResult {
    const draw = pickIndices(floats, KENO_MAX, KENO_DRAW).map((i) => i + 1);
    const set = new Set(draw);
    const matches = p.picks.filter((n) => set.has(n)).length;
    const multiplier = kenoPayout(p.picks.length, matches);
    return {
      multiplier,
      won: multiplier > 0,
      detail: { draw, picks: p.picks, matches },
    };
  },
};
