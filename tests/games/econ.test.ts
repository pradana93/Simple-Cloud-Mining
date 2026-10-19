import { describe, expect, it } from "vitest";
import { applyPayout, casinoEcon, isGameDisabled, scaleMultiplier } from "@/lib/games/econ";
import { FALLBACK } from "@/lib/settings";
import type { SiteSettings } from "@/lib/types";

function settings(patch: Partial<SiteSettings>): SiteSettings {
  return { ...FALLBACK, ...patch };
}

describe("casinoEcon", () => {
  it("is neutral by default", () => {
    const e = casinoEcon(settings({}));
    expect(e.edgeBoost).toBe(0);
    expect(e.maxWin).toBe(0);
    expect(e.disabled).toEqual([]);
  });

  it("clamps the edge to the allowed ceiling", () => {
    expect(casinoEcon(settings({ games_edge_boost: 80 })).edgeBoost).toBe(50);
    expect(casinoEcon(settings({ games_edge_boost: -5 })).edgeBoost).toBe(0);
  });

  it("parses disabled ids without case or spaces", () => {
    const e = casinoEcon(settings({ games_disabled: " Crash , plinko ,, " }));
    expect(e.disabled).toEqual(["crash", "plinko"]);
    expect(isGameDisabled(e, "CRASH")).toBe(true);
    expect(isGameDisabled(e, "dice")).toBe(false);
  });
});

describe("scaleMultiplier", () => {
  it("leaves payouts untouched at zero edge", () => {
    expect(scaleMultiplier(casinoEcon(settings({})), 2)).toBe(2);
  });

  it("trims the payout by the edge", () => {
    const e = casinoEcon(settings({ games_edge_boost: 10 }));
    expect(scaleMultiplier(e, 2)).toBeCloseTo(1.8, 10);
  });

  it("never lifts a losing round", () => {
    expect(scaleMultiplier(casinoEcon(settings({ games_edge_boost: 10 })), 0)).toBe(0);
  });
});

describe("applyPayout", () => {
  it("pays the raw amount at zero edge, floored to ledger precision", () => {
    const r = applyPayout(casinoEcon(settings({})), 1, 2.5);
    expect(r.payout).toBe(2.5);
    expect(r.multiplier).toBe(2.5);
    expect(r.capped).toBe(false);
  });

  it("reduces the payout by the edge", () => {
    const r = applyPayout(casinoEcon(settings({ games_edge_boost: 20 })), 10, 3);
    expect(r.payout).toBeCloseTo(24, 8);
    expect(r.multiplier).toBeCloseTo(2.4, 8);
  });

  it("caps a win at the ceiling and reports it", () => {
    const r = applyPayout(casinoEcon(settings({ games_max_win: 5 })), 1, 100);
    expect(r.payout).toBe(5);
    expect(r.capped).toBe(true);
    expect(r.multiplier).toBe(5);
  });

  it("pays nothing on a loss", () => {
    const r = applyPayout(casinoEcon(settings({})), 1, 0);
    expect(r.payout).toBe(0);
    expect(r.multiplier).toBe(0);
  });

  it("keeps the edge so operator returns stay under one", () => {
    const e = casinoEcon(settings({ games_edge_boost: 25 }));
    const before = 1.98;
    const after = applyPayout(e, 1, before).multiplier;
    expect(after).toBeLessThan(before);
  });
});
