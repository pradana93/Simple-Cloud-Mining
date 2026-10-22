import { describe, expect, it } from "vitest";
import { parseGoal } from "@/lib/plan-goal";
import { generateStrategy } from "@/lib/plan-studio";

const context = {
  currencyCode: "USD",
  cryptoCode: "DOGE",
  cryptoToPrice: 0.08,
  processorPct: 0.25,
  affiliatePct: 2,
  minWithdraw: 5,
};

describe("generateStrategy", () => {
  it("builds three viable options from a daily member profit", () => {
    const result = generateStrategy(
      {},
      { objective: "balanced", price: 1, durationDays: 30, dailyProfit: 0.02 },
      context
    );

    expect(result.variants).toHaveLength(3);
    expect(result.recommendedId).toBe("balanced");
    for (const variant of result.variants) {
      expect(variant.price).toBe(1);
      expect(variant.point_per_day).toBeGreaterThan(0);
      expect(variant.userRoiPct).toBeGreaterThan(0);
      expect(variant.netProfit).toBeLessThan(0);
    }
  });

  it("recommends a $1 growth plan that clears the withdrawal minimum", () => {
    const result = generateStrategy(
      {},
      { objective: "growth", price: 1, durationDays: 30, targetRoiPct: 50 },
      { ...context, cryptoToPrice: 0.079, minWithdraw: 10 }
    );
    const recommended = result.variants.find((variant) => variant.id === result.recommendedId);

    expect(recommended?.id).toBe("aggressive");
    expect(recommended?.minWithdrawCovered).toBe(true);
    expect(recommended?.userRoiPct).toBeCloseTo(50, 4);
    expect(recommended?.warnings.some((warning) => warning.includes("floor"))).toBe(false);
  });

  it("calculates the Excel inputs: price, daily profit, and term", () => {
    const result = generateStrategy(
      {},
      {
        objective: "balanced",
        price: 300,
        durationDays: 30,
        dailyProfit: 5,
        minMarginPct: 0,
        maxPayoutRatioPct: 200,
      },
      context
    );
    const top = result.variants.find((variant) => variant.id === "aggressive");

    expect(top?.payoutRatioPct).toBe(150);
    expect(top?.userRoiPct).toBeCloseTo(50, 4);
    expect((top?.payoutToUser ?? 0) * context.cryptoToPrice).toBeCloseTo(450, 6);
    expect(top?.point_per_day).toBeGreaterThan(0);
  });

  it("uses a daily profit parsed from the goal sentence", () => {
    const intent = parseGoal("$20 plan, 30 days, $0.10 daily profit");
    const result = generateStrategy(intent, { objective: "balanced" }, context);
    const top = result.variants.find((variant) => variant.id === "aggressive");

    expect(intent.price).toBe(20);
    expect(intent.dailyProfit).toBeCloseTo(0.1, 4);
    expect(top?.payoutRatioPct).toBeCloseTo(115, 2);
    expect(top?.userRoiPct).toBeCloseTo(15, 4);
  });

  it("asks for a payout target instead of inventing a losing default", () => {
    const result = generateStrategy(
      {},
      { objective: "balanced", price: 5, durationDays: 30 },
      context
    );

    expect(result.variants).toHaveLength(0);
    expect(result.warnings[0]).toContain("daily member profit");
  });

  it("keeps the margin cap when an owner margin floor is set", () => {
    const result = generateStrategy(
      {},
      { objective: "balanced", price: 10, durationDays: 30, targetRoiPct: 50, minMarginPct: 15 },
      context
    );
    const recommended = result.variants.find((variant) => variant.id === result.recommendedId);

    expect(recommended?.payoutRatioPct).toBeLessThanOrEqual(82.75);
    expect(recommended?.netProfit).toBeGreaterThan(0);
    expect(recommended?.netMarginPct).toBeGreaterThanOrEqual(15);
  });

  it("uses the objective default instead of treating a new plan's zero draft price as free", () => {
    const result = generateStrategy(
      {},
      { objective: "balanced", durationDays: 30, dailyProfit: 0.02 },
      { ...context, price: 0, isEdit: false }
    );

    expect(result.variants[0].price).toBe(25);
    expect(result.variants[0].is_default).toBe(false);
  });

  it("keeps an edited free plan free", () => {
    const result = generateStrategy(
      {},
      { objective: "balanced", durationDays: 30 },
      { ...context, price: 0, isEdit: true }
    );

    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].id).toBe("free");
    expect(result.variants[0].price).toBe(0);
  });

  it("keeps the free flag explicit for a new zero-price plan", () => {
    const result = generateStrategy(
      {},
      { objective: "balanced", price: 0, freePlan: true, durationDays: 30 },
      context
    );

    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].id).toBe("free");
  });
});
