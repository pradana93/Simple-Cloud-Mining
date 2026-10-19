import { describe, expect, it } from "vitest";
import { coinOptions, isPayableCoin } from "@/lib/checkout";

describe("coinOptions", () => {
  it("splits, trims, and upper-cases the list", () => {
    expect(coinOptions("btc, doge , ltc").map((c) => c.code)).toEqual(["BTC", "DOGE", "LTC"]);
  });

  it("drops duplicates and blanks", () => {
    expect(coinOptions("BTC,btc,,DOGE").map((c) => c.code)).toEqual(["BTC", "DOGE"]);
  });

  it("attaches a label and symbol when known", () => {
    expect(coinOptions("DOGE")[0]).toEqual({ code: "DOGE", label: "Dogecoin", symbol: "Ð" });
  });

  it("falls back to the code for unknown coins", () => {
    expect(coinOptions("FOO")[0]).toEqual({ code: "FOO", label: "FOO", symbol: "FOO" });
  });

  it("returns nothing for empty input", () => {
    expect(coinOptions(null)).toEqual([]);
    expect(coinOptions("   ")).toEqual([]);
  });
});

describe("isPayableCoin", () => {
  const csv = "BTC,DOGE,LTC";

  it("accepts a listed coin regardless of case", () => {
    expect(isPayableCoin("doge", csv)).toBe(true);
    expect(isPayableCoin("BTC", csv)).toBe(true);
  });

  it("rejects a coin that is not on the list", () => {
    expect(isPayableCoin("ETH", csv)).toBe(false);
  });

  it("rejects empty values", () => {
    expect(isPayableCoin(null, csv)).toBe(false);
    expect(isPayableCoin("", csv)).toBe(false);
  });
});
