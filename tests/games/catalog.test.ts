import { describe, expect, it } from "vitest";
import { GAME_CATALOG, INSTANT_GAMES, gameMeta, getInstantGame } from "@/lib/games/registry";
import { MINES_TILES, minesMultiplier } from "@/lib/games/mines";
import { pickIndices, toLedger } from "@/lib/games/util";

describe("catalog", () => {
  it("lists ten distinct games", () => {
    expect(GAME_CATALOG).toHaveLength(10);
    const ids = new Set(GAME_CATALOG.map((g) => g.id));
    expect(ids.size).toBe(10);
  });

  it("has an instant engine for every game except the two round games", () => {
    for (const meta of GAME_CATALOG) {
      if (meta.id === "mines") {
        expect(meta.interactive).toBe(true);
        expect(getInstantGame("mines")).toBeNull();
      } else if (meta.id === "crash") {
        expect(getInstantGame("crash")).toBeNull();
      } else {
        expect(INSTANT_GAMES[meta.id]).toBeTruthy();
      }
    }
    expect(gameMeta("mines")?.name).toBe("Mines");
    expect(gameMeta("crash")?.name).toBe("Crash");
    expect(getInstantGame("nope")).toBeNull();
  });
});

describe("mines multiplier", () => {
  it("starts at 1 and rises with each safe tile", () => {
    expect(minesMultiplier(3, 0)).toBe(1);
    let previous = 0;
    for (let revealed = 1; revealed <= MINES_TILES - 3; revealed++) {
      const m = minesMultiplier(3, revealed);
      expect(m).toBeGreaterThan(previous);
      previous = m;
    }
  });

  it("stays below the fair survival product", () => {
    const mineCount = 5;
    const revealed = 4;
    let fair = 1;
    for (let i = 0; i < revealed; i++) fair *= (MINES_TILES - i) / (MINES_TILES - mineCount - i);
    expect(minesMultiplier(mineCount, revealed)).toBeLessThan(fair);
  });
});

describe("helpers", () => {
  it("picks distinct indices inside the range", () => {
    const picks = pickIndices([0.1, 0.5, 0.9, 0.33, 0.77, 0.02], 10, 4);
    expect(picks).toHaveLength(4);
    expect(new Set(picks).size).toBe(4);
    for (const p of picks) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(10);
    }
  });

  it("floors ledger amounts to eight decimals", () => {
    expect(toLedger(1.123456789)).toBe(1.12345678);
    expect(toLedger(0.000000019)).toBe(0.00000001);
  });
});
