import { createAdminSupabase } from "../supabase/admin";
import { recordEvent } from "../risk-telemetry";
import { floatStream } from "./rng";
import { pickIndices, toLedger } from "./util";
import { MINES_TILES, minesMultiplier, minesNormalize } from "./mines";
import { ensureSeedRow } from "./engine";

// Interactive Mines. The layout is drawn once at start from the committed seed
// and kept server-side, so the client can only learn a mine by hitting it. The
// stake is debited at start and any cashout credits stake * multiplier.

export type MinesRound = {
  id: number;
  user_id: string;
  stake: number;
  mine_count: number;
  mines: number[];
  revealed: number[];
  multiplier: number;
  payout: number;
  status: "active" | "busted" | "cashed";
};

type RawRound = {
  id: number;
  user_id: string;
  stake: number | string;
  mine_count: number;
  mines: unknown;
  revealed: unknown;
  multiplier: number | string;
  payout: number | string;
  status: "active" | "busted" | "cashed";
};

function parseRound(row: RawRound): MinesRound {
  const mines = Array.isArray(row.mines) ? (row.mines as number[]) : [];
  const revealed = Array.isArray(row.revealed) ? (row.revealed as number[]) : [];
  return {
    id: row.id,
    user_id: row.user_id,
    stake: Number(row.stake),
    mine_count: row.mine_count,
    mines,
    revealed,
    multiplier: Number(row.multiplier),
    payout: Number(row.payout),
    status: row.status,
  };
}

async function balanceOf(userId: string): Promise<number> {
  const { data } = await createAdminSupabase()
    .from("profiles")
    .select("balance")
    .eq("id", userId)
    .maybeSingle();
  return Number((data as { balance?: number } | null)?.balance ?? 0);
}

export type MinesActive =
  | {
      active: true;
      roundId: number;
      mineCount: number;
      revealed: number[];
      multiplier: number;
      nextMultiplier: number;
      stake: number;
      balance: number;
    }
  | { active: false; balance: number };

// Recover an open round after a reload. The layout stays server-side, so this
// only reports what the member has already revealed.
export async function getActiveRound(userId: string): Promise<MinesActive> {
  const { data } = await createAdminSupabase()
    .from("game_rounds")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return { active: false, balance: await balanceOf(userId) };
  const round = parseRound(data as RawRound);
  return {
    active: true,
    roundId: round.id,
    mineCount: round.mine_count,
    revealed: round.revealed,
    multiplier: minesMultiplier(round.mine_count, round.revealed.length),
    nextMultiplier: minesMultiplier(round.mine_count, round.revealed.length + 1),
    stake: round.stake,
    balance: await balanceOf(userId),
  };
}

export type MinesOutcome =
  | {
      ok: true;
      roundId: number;
      mineCount: number;
      revealed: number[];
      multiplier: number;
      status: "active" | "busted" | "cashed";
      payout: number;
      balance: number;
      // Revealed only once the round is over, so the member can check the layout.
      mines?: number[];
      nextMultiplier: number;
    }
  | { ok: false; error: string; status: number; roundId?: number };

export async function startMines(opts: {
  userId: string;
  stake: number;
  mines: unknown;
  req?: Request;
}): Promise<MinesOutcome> {
  let normalized;
  try {
    normalized = minesNormalize(opts.mines);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid bet", status: 400 };
  }

  const admin = createAdminSupabase();

  const { data: open } = await admin
    .from("game_rounds")
    .select("id")
    .eq("user_id", opts.userId)
    .eq("status", "active")
    .maybeSingle();
  if (open) {
    return {
      ok: false,
      error: "Finish your open round first",
      status: 409,
      roundId: (open as { id: number }).id,
    };
  }

  const seed = await ensureSeedRow(opts.userId);
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

    const layout = pickIndices(
      floatStream(seed.server_seed, seed.client_seed, nonce, normalized.mines),
      MINES_TILES,
      normalized.mines
    );

    const { data: inserted, error } = await admin
      .from("game_rounds")
      .insert({
        user_id: opts.userId,
        game: "mines",
        stake: opts.stake,
        mine_count: normalized.mines,
        mines: layout,
        revealed: [],
        multiplier: 1,
        status: "active",
        server_seed_hash: seed.server_seed_hash,
        client_seed: seed.client_seed,
        nonce,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    void recordEvent({
      userId: opts.userId,
      kind: "bet",
      req: opts.req,
      detail: { game: "mines", action: "start", stake: opts.stake, mines: normalized.mines },
    });

    return {
      ok: true,
      roundId: (inserted as { id: number }).id,
      mineCount: normalized.mines,
      revealed: [],
      multiplier: 1,
      status: "active",
      payout: 0,
      balance: await balanceOf(opts.userId),
      nextMultiplier: minesMultiplier(normalized.mines, 1),
    };
  } catch (err) {
    await admin.rpc("credit_balance", { p_user_id: opts.userId, p_amount: opts.stake });
    return { ok: false, error: err instanceof Error ? err.message : "Could not start", status: 500 };
  }
}

async function loadActive(userId: string, roundId: number): Promise<MinesRound | null> {
  const { data } = await createAdminSupabase()
    .from("game_rounds")
    .select("*")
    .eq("id", roundId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data ? parseRound(data as RawRound) : null;
}

export async function revealMines(opts: {
  userId: string;
  roundId: number;
  tile: number;
  req?: Request;
}): Promise<MinesOutcome> {
  const admin = createAdminSupabase();
  const round = await loadActive(opts.userId, opts.roundId);
  if (!round) return { ok: false, error: "No open round", status: 404 };

  const tile = Math.trunc(opts.tile);
  if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_TILES) {
    return { ok: false, error: "Invalid tile", status: 400 };
  }
  if (round.revealed.includes(tile)) {
    return { ok: false, error: "That tile is already open", status: 400 };
  }

  const revealed = [...round.revealed, tile].sort((a, b) => a - b);

  if (round.mines.includes(tile)) {
    await admin
      .from("game_rounds")
      .update({ revealed, status: "busted", payout: 0, multiplier: 0, ended_at: new Date().toISOString() })
      .eq("id", round.id)
      .eq("status", "active");
    void recordEvent({
      userId: opts.userId,
      kind: "bet",
      req: opts.req,
      detail: { game: "mines", action: "bust", stake: round.stake },
    });
    return {
      ok: true,
      roundId: round.id,
      mineCount: round.mine_count,
      revealed,
      multiplier: 0,
      status: "busted",
      payout: 0,
      balance: await balanceOf(opts.userId),
      mines: round.mines,
      nextMultiplier: 0,
    };
  }

  const multiplier = minesMultiplier(round.mine_count, revealed.length);
  const safeTotal = MINES_TILES - round.mine_count;
  const finished = revealed.length >= safeTotal;
  const payout = finished ? toLedger(round.stake * multiplier) : 0;

  if (payout > 0) {
    await admin.rpc("credit_balance", { p_user_id: opts.userId, p_amount: payout });
  }

  await admin
    .from("game_rounds")
    .update({
      revealed,
      multiplier,
      payout,
      status: finished ? "cashed" : "active",
      ended_at: finished ? new Date().toISOString() : null,
    })
    .eq("id", round.id)
    .eq("status", "active");

  if (finished) {
    void recordEvent({
      userId: opts.userId,
      kind: "bet",
      req: opts.req,
      detail: { game: "mines", action: "clear", stake: round.stake, payout, multiplier },
    });
  }

  return {
    ok: true,
    roundId: round.id,
    mineCount: round.mine_count,
    revealed,
    multiplier,
    status: finished ? "cashed" : "active",
    payout,
    balance: await balanceOf(opts.userId),
    mines: finished ? round.mines : undefined,
    nextMultiplier: minesMultiplier(round.mine_count, revealed.length + 1),
  };
}

export async function cashoutMines(opts: {
  userId: string;
  roundId: number;
  req?: Request;
}): Promise<MinesOutcome> {
  const admin = createAdminSupabase();
  const round = await loadActive(opts.userId, opts.roundId);
  if (!round) return { ok: false, error: "No open round", status: 404 };
  if (round.revealed.length === 0) {
    return { ok: false, error: "Reveal at least one tile first", status: 400 };
  }

  const multiplier = minesMultiplier(round.mine_count, round.revealed.length);
  const payout = toLedger(round.stake * multiplier);
  if (payout > 0) {
    await admin.rpc("credit_balance", { p_user_id: opts.userId, p_amount: payout });
  }

  await admin
    .from("game_rounds")
    .update({ multiplier, payout, status: "cashed", ended_at: new Date().toISOString() })
    .eq("id", round.id)
    .eq("status", "active");

  void recordEvent({
    userId: opts.userId,
    kind: "bet",
    req: opts.req,
    detail: { game: "mines", action: "cashout", stake: round.stake, payout, multiplier },
  });

  return {
    ok: true,
    roundId: round.id,
    mineCount: round.mine_count,
    revealed: round.revealed,
    multiplier,
    status: "cashed",
    payout,
    balance: await balanceOf(opts.userId),
    mines: round.mines,
    nextMultiplier: 0,
  };
}
