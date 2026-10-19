import { describe, expect, it } from "vitest";
import { earningRateFromDaily, planEconomics } from "@/lib/plan-math";

describe("earningRateFromDaily", () => {
  it("converts a daily rate to per-minute", () => {
    expect(earningRateFromDaily(15)).toBe(0.01041667);
  });

  it("returns zero for missing or invalid input", () => {
    expect(earningRateFromDaily(null)).toBe(0);
    expect(earningRateFromDaily(0)).toBe(0);
    expect(earningRateFromDaily("abc")).toBe(0);
  });
});

describe("planEconomics (same unit)", () => {
  it("computes payout, margin, roi and break-even", () => {
    const e = planEconomics({ price: 100, point_per_day: 10, duration: 90 });
    expect(e.payoutToUser).toBe(900);
    expect(e.ownerProfit).toBe(-800);
    expect(e.ownerMarginPct).toBe(-800);
    expect(e.breakEvenDays).toBe(10);
  });
});

describe("planEconomics (price in fiat, yield in crypto)", () => {
  // $5 plan, 15 DOGE/day, 1 DOGE = $0.08 => $0.08 of price value per DOGE.
  const input = { price: 5, point_per_day: 15, duration: 90, cryptoToPrice: 0.08 };

  it("converts the payout into the price currency before comparing", () => {
    const e = planEconomics(input);
    expect(e.payoutInPrice).toBeCloseTo(108, 6);
    expect(e.ownerProfit).toBeCloseTo(-103, 6);
    expect(e.breakEvenDays).toBeCloseTo(5 / (15 * 0.08), 6);
  });

  it("keeps the raw crypto payout for display", () => {
    expect(planEconomics(input).payoutToUser).toBe(1350);
  });

  it("treats a missing conversion as same-unit", () => {
    const e = planEconomics({ price: 5, point_per_day: 15, duration: 90 });
    expect(e.payoutInPrice).toBe(1350);
    expect(e.breakEvenDays).toBeCloseTo(0.3333, 3);
  });
});
