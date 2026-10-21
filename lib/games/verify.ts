import { crashPoint } from "./crash";
import { MINES_TILES } from "./mines";
import { getInstantGame } from "./registry";
import { pickIndices } from "./util";

// Client-safe verification. The browser recomputes the result from the revealed
// seed, so a member does not have to trust a verify endpoint.

export type VerifiableBet = {
  key: string;
  source: "bet" | "round";
  game: string;
  createdAt: string;
  nonce: number;
  stake: number;
  multiplier: number;
  payout: number;
  won: boolean;
  serverSeedHash: string;
  clientSeed: string;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
  revealedServerSeed: string | null;
};

export type VerifyMismatch = {
  field: string;
  recorded: unknown;
  recomputed: unknown;
};

export type VerifyOutcome = {
  seedHashMatched: boolean;
  matched: boolean;
  recomputed: Record<string, unknown> | null;
  mismatches: VerifyMismatch[];
  note: string | null;
  error: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bytesToHex(bytes: Uint8Array): string {
  const out: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    out.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return out.join("");
}

export async function hashSeedHex(serverSeed: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is not available in this browser.");
  const data = new TextEncoder().encode(serverSeed);
  const digest = await subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

export async function floatStreamClient(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  count: number
): Promise<number[]> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is not available in this browser.");

  const encoder = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(serverSeed),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const out: number[] = [];
  let cursor = 0;
  while (out.length < count) {
    const message = encoder.encode(`${clientSeed}:${nonce}:${cursor}`);
    const signature = new Uint8Array(await subtle.sign("HMAC", key, message));
    const view = new DataView(signature.buffer, signature.byteOffset, signature.byteLength);
    for (let i = 0; i < 8 && out.length < count; i++) {
      out.push(view.getUint32(i * 4, false) / 0x100000000);
    }
    cursor++;
  }
  return out;
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!sameValue(a[i], b[i])) return false;
    }
    return true;
  }
  if (isRecord(a) && isRecord(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      const key = aKeys[i];
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!sameValue(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function collectDiffs(
  field: string,
  recorded: unknown,
  recomputed: unknown,
  out: VerifyMismatch[]
): void {
  if (sameValue(recorded, recomputed)) return;
  if (isRecord(recorded) && isRecord(recomputed)) {
    const keys: string[] = [];
    const seen: Record<string, boolean> = {};
    const aKeys = Object.keys(recorded);
    const bKeys = Object.keys(recomputed);
    for (let i = 0; i < aKeys.length; i++) {
      seen[aKeys[i]] = true;
      keys.push(aKeys[i]);
    }
    for (let i = 0; i < bKeys.length; i++) {
      if (!seen[bKeys[i]]) keys.push(bKeys[i]);
    }
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      collectDiffs(field ? `${field}.${key}` : key, recorded[key], recomputed[key], out);
    }
    return;
  }
  out.push({ field: field || "result", recorded, recomputed });
}

function numbers(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const out: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const n = Math.trunc(Number(value[i]));
    if (!Number.isInteger(n)) return null;
    out.push(n);
  }
  out.sort((a, b) => a - b);
  return out;
}

function result(
  seedHashMatched: boolean,
  matched: boolean,
  recomputed: Record<string, unknown> | null,
  mismatches: VerifyMismatch[],
  note: string | null,
  error: string | null
): VerifyOutcome {
  return { seedHashMatched, matched, recomputed, mismatches, note, error };
}

export async function verifyBet(bet: VerifiableBet, rawServerSeed: string): Promise<VerifyOutcome> {
  const serverSeed = String(rawServerSeed ?? "").trim();
  if (!serverSeed) {
    return result(false, false, null, [], null, "Enter the revealed server seed for this round.");
  }

  let seedHash: string;
  try {
    seedHash = await hashSeedHex(serverSeed);
  } catch (err) {
    return result(false, false, null, [], null, err instanceof Error ? err.message : "Could not hash the seed.");
  }
  if (seedHash !== bet.serverSeedHash.toLowerCase()) {
    return result(
      false,
      false,
      null,
      [],
      null,
      "This server seed does not match the hash committed for this round."
    );
  }

  if (bet.game === "crash") {
    const floats = await floatStreamClient(serverSeed, bet.clientSeed, bet.nonce, 1);
    const crashAt = crashPoint(floats[0] ?? 0);
    const recorded = Number(bet.result.crashAt);
    const cashout = Number(bet.result.cashout);
    const status = String(bet.result.status ?? "");
    const mismatches: VerifyMismatch[] = [];

    if (!sameValue(recorded, crashAt)) {
      mismatches.push({ field: "crashAt", recorded, recomputed: crashAt });
    }

    if (status !== "cashed" && status !== "crashed") {
      mismatches.push({ field: "status", recorded: status, recomputed: "cashed or crashed" });
    } else {
      const shouldWin = status === "cashed";
      if (bet.won !== shouldWin) {
        mismatches.push({ field: "won", recorded: bet.won, recomputed: shouldWin });
      }
      if (status === "cashed") {
        if (!Number.isFinite(cashout) || cashout <= 1 || cashout > crashAt) {
          mismatches.push({
            field: "cashout",
            recorded: bet.result.cashout ?? null,
            recomputed: `above 1 and at or below ${crashAt}`,
          });
        }
      } else if (Number.isFinite(cashout) && cashout > 1 && cashout <= crashAt) {
        mismatches.push({
          field: "cashout",
          recorded: cashout,
          recomputed: "no cashout in a crashed round",
        });
      }
    }

    return result(
      true,
      mismatches.length === 0,
      { crashAt },
      mismatches,
      "The crash point is generated from the seed. The recorded cashout and status are checked for consistency; the cashout itself is a timing decision.",
      null
    );
  }

  if (bet.game === "mines") {
    const paramMines = Math.trunc(Number(bet.params.mines));
    const resultMines = Math.trunc(Number(bet.result.mineCount));
    const mineCount = Number.isInteger(paramMines) ? paramMines : resultMines;
    if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount >= MINES_TILES) {
      return result(true, false, null, [], null, "The recorded mine count is not valid.");
    }

    const floats = await floatStreamClient(serverSeed, bet.clientSeed, bet.nonce, mineCount);
    const layout = pickIndices(floats, MINES_TILES, mineCount).sort((a, b) => a - b);
    const recordedMines = numbers(bet.result.mines) ?? [];
    const revealed = numbers(bet.result.revealed) ?? [];
    const status = String(bet.result.status ?? "");
    const mismatches: VerifyMismatch[] = [];

    if (Number.isInteger(paramMines) && Number.isInteger(resultMines) && paramMines !== resultMines) {
      mismatches.push({ field: "mineCount", recorded: resultMines, recomputed: paramMines });
    }

    if (!sameValue(recordedMines, layout)) {
      mismatches.push({ field: "mines", recorded: recordedMines, recomputed: layout });
    }

    const hitsMine = revealed.some((tile) => layout.includes(tile));
    if (status === "cashed" && hitsMine) {
      mismatches.push({ field: "revealed", recorded: revealed, recomputed: "safe tiles only" });
    }
    if (status === "busted" && !hitsMine) {
      mismatches.push({ field: "revealed", recorded: revealed, recomputed: "one revealed tile must be a mine" });
    }
    if (status !== "cashed" && status !== "busted") {
      mismatches.push({ field: "status", recorded: status, recomputed: "cashed or busted" });
    } else if (bet.won !== (status === "cashed")) {
      mismatches.push({ field: "won", recorded: bet.won, recomputed: status === "cashed" });
    }

    return result(
      true,
      mismatches.length === 0,
      { mines: layout, mineCount },
      mismatches,
      "The mine layout is generated from the seed. The tiles you opened are your play.",
      null
    );
  }

  const game = getInstantGame(bet.game);
  if (!game) {
    return result(true, false, null, [], null, "This game does not have a verifier yet.");
  }

  let normalized: unknown;
  try {
    normalized = game.normalize(bet.params);
  } catch {
    return result(true, false, null, [], null, "The recorded bet inputs are not valid for this game.");
  }

  const floats = await floatStreamClient(serverSeed, bet.clientSeed, bet.nonce, game.floats(normalized));
  const played = game.play(normalized, floats);
  const mismatches: VerifyMismatch[] = [];
  collectDiffs("", bet.result, played.detail, mismatches);
  if (!sameValue(bet.won, played.won)) {
    mismatches.push({ field: "won", recorded: bet.won, recomputed: played.won });
  }

  return result(true, mismatches.length === 0, played.detail, mismatches, null, null);
}
