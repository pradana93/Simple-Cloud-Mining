import { describe, expect, it } from "vitest";
import {
  CRASH_GROWTH,
  CRASH_MAX_MULTIPLIER,
  crashMultiplierAt,
  crashPoint,
  crashTimeMs,
} from "@/lib/games/crash";

describe("crash point", () => {
  it("is fair for a fixed cashout target", () => {
    // The line reaches m when 0.99 / (1 - f) >= m, so P = 0.99 / m.
    const target = 2;
    let reached = 0;
    const samples = 40000;
    for (let i = 0; i < samples; i++) {
      const f = (i + 0.5) / samples;
      if (crashPoint(f) >= target) reached++;
    }
    expect(reached / samples).toBeCloseTo(0.99 / target, 2);
  });

  it("floors instant crashes and stays monotonic", () => {
    expect(crashPoint(0)).toBe(1);
    expect(crashPoint(0.009)).toBe(1);
    expect(crashPoint(0.01)).toBe(1);
    for (let f = 0.02; f < 1; f += 0.01) {
      expect(crashPoint(f)).toBeGreaterThanOrEqual(crashPoint(f - 0.01));
    }
  });
});

describe("crash clock", () => {
  it("starts at 1.00 and grows with the clock", () => {
    expect(crashMultiplierAt(0)).toBe(1);
    expect(crashMultiplierAt(1000)).toBeCloseTo(Math.exp(CRASH_GROWTH), 2);
    expect(crashMultiplierAt(2000)).toBeGreaterThan(crashMultiplierAt(1000));
    expect(crashMultiplierAt(60000)).toBe(CRASH_MAX_MULTIPLIER);
    expect(crashMultiplierAt(120000)).toBe(CRASH_MAX_MULTIPLIER);
  });

  it("inverts the clock for the revealed crash point", () => {
    const t = crashTimeMs(2);
    expect(t).toBeGreaterThan(0);
    expect(crashMultiplierAt(t)).toBeCloseTo(2, 1);
    expect(crashTimeMs(1)).toBe(0);
  });
});
