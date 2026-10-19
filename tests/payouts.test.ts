import { describe, expect, it } from "vitest";
import { isPending, isSettled, isStale, selectAutoPayoutBatch, withinCeiling } from "@/lib/payouts";

const day = 86_400_000;
const NOW = new Date("2026-10-19T12:00:00Z");

function row(id: number, amount: number, createdDaysAgo: number, status = "PENDING") {
  return { id, amount, status, created_at: new Date(NOW.getTime() - createdDaysAgo * day).toISOString() };
}

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

describe("withinCeiling", () => {
  it("accepts any positive amount when there is no ceiling", () => {
    expect(withinCeiling(500, 0)).toBe(true);
  });

  it("respects the ceiling", () => {
    expect(withinCeiling(40, 50)).toBe(true);
    expect(withinCeiling(50, 50)).toBe(true);
    expect(withinCeiling(51, 50)).toBe(false);
  });

  it("rejects non-positive amounts", () => {
    expect(withinCeiling(0, 50)).toBe(false);
    expect(withinCeiling(-1, 50)).toBe(false);
  });
});

describe("selectAutoPayoutBatch", () => {
  it("keeps only pending rows under the ceiling, oldest first", () => {
    const rows = [
      row(1, 10, 1),
      row(2, 100, 3),
      row(3, 20, 5),
      row(4, 30, 2, "SUCCESS"),
      row(5, 15, 4),
    ];
    const batch = selectAutoPayoutBatch(rows, 50, 10);
    expect(batch.map((r) => r.id)).toEqual([3, 5, 1]);
  });

  it("caps the batch size", () => {
    const rows = [row(1, 10, 1), row(2, 10, 2), row(3, 10, 3)];
    expect(selectAutoPayoutBatch(rows, 0, 2).map((r) => r.id)).toEqual([3, 2]);
  });

  it("returns nothing when everything is settled", () => {
    const rows = [row(1, 10, 1, "SUCCESS"), row(2, 10, 2, "CANCELED")];
    expect(selectAutoPayoutBatch(rows, 0, 10)).toEqual([]);
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
