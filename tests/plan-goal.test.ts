import { describe, expect, it } from "vitest";
import { parseGoal, solvePlan } from "@/lib/plan-goal";

describe("parseGoal", () => {
  it("reads an explicit price", () => {
    expect(parseGoal("price 25 plan for 30 days").price).toBe(25);
  });

  it("reads a term in days, weeks and months", () => {
    expect(parseGoal("30 day plan").durationDays).toBe(30);
    expect(parseGoal("2 weeks plan").durationDays).toBe(14);
    expect(parseGoal("1 month plan").durationDays).toBe(30);
  });

  it("reads an ROI target and a margin target", () => {
    const intent = parseGoal("plan with 200% ROI and 40% margin");
    expect(intent.userRoiPct).toBe(200);
    expect(intent.ownerMarginPct).toBe(40);
  });

  it("reads a dollar price at the start of a sentence", () => {
    const intent = parseGoal("$1 entry plan, 30 days, members get 70% back");
    expect(intent.price).toBe(1);
    expect(intent.durationDays).toBe(30);
    expect(intent.payoutRatioPct).toBe(70);
    expect(intent.userRoiPct).toBeUndefined();
  });

  it("reads a total payout target", () => {
    const intent = parseGoal("$5 plan, 90 days, 150% total payout");
    expect(intent.price).toBe(5);
    expect(intent.durationDays).toBe(90);
    expect(intent.payoutRatioPct).toBe(150);
  });

  it("reads a daily member profit", () => {
    const intent = parseGoal("$5 plan, 90 days, $0.10 daily profit");
    expect(intent.price).toBe(5);
    expect(intent.durationDays).toBe(90);
    expect(intent.dailyProfit).toBe(0.1);
  });

  it("does not mistake a daily profit amount for the plan price", () => {
    const intent = parseGoal("30 days, $0.10 daily profit");
    expect(intent.price).toBeUndefined();
    expect(intent.durationDays).toBe(30);
    expect(intent.dailyProfit).toBe(0.1);
  });

  it("reads per-day member profit wording", () => {
    const intent = parseGoal("$20 plan, 30 days, 0.10 per day member profit");
    expect(intent.price).toBe(20);
    expect(intent.dailyProfit).toBe(0.1);
  });

  it("reads profit before a per-day amount", () => {
    const intent = parseGoal("$20 plan, 30 days, profit 0.10 per day");
    expect(intent.price).toBe(20);
    expect(intent.dailyProfit).toBe(0.1);
  });

  it("reads a free/default flag", () => {
    expect(parseGoal("free starter plan").isDefault).toBe(true);
  });

  it("only fills what was stated", () => {
    const intent = parseGoal("hello there");
    expect(Object.keys(intent)).toHaveLength(0);
  });
});

describe("solvePlan", () => {
  it("derives the payout from a user ROI target", () => {
    const p = solvePlan({ price: 100, userRoiPct: 100, durationDays: 30 });
    expect(p.point_per_day).toBeCloseTo(200 / 30, 6);
    expect(p.ownerProfit).toBeCloseTo(-100, 4);
    expect(p.ownerMarginPct).toBeCloseTo(-100, 4);
  });

  it("derives the payout from an owner margin", () => {
    const p = solvePlan({ price: 100, ownerMarginPct: 50, durationDays: 10 });
    expect(p.payoutToUser).toBeCloseTo(50, 6);
  });

  it("defaults a 50% margin when nothing is specified", () => {
    const p = solvePlan({ price: 100, durationDays: 10 });
    expect(p.ownerMarginPct).toBe(50);
  });

  it("converts a fiat price into a crypto yield via cryptoToPrice", () => {
    // $5 plan, 2x payout in USD = $10; 1 DOGE = $0.08 => 125 DOGE total.
    const p = solvePlan(
      { price: 5, userMultiple: 2, durationDays: 90 },
      { cryptoToPrice: 0.08 }
    );
    expect(p.payoutToUser).toBeCloseTo(125, 3);
    expect(p.point_per_day).toBeCloseTo(125 / 90, 5);
  });

  it("solves a $1 plan from a payout ratio", () => {
    const p = solvePlan(
      { price: 1, payoutRatioPct: 70, durationDays: 30 },
      { cryptoToPrice: 0.08 }
    );
    expect(p.payoutToUser).toBeCloseTo(8.75, 4);
    expect(p.point_per_day).toBeCloseTo(8.75 / 30, 4);
    expect(p.ownerMarginPct).toBeCloseTo(30, 4);
  });

  it("flags a plan that loses money", () => {
    const p = solvePlan({ price: 100, userRoiPct: 200, durationDays: 30 });
    expect(p.warnings.length).toBeGreaterThan(0);
  });
});
