import { createAdminSupabase } from "../supabase/admin";
import { recordEvent } from "../risk-telemetry";
import { floatStream, hashServerSeed, randomServerSeed } from "./rng";
import { getInstantGame } from "./registry";
import { toLedger } from "./util";
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
  const row = await ensureSeedRow(userId);
  const nextSeed = randomServerSeed();
  await createAdminSupabase()
    .from("game_seeds")
    .update({
      prev_server_seed: row.server_seed,
      prev_server_seed_hash: row.server_seed_hash,
      server_seed: nextSeed,
      server_seed_hash: hashServerSeed(nextSeed),
      nonce: 0,
      rotated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return getSeedView(userId);
}

export type PlayOutcome =
  | { ok: true; result: PlayResult; payout: number; balance: number; seed: SeedView; nonce: number }
  | { ok: false; error: string; status: number };

export async function playInstant(opts: {
  userId: string;
  gameId: string;
  stake: number;
  params: unknown;
  req?: Request;
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
  const seed = await ensureSeedRow(opts.userId);

  // Reserve the stake first. A null result means the guarded update failed.
  const { data: debited, error: debitError } = await admin.rpc("debit_balance", {
    p_user_id: opts.userId,
    p_amount: opts.stake,
  });
  if (debitError) return { ok: false, error: debitError.message, status: 500 };
  if (debited == null) return { ok: false, error: "Insufficient balance", status: 400 };

  try {
    const { data: nonceData, error: nonceError } = await admin.rpc("next_game_nonce", {
      p_user_id: opts.userId,
    });
    if (nonceError) throw new Error(nonceError.message);
    const nonce = Number(nonceData ?? 0);

    const floats = floatStream(
      seed.server_seed,
      seed.client_seed,
      nonce,
      game.floats(normalized)
    );
    const result = game.play(normalized, floats);
    const payout = toLedger(opts.stake * result.multiplier);

    if (payout > 0) {
      const { error: creditError } = await admin.rpc("credit_balance", {
        p_user_id: opts.userId,
        p_amount: payout,
      });
      if (creditError) throw new Error(creditError.message);
    }

    await admin.from("game_bets").insert({
      user_id: opts.userId,
      game: opts.gameId,
      stake: opts.stake,
      multiplier: result.multiplier,
      payout,
      won: result.won,
      params: normalized as object,
      result: result.detail as object,
      server_seed_hash: seed.server_seed_hash,
      client_seed: seed.client_seed,
      nonce,
    });

    const { data: profile } = await admin
      .from("profiles")
      .select("balance")
      .eq("id", opts.userId)
      .maybeSingle();

    void recordEvent({
      userId: opts.userId,
      kind: "bet",
      req: opts.req,
      detail: { game: opts.gameId, stake: opts.stake, payout, multiplier: result.multiplier },
    });

    return {
      ok: true,
      result,
      payout,
      balance: Number((profile as { balance?: number } | null)?.balance ?? 0),
      seed: {
        serverSeedHash: seed.server_seed_hash,
        clientSeed: seed.client_seed,
        nonce,
        previous: null,
      },
      nonce,
    };
  } catch (err) {
    // Refund the reserved stake so a failure never costs the member money.
    await admin.rpc("credit_balance", { p_user_id: opts.userId, p_amount: opts.stake });
    return { ok: false, error: err instanceof Error ? err.message : "Bet failed", status: 500 };
  }
}
