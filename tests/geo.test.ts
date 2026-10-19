import { describe, expect, it } from "vitest";
import { currencyForCountry, currencyForLocale, detectCurrency } from "@/lib/geo";

describe("currencyForCountry", () => {
  it("maps direct countries", () => {
    expect(currencyForCountry("ID")).toBe("IDR");
    expect(currencyForCountry("US")).toBe("USD");
    expect(currencyForCountry("AU")).toBe("AUD");
  });

  it("maps EU countries to EUR", () => {
    expect(currencyForCountry("DE")).toBe("EUR");
    expect(currencyForCountry("FR")).toBe("EUR");
    expect(currencyForCountry("NL")).toBe("EUR");
  });

  it("is case-insensitive and tolerant of junk", () => {
    expect(currencyForCountry("gb")).toBe("GBP");
    expect(currencyForCountry("ZZ")).toBeNull();
    expect(currencyForCountry(null)).toBeNull();
  });
});

describe("currencyForLocale", () => {
  it("reads the region subtag first", () => {
    expect(currencyForLocale("id-ID")).toBe("IDR");
    expect(currencyForLocale("de-DE")).toBe("EUR");
  });

  it("falls back to the language tag", () => {
    expect(currencyForLocale("ja")).toBe("JPY");
  });

  it("handles empty input", () => {
    expect(currencyForLocale("")).toBeNull();
    expect(currencyForLocale(null)).toBeNull();
  });
});

describe("detectCurrency", () => {
  it("prefers the country over the language", () => {
    expect(detectCurrency("US", "id-ID")).toBe("USD");
  });

  it("falls back to language when the country is unknown", () => {
    expect(detectCurrency("ZZ", "id-ID")).toBe("IDR");
  });

  it("returns null when nothing matches", () => {
    expect(detectCurrency(null, null)).toBeNull();
  });
});
