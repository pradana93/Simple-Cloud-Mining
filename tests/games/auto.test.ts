import { describe, expect, it } from "vitest";
import { AUTO_DEFAULTS, autoStopReason, nextAutoStake, parseAutoConfig, type AutoPlan } from "@/lib/games/auto";

const PLAN: AutoPlan = {
  rounds: 10,
  stopProfit: 0,
  stopLoss: 0,
  onWin: "reset",
  winIncrease: 0,
  onLoss: "reset",
  lossIncrease: 0,
};

const BASE = {
  current: 2,
  base: 2,
  won: true,
  plan: PLAN,
  minBet: 1,
  maxBet: 100,
  balance: 50,
  decimals: 8,
};

describe("parseAutoConfig", () => {
  it("accepts the defaults", () => {
    const result = parseAutoConfig(AUTO_DEFAULTS);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.rounds).toBe(10);
      expect(result.plan.onWin).toBe("reset");
      expect(result.plan.onLoss).toBe("reset");
    }
  });

  it("rejects a round count outside one to one hundred", () => {
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, rounds: "0" }).ok).toBe(false);
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, rounds: "101" }).ok).toBe(false);
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, rounds: "2.5" }).ok).toBe(false);
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, rounds: "" }).ok).toBe(false);
  });

  it("rejects negative stop targets", () => {
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, stopProfit: "-1" }).ok).toBe(false);
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, stopLoss: "-0.1" }).ok).toBe(false);
  });

  it("rejects active increases over one hundred percent", () => {
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, onWin: "increase", winIncrease: "101" }).ok).toBe(false);
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, onLoss: "increase", lossIncrease: "-5" }).ok).toBe(false);
  });

  it("ignores increase values for reset rules", () => {
    expect(parseAutoConfig({ ...AUTO_DEFAULTS, winIncrease: "101", lossIncrease: "-5" }).ok).toBe(true);
  });
});

describe("nextAutoStake", () => {
  it("resets to the base stake after a win", () => {
    expect(nextAutoStake({ ...BASE, current: 4 })).toBe(2);
  });

  it("applies the win increase", () => {
    const plan = { ...PLAN, onWin: "increase" as const, winIncrease: 50 };
    expect(nextAutoStake({ ...BASE, current: 4, plan })).toBe(6);
  });

  it("applies the loss increase", () => {
    const plan = { ...PLAN, onLoss: "increase" as const, lossIncrease: 100 };
    expect(nextAutoStake({ ...BASE, current: 2, won: false, plan })).toBe(4);
  });

  it("caps the next stake at the table maximum", () => {
    const plan = { ...PLAN, onWin: "increase" as const, winIncrease: 100 };
    expect(nextAutoStake({ ...BASE, current: 80, plan, balance: 200, maxBet: 100 })).toBe(100);
  });

  it("caps the next stake at the remaining balance", () => {
    const plan = { ...PLAN, onWin: "increase" as const, winIncrease: 100 };
    expect(nextAutoStake({ ...BASE, current: 30, plan, balance: 40 })).toBe(40);
  });

  it("never drops below the table minimum while balance allows it", () => {
    expect(nextAutoStake({ ...BASE, base: 0.4, current: 0.4 })).toBe(1);
  });
});

describe("autoStopReason", () => {
  const format = (value: number) => value.toFixed(2);

  it("reports a profit target", () => {
    expect(autoStopReason({ ...PLAN, stopProfit: 5 }, 5, format, "DOGE")).toBe(
      "Stopped at profit target of 5.00 DOGE."
    );
  });

  it("reports a loss limit", () => {
    expect(autoStopReason({ ...PLAN, stopLoss: 3 }, -3, format, "DOGE")).toBe(
      "Stopped at loss limit of 3.00 DOGE."
    );
  });

  it("returns null when no stop is configured", () => {
    expect(autoStopReason(PLAN, -100, format, "DOGE")).toBeNull();
  });
});
