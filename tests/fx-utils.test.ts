import { describe, expect, it } from "vitest";
import { isSupportedFiat, SUPPORTED_FIATS } from "@/lib/fx";
import { affiliateCommission, expirationForPlan, totalMiningRate } from "@/lib/mining";
import { formatCrypto, formatDuration } from "@/lib/utils";

describe("SUPPORTED_FIATS / isSupportedFiat", () => {
  it("includes the currencies we advertise", () => {
    expect(SUPPORTED_FIATS).toContain("USD");
    expect(SUPPORTED_FIATS).toContain("IDR");
    expect(SUPPORTED_FIATS).toContain("EUR");
  });

  it("validates case-insensitively", () => {
    expect(isSupportedFiat("idr")).toBe(true);
    expect(isSupportedFiat("ZZZ")).toBe(false);
    expect(isSupportedFiat(null)).toBe(false);
  });
});

describe("affiliateCommission", () => {
  it("takes the configured percent", () => {
    expect(affiliateCommission(100, 20)).toBe(20);
    expect(affiliateCommission(1.234, 10)).toBe(0.1234);
  });
});

describe("totalMiningRate", () => {
  it("sums per-minute rates", () => {
    expect(totalMiningRate([{ earning_rate: 0.1 }, { earning_rate: 0.2 }, { earning_rate: null }])).toBeCloseTo(0.3, 10);
  });
});

describe("expirationForPlan", () => {
  it("adds the contract length", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const exp = expirationForPlan(90, from);
    expect(exp.getTime()).toBe(from.getTime() + 90 * 86400000);
  });
});

describe("formatDuration", () => {
  it("scales minutes into the right unit", () => {
    expect(formatDuration(0)).toBe("now");
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(180)).toBe("3h");
    expect(formatDuration(3 * 24 * 60)).toBe("3d");
  });
});

describe("formatCrypto", () => {
  it("is a thin wrapper over fixed decimals", () => {
    expect(formatCrypto(2, 8)).toBe("2.00000000");
  });
});
