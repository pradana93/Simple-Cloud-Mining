import type { PlayResult } from "./types";
import { floorTo } from "./util";

// Mines is interactive, so it is not an InstantGame. The layout is fixed from
// the seed at round start and never changes. The multiplier for r safe reveals
// with m mines is the fair product of the survival odds, scaled by 0.99. A 1
// percent house edge.

export const MINES_TILES = 25;
export const MINES_MAX = 24;

export type MinesParams = { mines: number };

export function minesNormalize(raw: unknown): MinesParams {
  const r = (raw ?? {}) as { mines?: unknown };
  const n = Math.trunc(Number(r.mines));
  if (!Number.isInteger(n) || n < 1 || n > MINES_MAX) {
    throw new Error(`Choose between 1 and ${MINES_MAX} mines`);
  }
  return { mines: n };
}

// Multiplier after `revealed` safe picks. revealed 0 returns 1.00.
export function minesMultiplier(mineCount: number, revealed: number): number {
  if (revealed <= 0) return 1;
  let fair = 1;
  for (let i = 0; i < revealed; i++) {
    fair *= (MINES_TILES - i) / (MINES_TILES - mineCount - i);
  }
  return floorTo(fair * 0.99, 2);
}

export function minesResult(detail: Record<string, unknown>): PlayResult {
  const multiplier = Number(detail.multiplier ?? 0);
  return { multiplier, won: multiplier > 0, detail };
}
