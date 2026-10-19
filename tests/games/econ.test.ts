import { describe, expect, it } from "vitest";
import {
  applyPayout,
  casinoEcon,
  inWindow,
  isGameDisabled,
  matchTier,
  parseConfig,
  parseSchedule,
  parseTiers,
  resolveEcon,
  scaleMultiplier,
} from "@/lib/games/econ";
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

const NOON = new Date("2026-01-01T12:00:00Z");

describe("parseConfig", () => {
  it("lowercases game keys and reads overrides", () => {
    const c = parseConfig({ Crash: { edge: 12, maxWin: 5, min: 1, max: 9 } });
    expect(c.crash).toEqual({ edge: 12, maxWin: 5, min: 1, max: 9 });
  });

  it("survives junk input", () => {
    expect(parseConfig(null)).toEqual({});
    expect(parseConfig([1, 2])).toEqual({});
  });
});

describe("parseTiers", () => {
  it("drops unnamed tiers and sorts by wager", () => {
    const t = parseTiers([
      { name: "Whale", minWager: 500, edge: 2 },
      { name: "", minWager: 1 },
      { name: "Regular", minWager: 50, edge: 10 },
    ]);
    expect(t.map((x) => x.name)).toEqual(["Regular", "Whale"]);
  });
});

describe("matchTier", () => {
  it("picks the highest tier the wager reaches", () => {
    const tiers = parseTiers([
      { name: "Regular", minWager: 50, edge: 10 },
      { name: "Whale", minWager: 500, edge: 2 },
    ]);
    expect(matchTier(tiers, 10)).toBeNull();
    expect(matchTier(tiers, 60)?.name).toBe("Regular");
    expect(matchTier(tiers, 1000)?.name).toBe("Whale");
  });
});

describe("inWindow", () => {
  const base = { enabled: true, startHour: 9, endHour: 17, edgeDelta: -5 };
  it("is false when disabled", () => {
    expect(inWindow({ ...base, enabled: false }, NOON)).toBe(false);
  });
  it("matches an ordinary range", () => {
    expect(inWindow(base, NOON)).toBe(true);
    expect(inWindow(base, new Date("2026-01-01T20:00:00Z"))).toBe(false);
  });
  it("wraps across midnight", () => {
    const night = { ...base, startHour: 22, endHour: 4 };
    expect(inWindow(night, new Date("2026-01-01T23:00:00Z"))).toBe(true);
    expect(inWindow(night, new Date("2026-01-01T03:00:00Z"))).toBe(true);
    expect(inWindow(night, new Date("2026-01-01T12:00:00Z"))).toBe(false);
  });
  it("treats equal hours as all day", () => {
    expect(inWindow({ ...base, startHour: 5, endHour: 5 }, NOON)).toBe(true);
  });
});

describe("resolveEcon", () => {
  it("applies a per-game override over the lobby value", () => {
    const s = settings({
      games_edge_boost: 5,
      games_config: { plinko: { edge: 15, maxWin: 3 } },
    });
    const e = resolveEcon(s, "plinko", 0, NOON);
    expect(e.edgeBoost).toBe(15);
    expect(e.maxWin).toBe(3);
  });

  it("lets a tier override both lobby and game values", () => {
    const s = settings({
      games_edge_boost: 20,
      games_config: { dice: { edge: 15 } },
      games_tiers: [{ id: "whale", name: "Whale", minWager: 100, edge: 2, maxWin: 1000 }],
    });
    const e = resolveEcon(s, "dice", 500, NOON);
    expect(e.edgeBoost).toBe(2);
    expect(e.maxWin).toBe(1000);
  });

  it("applies the promo window and clamps the result", () => {
    const s = settings({
      games_edge_boost: 48,
      games_schedule: { enabled: true, startHour: 9, endHour: 17, edgeDelta: 10 },
    });
    expect(resolveEcon(s, "dice", 0, NOON).edgeBoost).toBe(50);
  });

  it("stays neutral outside the window", () => {
    const s = settings({
      games_edge_boost: 5,
      games_schedule: { enabled: true, startHour: 9, endHour: 17, edgeDelta: -5 },
    });
    expect(resolveEcon(s, "dice", 0, new Date("2026-01-01T23:00:00Z")).edgeBoost).toBe(5);
  });

  it("honours per-game bet bounds", () => {
    const s = settings({ games_min_bet: 1, games_max_bet: 100, games_config: { keno: { min: 5, max: 20 } } });
    const e = resolveEcon(s, "keno", 0, NOON);
    expect(e.minBet).toBe(5);
    expect(e.maxBet).toBe(20);
  });
});

describe("parseSchedule", () => {
  it("clamps hours and the edge delta", () => {
    const s = parseSchedule({ enabled: "yes", startHour: 99, endHour: -1, edgeDelta: 200 });
    expect(s.enabled).toBe(true);
    expect(s.startHour).toBe(23);
    expect(s.endHour).toBe(0);
    expect(s.edgeDelta).toBe(50);
  });
});
