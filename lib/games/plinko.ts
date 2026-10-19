import type { InstantGame, PlayResult } from "./types";

// Plinko: a ball drops through N rows, at each row a float decides left or
// right, and the landing slot pays from a table. The tables use the standard
// shapes whose expected return sits just below 1 (near 0.99 for every risk).

export type PlinkoRisk = "low" | "medium" | "high";
export type PlinkoParams = { risk: PlinkoRisk; rows: number };

export const PLINKO_ROWS = [8, 12, 16] as const;

const TABLES: Record<number, Record<PlinkoRisk, number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1, 0.5, 1, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

export function plinkoTable(rows: number, risk: PlinkoRisk): number[] {
  return (TABLES[rows] ?? TABLES[8])[risk] ?? TABLES[8].low;
}

function normalizeRisk(v: unknown): PlinkoRisk {
  return v === "medium" || v === "high" ? v : "low";
}

export const plinko: InstantGame<PlinkoParams> = {
  id: "plinko",
  floats: (p) => p.rows,
  normalize(raw: unknown): PlinkoParams {
    const r = (raw ?? {}) as { risk?: unknown; rows?: unknown };
    const rows = PLINKO_ROWS.includes(Number(r.rows) as (typeof PLINKO_ROWS)[number])
      ? Number(r.rows)
      : 12;
    return { risk: normalizeRisk(r.risk), rows };
  },
  play(p, floats): PlayResult {
    let slot = 0;
    const path: boolean[] = [];
    for (let i = 0; i < p.rows; i++) {
      const right = (floats[i] ?? 0) >= 0.5;
      path.push(right);
      if (right) slot++;
    }
    const multiplier = plinkoTable(p.rows, p.risk)[slot] ?? 0;
    return { multiplier, won: multiplier > 0, detail: { slot, path, rows: p.rows, risk: p.risk } };
  },
};
