import { describe, expect, it } from "vitest";
import {
  findAllowed,
  isAllowed,
  shortAddress,
  validAddress,
  type AllowlistEntry,
} from "@/lib/allowlist";

const entry = (id: number, address: string, label: string | null = null): AllowlistEntry => ({
  id,
  label,
  currency: "DOGE",
  address,
  created_at: "2026-01-01T00:00:00Z",
});

const A = "D7xQk9v2mZ4tLp8nRc6Bs1YhJ3eWfUg5Ki";
const B = "D8aTb1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uW";

describe("validAddress", () => {
  it("accepts a plausible wallet address", () => {
    expect(validAddress(A)).toBe(true);
  });

  it("trims before measuring", () => {
    expect(validAddress(`  ${A}  `)).toBe(true);
  });

  it("rejects short, long and spaced input", () => {
    expect(validAddress("D7xQ")).toBe(false);
    expect(validAddress("D".repeat(201))).toBe(false);
    expect(validAddress("D7xQk9 v2mZ4tLp8nRc6")).toBe(false);
    expect(validAddress("")).toBe(false);
  });
});

describe("findAllowed", () => {
  const rows = [entry(1, A, "Cold wallet")];

  it("matches an exact address", () => {
    expect(findAllowed(rows, A)?.id).toBe(1);
  });

  it("ignores surrounding whitespace", () => {
    expect(findAllowed(rows, `  ${A} `)?.id).toBe(1);
  });

  it("returns null for an unknown or empty address", () => {
    expect(findAllowed(rows, B)).toBeNull();
    expect(findAllowed(rows, "")).toBeNull();
  });
});

describe("isAllowed", () => {
  const rows = [entry(1, A)];

  it("does not lock anything while the list is empty", () => {
    expect(isAllowed([], B)).toBe(true);
  });

  it("permits a saved address and refuses the rest", () => {
    expect(isAllowed(rows, A)).toBe(true);
    expect(isAllowed(rows, B)).toBe(false);
  });
});

describe("shortAddress", () => {
  it("keeps short addresses whole", () => {
    expect(shortAddress("D7xQk9v2mZ")).toBe("D7xQk9v2mZ");
  });

  it("abbreviates long addresses", () => {
    expect(shortAddress(A)).toBe(`${A.slice(0, 10)}...${A.slice(-6)}`);
  });
});
