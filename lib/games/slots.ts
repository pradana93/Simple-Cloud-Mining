import type { InstantGame, PlayResult } from "./types";

// A three reel slot. Each reel picks a weighted symbol from one float. Triples
// pay on the symbol, and exactly two cherries pays a small prize. The weights
// and payouts are set so the expected return is about 0.92, a 8 percent edge.

export type SlotSymbol = "seven" | "bell" | "bar" | "cherry" | "lemon" | "grape";
export type SlotsParams = Record<string, never>;

const REEL: Array<{ symbol: SlotSymbol; weight: number }> = [
  { symbol: "seven", weight: 1 },
  { symbol: "bell", weight: 3 },
  { symbol: "bar", weight: 6 },
  { symbol: "cherry", weight: 10 },
  { symbol: "lemon", weight: 12 },
  { symbol: "grape", weight: 18 },
];
const REEL_TOTAL = REEL.reduce((s, r) => s + r.weight, 0);

const TRIPLE: Record<SlotSymbol, number> = {
  seven: 1200,
  bell: 220,
  bar: 65,
  cherry: 22,
  lemon: 13,
  grape: 7,
};
export const TWO_CHERRY_PAYOUT = 1.1;

function spinReel(f: number): SlotSymbol {
  let point = f * REEL_TOTAL;
  for (const r of REEL) {
    if (point < r.weight) return r.symbol;
    point -= r.weight;
  }
  return REEL[REEL.length - 1].symbol;
}

export const slots: InstantGame<SlotsParams> = {
  id: "slots",
  floats: () => 3,
  normalize(): SlotsParams {
    return {};
  },
  play(_p, floats): PlayResult {
    const reels: SlotSymbol[] = [
      spinReel(floats[0] ?? 0),
      spinReel(floats[1] ?? 0),
      spinReel(floats[2] ?? 0),
    ];
    const [a, b, c] = reels;
    let multiplier = 0;
    let kind = "none";
    if (a === b && b === c) {
      multiplier = TRIPLE[a];
      kind = "triple";
    } else if (a === "cherry" && b === "cherry" && c !== "cherry") {
      multiplier = TWO_CHERRY_PAYOUT;
      kind = "two-cherry";
    } else if (b === "cherry" && c === "cherry" && a !== "cherry") {
      multiplier = TWO_CHERRY_PAYOUT;
      kind = "two-cherry";
    }
    return { multiplier, won: multiplier > 0, detail: { reels, kind } };
  },
};

export function slotsWeight(symbol: SlotSymbol): number {
  return REEL.find((r) => r.symbol === symbol)?.weight ?? 0;
}

export { REEL as SLOT_REEL, REEL_TOTAL as SLOT_TOTAL, TRIPLE as SLOT_TRIPLE };
