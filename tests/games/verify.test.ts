import { describe, expect, it } from "vitest";
import { crashPoint } from "@/lib/games/crash";
import { dice } from "@/lib/games/dice";
import { MINES_TILES, minesMultiplier } from "@/lib/games/mines";
import { floatStream, hashServerSeed } from "@/lib/games/rng";
import { pickIndices } from "@/lib/games/util";
import {
  floatStreamClient,
  hashSeedHex,
  verifyBet,
  type VerifiableBet,
} from "@/lib/games/verify";

const SERVER_SEED = "server-seed";
const CLIENT_SEED = "client";
const NONCE = 7;

function bet(overrides: Partial<VerifiableBet> = {}): VerifiableBet {
  return {
    key: "bet:1",
    source: "bet",
    game: "dice",
    createdAt: "2026-10-21T00:00:00.000Z",
    nonce: NONCE,
    stake: 10,
    multiplier: 0,
    payout: 0,
    won: false,
    serverSeedHash: hashServerSeed(SERVER_SEED),
    clientSeed: CLIENT_SEED,
    params: {},
    result: {},
    revealedServerSeed: null,
    ...overrides,
  };
}

describe("client verification math", () => {
  it("hashes and streams identically to the server", async () => {
    expect(await hashSeedHex(SERVER_SEED)).toBe(hashServerSeed(SERVER_SEED));
    expect(await floatStreamClient(SERVER_SEED, CLIENT_SEED, NONCE, 20)).toEqual(
      floatStream(SERVER_SEED, CLIENT_SEED, NONCE, 20)
    );
  });

  it("rejects an empty or mismatched seed", async () => {
    const empty = await verifyBet(bet(), "");
    expect(empty.matched).toBe(false);
    expect(empty.error).toContain("Enter");

    const wrong = await verifyBet(bet(), "different-seed");
    expect(wrong.seedHashMatched).toBe(false);
    expect(wrong.matched).toBe(false);
  });
});

describe("instant game verification", () => {
  const params = dice.normalize({ target: 50, mode: "under" });
  const played = dice.play(params, floatStream(SERVER_SEED, CLIENT_SEED, NONCE, dice.floats(params)));
  const valid = bet({
    params,
    result: played.detail,
    won: played.won,
    multiplier: played.multiplier,
    payout: played.won ? 10 * played.multiplier : 0,
  });

  it("reproduces a settled dice round", async () => {
    const out = await verifyBet(valid, SERVER_SEED);
    expect(out.seedHashMatched).toBe(true);
    expect(out.matched).toBe(true);
    expect(out.mismatches).toEqual([]);
    expect(out.recomputed).toEqual(played.detail);
  });

  it("catches a changed result and a changed client seed", async () => {
    const changed = await verifyBet(
      { ...valid, result: { ...valid.result, roll: Number(valid.result.roll) + 1 } },
      SERVER_SEED
    );
    expect(changed.matched).toBe(false);
    expect(changed.mismatches.map((m) => m.field)).toContain("roll");

    const client = await verifyBet({ ...valid, clientSeed: "other-client" }, SERVER_SEED);
    expect(client.seedHashMatched).toBe(true);
    expect(client.matched).toBe(false);
  });
});

describe("crash verification", () => {
  const crashAt = crashPoint(floatStream(SERVER_SEED, CLIENT_SEED, NONCE, 1)[0]);

  it("checks the crash point and cashout consistency", async () => {
    expect(crashAt).toBeGreaterThan(1.5);
    const cashed = bet({
      game: "crash",
      result: { crashAt, cashout: 1.5, status: "cashed" },
      won: true,
      multiplier: 1.5,
      payout: 15,
    });
    const out = await verifyBet(cashed, SERVER_SEED);
    expect(out.matched).toBe(true);
    expect(out.recomputed).toEqual({ crashAt });

    const loss = bet({
      game: "crash",
      result: { crashAt, cashout: null, status: "crashed" },
      won: false,
      multiplier: 0,
    });
    expect((await verifyBet(loss, SERVER_SEED)).matched).toBe(true);
  });

  it("catches a changed crash point, a cashout above it, and a wrong win flag", async () => {
    const changed = bet({
      game: "crash",
      result: { crashAt: crashAt + 0.25, cashout: 1.5, status: "cashed" },
      won: true,
      multiplier: 1.5,
    });
    const changedOut = await verifyBet(changed, SERVER_SEED);
    expect(changedOut.matched).toBe(false);
    expect(changedOut.mismatches.map((m) => m.field)).toContain("crashAt");

    const late = bet({
      game: "crash",
      result: { crashAt, cashout: crashAt + 0.25, status: "cashed" },
      won: true,
      multiplier: crashAt + 0.25,
    });
    const lateOut = await verifyBet(late, SERVER_SEED);
    expect(lateOut.matched).toBe(false);
    expect(lateOut.mismatches.map((m) => m.field)).toContain("cashout");

    const flag = bet({
      game: "crash",
      result: { crashAt, cashout: 1.5, status: "cashed" },
      won: false,
    });
    const flagOut = await verifyBet(flag, SERVER_SEED);
    expect(flagOut.matched).toBe(false);
    expect(flagOut.mismatches.map((m) => m.field)).toContain("won");
  });
});

describe("mines verification", () => {
  const mineCount = 3;
  const layout = pickIndices(
    floatStream(SERVER_SEED, CLIENT_SEED, NONCE, mineCount),
    MINES_TILES,
    mineCount
  ).sort((a, b) => a - b);
  const safe = Array.from({ length: MINES_TILES }, (_, i) => i).filter((tile) => !layout.includes(tile));
  const revealed = [safe[0]];
  const multiplier = minesMultiplier(mineCount, revealed.length);
  const valid = bet({
    game: "mines",
    source: "round",
    params: { mines: mineCount },
    result: { mineCount, mines: layout, revealed, status: "cashed" },
    won: true,
    multiplier,
    payout: 10 * multiplier,
  });

  it("reproduces a settled mines round", async () => {
    const out = await verifyBet(valid, SERVER_SEED);
    expect(out.matched).toBe(true);
    expect(out.recomputed).toEqual({ mines: layout, mineCount });
  });

  it("catches a changed layout, a mine in a cashed reveal, and a wrong win flag", async () => {
    const altered = [layout[1], layout[2], safe[0]].sort((a, b) => a - b);
    const layoutOut = await verifyBet(
      { ...valid, result: { ...valid.result, mines: altered } },
      SERVER_SEED
    );
    expect(layoutOut.matched).toBe(false);
    expect(layoutOut.mismatches.map((m) => m.field)).toContain("mines");

    const badReveal = await verifyBet(
      { ...valid, result: { ...valid.result, revealed: [layout[0]] } },
      SERVER_SEED
    );
    expect(badReveal.matched).toBe(false);
    expect(badReveal.mismatches.map((m) => m.field)).toContain("revealed");

    const badFlag = await verifyBet({ ...valid, won: false }, SERVER_SEED);
    expect(badFlag.matched).toBe(false);
    expect(badFlag.mismatches.map((m) => m.field)).toContain("won");
  });
});
