import { describe, expect, it } from "vitest";
import { isPending, isSettled, isStale } from "@/lib/payouts";

const NOW = new Date("2026-10-19T12:00:00Z");

describe("isSettled / isPending", () => {
  it("treats success and canceled as settled", () => {
    expect(isSettled("SUCCESS")).toBe(true);
    expect(isSettled("canceled")).toBe(true);
    expect(isSettled("PENDING")).toBe(false);
  });

  it("matches pending case-insensitively", () => {
    expect(isPending("pending")).toBe(true);
    expect(isPending("PENDING")).toBe(true);
    expect(isPending("PROCESSING")).toBe(false);
  });
});

describe("isStale", () => {
  it("flags rows older than the window", () => {
    expect(isStale(new Date(NOW.getTime() - 2 * 3600_000).toISOString(), NOW, 3600_000)).toBe(true);
  });

  it("leaves fresh rows alone", () => {
    expect(isStale(new Date(NOW.getTime() - 60_000).toISOString(), NOW, 3600_000)).toBe(false);
  });

  it("ignores unparseable dates", () => {
    expect(isStale("not-a-date", NOW, 3600_000)).toBe(false);
  });
});
