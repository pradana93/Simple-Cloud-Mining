import { createAdminSupabase } from "../supabase/admin";
import { recordEvent } from "../risk-telemetry";
import { floatStream, hashServerSeed, randomServerSeed } from "./rng";
import { getInstantGame } from "./registry";
import { applyPayout, type CasinoEcon } from "./econ";
import { asNumber, firstRow, idempotencyKey } from "../ledger";
import type { PlayResult } from "./types";

// Server-only settle path for the casino. The client never sends an outcome and
// never talks to the money functions directly: this module debits the stake,
// derives the result from the committed seed, credits any payout, and records
// the bet with the fields needed to re-derive it.

export type SeedView = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  previous: { serverSeed: string; serverSeedHash: string } | null;
};

export type SeedRow = {
  user_id: string;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  prev_server_seed: string | null;
  prev_server_seed_hash: string | null;
};

export async function ensureSeedRow(userId: string): Promise<SeedRow> {
  const admin = createAdminSupabase();
  const { data } = await admin.from("game_seeds").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as SeedRow;

  const serverSeed = randomServerSeed();
  const row = {
    user_id: userId,
    server_seed: serverSeed,
    server_seed_hash: hashServerSeed(serverSeed),
    client_seed: "client",
    nonce: 0,
  };
  const { data: inserted, error } = await admin
    .from("game_seeds")
    .upsert(row, { onConflict: "user_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (inserted) return inserted as SeedRow;

  // Lost a race; read the row the other request created.
  const { data: existing } = await admin.from("game_seeds").select("*").eq("user_id", userId).maybeSingle();
  if (!existing) throw new Error("Could not create a seed pair");
  return existing as SeedRow;
}

export async function getSeedView(userId: string): Promise<SeedView> {
  const row = await ensureSeedRow(userId);
  return {
    serverSeedHash: row.server_seed_hash,
    clientSeed: row.client_seed,
    nonce: Number(row.nonce),
    previous:
      row.prev_server_seed && row.prev_server_seed_hash
        ? { serverSeed: row.prev_server_seed, serverSeedHash: row.prev_server_seed_hash }
        : null,
  };
}

export async function setClientSeed(userId: string, clientSeed: string): Promise<SeedView> {
  await ensureSeedRow(userId);
  const clean = String(clientSeed ?? "").trim().slice(0, 64) || "client";
  await createAdminSupabase().from("game_seeds").update({ client_seed: clean }).eq("user_id", userId);
  return getSeedView(userId);
}

export async function rotateSeed(userId: string): Promise<SeedView> {
  await ensureSeedRow(userId);
  const nextSeed = randomServerSeed();
  const { error } = await createAdminSupabase().rpc("rotate_game_seed", {
    p_user: userId,
    p_next_seed: nextSeed,
    p_next_hash: hashServerSeed(nextSeed),
  });
  if (error) throw new Error(error.message);
  return getSeedView(userId);
}

export type PlayOutcome =
  | { ok: true; result: PlayResult; payout: number; balance: number; seed: SeedView; nonce: number }
  | { ok: false; error: string; status: number };

type StoredBet = {
  id: number;
  user_id: string;
  game: string;
  stake: number | string;
  multiplier: number | string;
  payout: number | string;
  won: boolean;
  result: unknown;
  server_seed_hash: string;
  client_seed: string;
  nonce: number | string;
};

async function balanceOf(userId: string): Promise<number> {
  const { data } = await createAdminSupabase()
    .from("profiles")
    .select("balance")
    .eq("id", userId)
    .maybeSingle();
  return asNumber((data as { balance?: unknown } | null)?.balance);
}

async function outcomeFromBet(bet: StoredBet): Promise<PlayOutcome> {
  const balance = await balanceOf(bet.user_id);
  const nonce = asNumber(bet.nonce);
  return {
    ok: true,
    result: {
      won: Boolean(bet.won),
      multiplier: asNumber(bet.multiplier),
      detail: (bet.result ?? {}) as Record<string, unknown>,
    },
    payout: asNumber(bet.payout),
    balance,
    seed: {
      serverSeedHash: bet.server_seed_hash,
      clientSeed: bet.client_seed,
      nonce,
      previous: null,
    },
    nonce,
  };
}

export async function playInstant(opts: {
  userId: string;
  gameId: string;
  stake: number;
  params: unknown;
  req?: Request;
  econ: CasinoEcon;
  idempotencyKey?: string;
}): Promise<PlayOutcome> {
  const game = getInstantGame(opts.gameId);
  if (!game) return { ok: false, error: "Unknown game", status: 404 };

  let normalized: unknown;
  try {
    normalized = game.normalize(opts.params);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid bet", status: 400 };
  }

  const admin = createAdminSupabase();
  const key = idempotencyKey(opts.userId, `bet:${opts.gameId}`, opts.idempotencyKey);

  // A retried request returns the original receipt without consuming a nonce.
  const { data: existing } = await admin
    .from("game_bets")
    .select("id,user_id,game,stake,multiplier,payout,won,result,server_seed_hash,client_seed,nonce")
    .eq("idempotency_key", key)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (existing) return outcomeFromBet(existing as StoredBet);

  const seed = await ensureSeedRow(opts.userId);
  const { data: nonceData, error: nonceError } = await admin.rpc("next_game_nonce", {
    p_user_id: opts.userId,
  });
  if (nonceError) return { ok: false, error: nonceError.message, status: 500 };
  const nonce = Number(nonceData ?? 0);

  const floats = floatStream(
    seed.server_seed,
    seed.client_seed,
    nonce,
    game.floats(normalized)
  );
  const result = game.play(normalized, floats);
  const paid = applyPayout(opts.econ, opts.stake, result.multiplier);
  const payout = paid.payout;
  const settled = { ...result, multiplier: paid.multiplier };

  const { data, error } = await admin.rpc("settle_game_bet", {
    p_user: opts.userId,
    p_game: opts.gameId,
    p_stake: opts.stake,
    p_multiplier: paid.multiplier,
    p_payout: payout,
    p_won: result.won,
    p_params: normalized,
    p_result: result.detail,
    p_seed_hash: seed.server_seed_hash,
    p_client_seed: seed.client_seed,
    p_nonce: nonce,
    p_idempotency_key: key,
  });
  if (error) return { ok: false, error: error.message, status: 500 };

  const row = firstRow<{ status?: string; bet_id?: unknown; balance?: unknown }>(data);
  if (row?.status === "insufficient") {
    return { ok: false, error: "Insufficient balance", status: 400 };
  }
  if (row?.status === "missing_user") {
    return { ok: false, error: "Member not found", status: 404 };
  }
  if (row?.status === "duplicate") {
    const { data: duplicate } = await admin
      .from("game_bets")
      .select("id,user_id,game,stake,multiplier,payout,won,result,server_seed_hash,client_seed,nonce")
      .eq("id", row.bet_id)
      .eq("user_id", opts.userId)
      .maybeSingle();
    if (duplicate) return outcomeFromBet(duplicate as StoredBet);
  }
  if (row?.status !== "applied") {
    return { ok: false, error: "Bet was not settled", status: 500 };
  }

  void recordEvent({
    userId: opts.userId,
    kind: "bet",
    req: opts.req,
    detail: { game: opts.gameId, stake: opts.stake, payout, multiplier: paid.multiplier },
  });

  return {
    ok: true,
    result: settled,
    payout,
    balance: asNumber(row.balance),
    seed: {
      serverSeedHash: seed.server_seed_hash,
      clientSeed: seed.client_seed,
      nonce,
      previous: null,
    },
    nonce,
  };
}
