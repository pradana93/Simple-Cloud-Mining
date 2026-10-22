import { describe, expect, it } from "vitest";
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
  it("builds three viable options for a $1 entry plan", () => {
    const result = generateStrategy(
      {},
      { objective: "balanced", price: 1, durationDays: 30 },
      context
    );

    expect(result.variants).toHaveLength(3);
    expect(result.recommendedId).toBe("balanced");
    for (const variant of result.variants) {
      expect(variant.price).toBe(1);
      expect(variant.point_per_day).toBeGreaterThan(0);
      expect(variant.netProfit).toBeGreaterThan(0);
      expect(variant.netMarginPct).toBeGreaterThan(0);
    }
  });

  it("recommends a $1 growth plan that clears the withdrawal minimum", () => {
    const result = generateStrategy(
      {},
      { objective: "growth", price: 1, durationDays: 30 },
      { ...context, cryptoToPrice: 0.079, minWithdraw: 10 }
    );
    const recommended = result.variants.find((variant) => variant.id === result.recommendedId);

    expect(recommended?.id).toBe("aggressive");
    expect(recommended?.minWithdrawCovered).toBe(true);
    expect(recommended?.netMarginPct).toBeGreaterThan(14.9);
    expect(recommended?.warnings.some((warning) => warning.includes("below your 15% floor"))).toBe(
      false
    );
  });

  it("uses the objective default instead of treating a new plan's zero draft price as free", () => {
    const result = generateStrategy(
      {},
      { objective: "balanced", durationDays: 30 },
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
