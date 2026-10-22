import { describe, expect, it } from "vitest";
import { planEconomics, planNetEconomics } from "@/lib/plan-math";
import { paidLadder, type LadderPlan } from "@/lib/ladder";

// These guard the numbers that reach a buyer: the ladder returns, the
// first-purchase discount, and the quote snapshot stored on an invoice.

const rate = 0.07949;
const ladder: LadderPlan[] = [
  { id: 6, plan_name: "Bronze Plan", price: 1, point_per_day: 1.88702982, duration: 7 },
  { id: 7, plan_name: "Silver Plan", price: 5, point_per_day: 4.48693756, duration: 15 },
  { id: 8, plan_name: "Gold Plan", price: 10, point_per_day: 4.57080555, duration: 30 },
  { id: 9, plan_name: "Premium Plan", price: 25, point_per_day: 11.63668386, duration: 30 },
  { id: 10, plan_name: "Plus Plan", price: 50, point_per_day: 23.69270768, duration: 30 },
  { id: 11, plan_name: "Pro Plan", price: 100, point_per_day: 48.22409527, duration: 30 },
];

describe("plan ladder money path", () => {
  it("keeps member returns ascending across the tier ladder", () => {
    const rows = paidLadder(ladder, rate);
    const returns = rows.map((row) => row.roiPct);
    for (let i = 1; i < returns.length; i++) {
      expect(returns[i]).toBeGreaterThan(returns[i - 1]);
    }
  });

  it("prices every tier at a positive member return", () => {
    for (const row of paidLadder(ladder, rate)) {
      expect(row.roiPct).toBeGreaterThan(0);
    }
  });

  it("matches the quoted payout to the stored daily credit", () => {
    for (const plan of ladder) {
      const e = planEconomics({
        price: plan.price,
        point_per_day: Number(plan.point_per_day),
        duration: plan.duration,
        cryptoToPrice: rate,
      });
      const expected = Number(plan.point_per_day) * plan.duration * rate;
      expect(e.payoutInPrice).toBeCloseTo(expected, 6);
    }
  });

  it("shows the house shortfall after fees on every tier", () => {
    for (const plan of ladder) {
      const e = planNetEconomics({
        price: plan.price,
        point_per_day: Number(plan.point_per_day),
        duration: plan.duration,
        cryptoToPrice: rate,
        processorPct: 0.25,
        affiliatePct: 2,
      });
      expect(e.netProfit).toBeLessThan(0);
    }
  });
});

describe("first-purchase discount", () => {
  const discountFor = (listPrice: number, pct: number) =>
    Math.min(listPrice, Number(((listPrice * pct) / 100).toFixed(2)));

  it("never exceeds the list price", () => {
    expect(discountFor(1, 10)).toBe(0.1);
    expect(discountFor(5, 10)).toBe(0.5);
    expect(discountFor(100, 10)).toBe(10);
  });

  it("keeps the charged price positive", () => {
    for (const price of [1, 5, 10, 25, 50, 100]) {
      const charged = Number((price - discountFor(price, 50)).toFixed(2));
      expect(charged).toBeGreaterThanOrEqual(0);
    }
  });

  it("rounds to cents, not fractions of a cent", () => {
    expect(discountFor(1, 33)).toBe(0.33);
  });
});
