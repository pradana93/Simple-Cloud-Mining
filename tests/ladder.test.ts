import { describe, expect, it } from "vitest";
import { nextTier, paidLadder, type LadderPlan } from "@/lib/ladder";

const plans: LadderPlan[] = [
  { id: 8, plan_name: "Gold Plan", price: 10, point_per_day: 4.57080555, duration: 30 },
  { id: 6, plan_name: "Bronze Plan", price: 1, point_per_day: 1.88702982, duration: 7 },
  { id: 9, plan_name: "Premium Plan", price: 25, point_per_day: 11.63668386, duration: 30 },
];

describe("paidLadder", () => {
  it("orders paid tiers by price and skips the free plan", () => {
    const rows = paidLadder([{ id: 1, plan_name: "Free", price: 0, point_per_day: 0.02, duration: 30 }, ...plans], 0.07949);
    expect(rows.map((r) => r.plan_name)).toEqual(["Bronze Plan", "Gold Plan", "Premium Plan"]);
  });

  it("reports the member return from the same economics as the admin table", () => {
    const [bronze] = paidLadder(plans, 0.07949);
    expect(bronze.roiPct).toBeCloseTo(5, 0);
    expect(bronze.totalReturn).toBeCloseTo(1.05, 2);
  });
});

describe("nextTier", () => {
  it("points a new member at the cheapest paid tier", () => {
    const ladder = paidLadder(plans, 0.07949);
    const { highest, next } = nextTier(ladder, []);
    expect(highest).toBeNull();
    expect(next?.plan_name).toBe("Bronze Plan");
  });

  it("moves to the next price above the highest reached tier", () => {
    const ladder = paidLadder(plans, 0.07949);
    const { highest, next } = nextTier(ladder, [6]);
    expect(highest?.plan_name).toBe("Bronze Plan");
    expect(next?.plan_name).toBe("Gold Plan");
  });

  it("returns no next tier at the top", () => {
    const ladder = paidLadder(plans, 0.07949);
    expect(nextTier(ladder, [9]).next).toBeNull();
  });
});
