import { describe, expect, it } from "vitest";
import { checkinBonus, computeStreak, daysBetween, streakMultiplier, utcDay } from "@/lib/checkin";

describe("utcDay", () => {
  it("formats the UTC calendar day", () => {
    expect(utcDay(new Date("2026-10-19T23:59:00Z"))).toBe("2026-10-19");
    expect(utcDay(new Date("2026-10-20T00:01:00Z"))).toBe("2026-10-20");
  });
});

describe("daysBetween", () => {
  it("counts whole days", () => {
    expect(daysBetween("2026-10-18", "2026-10-19")).toBe(1);
    expect(daysBetween("2026-10-19", "2026-10-19")).toBe(0);
    expect(daysBetween("2026-10-01", "2026-10-10")).toBe(9);
  });
});

describe("computeStreak", () => {
  it("starts at one with no history", () => {
    expect(computeStreak(null, "2026-10-19")).toBe(1);
  });

  it("continues when the last claim was yesterday", () => {
    expect(computeStreak({ day: "2026-10-18", streak: 4 }, "2026-10-19")).toBe(5);
  });

  it("resets after a missed day", () => {
    expect(computeStreak({ day: "2026-10-16", streak: 9 }, "2026-10-19")).toBe(1);
  });

  it("keeps the streak on a same-day repeat", () => {
    expect(computeStreak({ day: "2026-10-19", streak: 3 }, "2026-10-19")).toBe(3);
  });
});

describe("streakMultiplier", () => {
  it("stays at one through the first week", () => {
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(2)).toBeCloseTo(1.05, 4);
  });

  it("caps the loyalty bonus", () => {
    expect(streakMultiplier(100)).toBeCloseTo(1.3, 4);
  });
});

describe("checkinBonus", () => {
  it("scales the base by the streak multiplier", () => {
    expect(checkinBonus(1, 1)).toBe(1);
    expect(checkinBonus(1, 3)).toBeCloseTo(1.1, 8);
  });

  it("is zero when the bonus is off", () => {
    expect(checkinBonus(0, 5)).toBe(0);
    expect(checkinBonus(-1, 5)).toBe(0);
  });
});
