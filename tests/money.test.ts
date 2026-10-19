import { describe, expect, it } from "vitest";
import {
  cryptoCfg,
  formatFiat,
  formatMoney,
  formatPrice,
  fiatSymbol,
  moneyUnit,
  type MoneyCfg,
} from "@/lib/money";
import { formatCrypto } from "@/lib/utils";
import { cross } from "@/lib/fx";

const cfg = (over: Partial<MoneyCfg> = {}): MoneyCfg => ({
  mode: "fiat",
  rate: 0.08, // DOGE -> USD
  code: "DOGE",
  symbol: "Ð",
  decimals: 8,
  fiatCurrency: "USD",
  priceCurrency: "USD",
  priceToDisplay: 1,
  cryptoToPrice: 0.08, // 1 DOGE = 0.08 USD
  ...over,
});

describe("formatCrypto", () => {
  it("fixes decimals and falls back to zero", () => {
    expect(formatCrypto(1.5, 8)).toBe("1.50000000");
    expect(formatCrypto("nope", 4)).toBe("0.0000");
  });
});

describe("formatFiat", () => {
  it("uses a currency symbol when known", () => {
    expect(formatFiat(1234.5, "USD")).toBe("$1,234.50");
    expect(formatFiat(5, "EUR")).toBe("€5.00");
    expect(formatFiat(90264.35, "IDR")).toBe("Rp90,264.35");
  });

  it("falls back to the code when the symbol is unknown", () => {
    expect(formatFiat(1, "ZZZ")).toBe("1.00 ZZZ");
  });

  it("shows more precision for sub-unit values", () => {
    expect(formatFiat(0.5, "USD")).toBe("$0.5000");
    expect(formatFiat(0.001234, "USD")).toBe("$0.001234");
  });
});

describe("fiatSymbol", () => {
  it("maps common currencies and is case-insensitive", () => {
    expect(fiatSymbol("usd")).toBe("$");
    expect(fiatSymbol("IDR")).toBe("Rp");
    expect(fiatSymbol("nope")).toBe("");
  });
});

describe("formatMoney", () => {
  it("renders crypto when in crypto mode", () => {
    expect(formatMoney(12.345, cfg({ mode: "crypto" }))).toBe("Ð12.34500000");
  });

  it("converts to fiat with the indicative marker", () => {
    expect(formatMoney(10, cfg())).toBe("≈$0.8000");
  });

  it("falls back to crypto when the rate is missing", () => {
    expect(formatMoney(10, cfg({ mode: "fiat", rate: 0 }))).toBe("Ð10.00000000");
  });
});

describe("formatPrice", () => {
  it("shows the exact price when display currency matches the price currency", () => {
    expect(formatPrice(5, cfg())).toBe("$5.00");
  });

  it("marks a converted price as indicative", () => {
    // priceToDisplay = 1432.73 (IDR per USD)
    const c = cfg({ fiatCurrency: "IDR", priceToDisplay: 1432.73 });
    expect(formatPrice(5, c)).toBe("≈Rp7,163.65");
  });

  it("shows the coin equivalent in crypto mode", () => {
    // 1 DOGE = 0.08 USD => $5 is 62.5 DOGE
    expect(formatPrice(5, cfg({ mode: "crypto" }))).toBe("Ð62.50000000");
  });

  it("handles NaN safely", () => {
    expect(formatPrice(Number.NaN, cfg())).toBe("$0.00");
  });
});

describe("moneyUnit", () => {
  it("returns the active unit label", () => {
    expect(moneyUnit(cfg())).toBe("USD");
    expect(moneyUnit(cfg({ mode: "crypto" }))).toBe("DOGE");
  });
});

describe("cryptoCfg", () => {
  it("fills crypto defaults", () => {
    const c = cryptoCfg({ code: "DOGE", symbol: "Ð", decimals: 8 });
    expect(c.mode).toBe("crypto");
    expect(c.fiatCurrency).toBe("USD");
    expect(c.priceToDisplay).toBe(1);
  });
});

describe("cross", () => {
  const rates = { USD: 0.08, IDR: 1432.73, EUR: 0.074 };

  it("derives a fiat-to-fiat rate", () => {
    expect(cross(rates, "USD", "IDR")).toBeCloseTo(17909.125, 1);
  });

  it("returns 1 for a currency against itself", () => {
    expect(cross(rates, "USD", "USD")).toBe(1);
  });

  it("returns 0 when a leg is missing", () => {
    expect(cross(rates, "USD", "JPY")).toBe(0);
  });
});
