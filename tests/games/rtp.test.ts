import { describe, expect, it } from "vitest";
import { diceChance, diceMultiplier } from "@/lib/games/dice";
import { wheelRtp } from "@/lib/games/wheel";
import { PLINKO_ROWS, plinkoTable } from "@/lib/games/plinko";
import { kenoPayout } from "@/lib/games/keno";
import {
  SLOT_REEL,
  SLOT_TOTAL,
  SLOT_TRIPLE,
  TWO_CHERRY_PAYOUT,
  type SlotSymbol,
} from "@/lib/games/slots";
import { rouletteMultiplier } from "@/lib/games/roulette";
import { INSTANT_GAMES } from "@/lib/games/registry";
import { floatStream } from "@/lib/games/rng";

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}

function simulate(id: string, params: unknown, rounds = 20000): number {
  const game = INSTANT_GAMES[id];
  const p = game.normalize(params);
  let sum = 0;
  for (let i = 0; i < rounds; i++) {
    const floats = floatStream("sim-server", "sim-client", i + 1, game.floats(p));
    sum += game.play(p, floats).multiplier;
  }
  return sum / rounds;
}

describe("dice edge", () => {
  it("keeps the expected return at or below 0.99 for every target", () => {
    for (let target = 2; target <= 98; target++) {
      for (const mode of ["under", "over"] as const) {
        const rtp = diceChance({ target, mode }) * diceMultiplier({ target, mode });
        expect(rtp).toBeLessThanOrEqual(0.99);
        expect(rtp).toBeGreaterThan(0.95);
      }
    }
  });
});

describe("wheel edge", () => {
  it("returns exactly 0.99 at every risk", () => {
    expect(wheelRtp("low")).toBeCloseTo(0.99, 8);
    expect(wheelRtp("medium")).toBeCloseTo(0.99, 8);
    expect(wheelRtp("high")).toBeCloseTo(0.99, 8);
  });
});

describe("plinko edge", () => {
  it("stays below 1 for every row and risk combination", () => {
    for (const rows of PLINKO_ROWS) {
      for (const risk of ["low", "medium", "high"] as const) {
        const table = plinkoTable(rows, risk);
        let rtp = 0;
        for (let slot = 0; slot <= rows; slot++) {
          rtp += (comb(rows, slot) / Math.pow(2, rows)) * table[slot];
        }
        expect(rtp).toBeLessThan(1);
        expect(rtp).toBeGreaterThan(0.95);
      }
    }
  });
});

describe("keno edge", () => {
  it("stays below 1 for every pick count", () => {
    for (let picks = 1; picks <= 10; picks++) {
      let rtp = 0;
      for (let matches = 0; matches <= picks; matches++) {
        const p = (comb(10, matches) * comb(30, picks - matches)) / comb(40, picks);
        rtp += p * kenoPayout(picks, matches);
      }
      expect(rtp).toBeLessThan(1);
      expect(rtp).toBeGreaterThan(0.75);
    }
  });
});

describe("slots edge", () => {
  it("stays below 1", () => {
    let triple = 0;
    for (const reel of SLOT_REEL) {
      const p = reel.weight / SLOT_TOTAL;
      triple += p * p * p * SLOT_TRIPLE[reel.symbol as SlotSymbol];
    }
    const pCherry = SLOT_REEL.find((r) => r.symbol === "cherry")!.weight / SLOT_TOTAL;
    const twoCherry = 2 * pCherry * pCherry * (1 - pCherry) * TWO_CHERRY_PAYOUT;
    const rtp = triple + twoCherry;
    expect(rtp).toBeLessThan(1);
    expect(rtp).toBeGreaterThan(0.85);
  });
});

describe("roulette edge", () => {
  it("pays even money at 18 in 37 and a straight at 1 in 37", () => {
    expect((18 / 37) * rouletteMultiplier("red")).toBeCloseTo(0.973, 3);
    expect((1 / 37) * rouletteMultiplier("number")).toBeCloseTo(0.973, 3);
  });
});

describe("simulated returns", () => {
  it("lands near 0.99 for the single number games", () => {
    expect(simulate("limbo", { target: 2 })).toBeCloseTo(0.99, 1);
    expect(simulate("crash", { target: 2 })).toBeCloseTo(0.99, 1);
    expect(simulate("coinflip", { side: "heads" })).toBeCloseTo(0.99, 1);
    expect(simulate("dice", { target: 50, mode: "under" })).toBeCloseTo(0.99, 1);
  });
});
