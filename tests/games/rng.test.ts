import { describe, expect, it } from "vitest";
import { floatStream, hashServerSeed, randomServerSeed } from "@/lib/games/rng";

describe("server seed hash", () => {
  it("is a stable 64 character hex digest", () => {
    const hash = hashServerSeed("abc");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashServerSeed("abc")).toBe(hash);
  });

  it("changes when the seed changes", () => {
    expect(hashServerSeed("abc")).not.toBe(hashServerSeed("abd"));
  });

  it("generates distinct random seeds", () => {
    const a = randomServerSeed();
    const b = randomServerSeed();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });
});

describe("floatStream", () => {
  it("is deterministic for the same seed, client seed and nonce", () => {
    const a = floatStream("server", "client", 7, 20);
    const b = floatStream("server", "client", 7, 20);
    expect(a).toEqual(b);
  });

  it("returns the requested count of floats in [0, 1)", () => {
    const floats = floatStream("server", "client", 1, 37);
    expect(floats).toHaveLength(37);
    for (const f of floats) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("changes with the nonce and the client seed", () => {
    const base = floatStream("server", "client", 1, 8);
    expect(floatStream("server", "client", 2, 8)).not.toEqual(base);
    expect(floatStream("server", "other", 1, 8)).not.toEqual(base);
  });
});
