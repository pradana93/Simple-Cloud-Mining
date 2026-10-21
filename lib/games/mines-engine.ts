import { createAdminSupabase } from "../supabase/admin";
import { recordEvent } from "../risk-telemetry";
import { floatStream } from "./rng";
import { pickIndices } from "./util";
import { MINES_TILES, minesMultiplier, minesNormalize } from "./mines";
import { ensureSeedRow } from "./engine";
import { scaleMultiplier, type CasinoEcon } from "./econ";
import { asNumber, firstRow, idempotencyKey } from "../ledger";

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

function asTiles(value: unknown): number[] {
  if (Array.isArray(value)) return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v)) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseRound(row: RawRound): MinesRound {
  return {
    id: row.id,
    user_id: row.user_id,
    stake: Number(row.stake),
    mine_count: row.mine_count,
    mines: asTiles(row.mines),
    revealed: asTiles(row.revealed),
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
  return asNumber((data as { balance?: unknown } | null)?.balance);
}

async function loadRound(userId: string, roundId: number): Promise<MinesRound | null> {
  const { data } = await createAdminSupabase()
    .from("game_rounds")
    .select("*")
    .eq("id", roundId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ? parseRound(data as RawRound) : null;
}

async function roundOutcome(round: MinesRound, econ: CasinoEcon, balance?: number): Promise<MinesOutcome> {
  const ended = round.status !== "active";
  return {
    ok: true,
    roundId: round.id,
    mineCount: round.mine_count,
    revealed: round.revealed,
    multiplier: round.multiplier,
    status: round.status,
    payout: round.payout,
    balance: balance ?? (await balanceOf(round.user_id)),
    mines: ended ? round.mines : undefined,
    nextMultiplier: ended
      ? 0
      : scaleMultiplier(econ, minesMultiplier(round.mine_count, round.revealed.length + 1)),
  };
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
export async function getActiveRound(userId: string, econ: CasinoEcon): Promise<MinesActive> {
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
    multiplier: scaleMultiplier(econ, minesMultiplier(round.mine_count, round.revealed.length)),
    nextMultiplier: scaleMultiplier(econ, minesMultiplier(round.mine_count, round.revealed.length + 1)),
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
  econ: CasinoEcon;
  idempotencyKey?: string;
}): Promise<MinesOutcome> {
  let normalized;
  try {
    normalized = minesNormalize(opts.mines);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid bet", status: 400 };
  }

  const admin = createAdminSupabase();
  const key = idempotencyKey(opts.userId, "mines:start", opts.idempotencyKey);

  const { data: existing } = await admin
    .from("game_rounds")
    .select("*")
    .eq("idempotency_key", key)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (existing) return roundOutcome(parseRound(existing as RawRound), opts.econ);

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
  const { data: nonceData, error: nonceError } = await admin.rpc("next_game_nonce", {
    p_user_id: opts.userId,
  });
  if (nonceError) return { ok: false, error: nonceError.message, status: 500 };
  const nonce = Number(nonceData ?? 0);

  const layout = pickIndices(
    floatStream(seed.server_seed, seed.client_seed, nonce, normalized.mines),
    MINES_TILES,
    normalized.mines
  );

  const { data, error } = await admin.rpc("start_mines_round", {
    p_user: opts.userId,
    p_stake: opts.stake,
    p_mine_count: normalized.mines,
    p_mines: layout,
    p_seed_hash: seed.server_seed_hash,
    p_client_seed: seed.client_seed,
    p_nonce: nonce,
    p_idempotency_key: key,
  });
  if (error) return { ok: false, error: error.message, status: 500 };

  const res = firstRow<{ status?: string; round_id?: unknown; balance?: unknown }>(data);
  if (res?.status === "insufficient") {
    return { ok: false, error: "Insufficient balance", status: 400 };
  }
  if (res?.status === "missing_user") {
    return { ok: false, error: "Member not found", status: 404 };
  }
  if (res?.status === "active_exists") {
    return {
      ok: false,
      error: "Finish your open round first",
      status: 409,
      roundId: res.round_id == null ? undefined : Number(res.round_id),
    };
  }
  if (res?.status !== "applied" && res?.status !== "duplicate") {
    return { ok: false, error: "Could not start the round", status: 500 };
  }

  const round = res.round_id == null ? null : await loadRound(opts.userId, Number(res.round_id));
  if (!round) return { ok: false, error: "Could not start the round", status: 500 };

  if (res.status === "applied") {
    void recordEvent({
      userId: opts.userId,
      kind: "bet",
      req: opts.req,
      detail: { game: "mines", action: "start", stake: opts.stake, mines: normalized.mines },
    });
  }

  return roundOutcome(round, opts.econ, asNumber(res.balance));
}

export async function revealMines(opts: {
  userId: string;
  roundId: number;
  tile: number;
  req?: Request;
  econ: CasinoEcon;
}): Promise<MinesOutcome> {
  const tile = Math.trunc(opts.tile);
  if (!Number.isInteger(tile) || tile < 0 || tile >= MINES_TILES) {
    return { ok: false, error: "Invalid tile", status: 400 };
  }

  const { data, error } = await createAdminSupabase().rpc("settle_mines_reveal", {
    p_round_id: opts.roundId,
    p_user: opts.userId,
    p_tile: tile,
    p_edge: opts.econ.edgeBoost,
    p_max_win: opts.econ.maxWin,
  });
  if (error) return { ok: false, error: error.message, status: 500 };

  const res = firstRow<{ status?: string; round_status?: string; balance?: unknown }>(data);
  if (res?.status === "missing") return { ok: false, error: "No open round", status: 404 };
  if (res?.status === "invalid_tile") return { ok: false, error: "Invalid tile", status: 400 };
  if (res?.status === "already_revealed") return { ok: false, error: "That tile is already open", status: 400 };
  if (res?.status !== "applied" && res?.status !== "settled") {
    return { ok: false, error: "That move was refused", status: 400 };
  }

  const round = await loadRound(opts.userId, opts.roundId);
  if (!round) return { ok: false, error: "No open round", status: 404 };

  if (res.status === "applied" && round.status !== "active") {
    void recordEvent({
      userId: opts.userId,
      kind: "bet",
      req: opts.req,
      detail: {
        game: "mines",
        action: round.status === "busted" ? "bust" : "clear",
        stake: round.stake,
        payout: round.payout,
        multiplier: round.multiplier,
      },
    });
  }

  return roundOutcome(round, opts.econ, asNumber(res.balance));
}

export async function cashoutMines(opts: {
  userId: string;
  roundId: number;
  req?: Request;
  econ: CasinoEcon;
}): Promise<MinesOutcome> {
  const { data, error } = await createAdminSupabase().rpc("settle_mines_cashout", {
    p_round_id: opts.roundId,
    p_user: opts.userId,
    p_edge: opts.econ.edgeBoost,
    p_max_win: opts.econ.maxWin,
  });
  if (error) return { ok: false, error: error.message, status: 500 };

  const res = firstRow<{ status?: string; round_status?: string; balance?: unknown }>(data);
  if (res?.status === "missing") return { ok: false, error: "No open round", status: 404 };
  if (res?.status === "no_reveals") {
    return { ok: false, error: "Reveal at least one tile first", status: 400 };
  }
  if (res?.status !== "applied" && res?.status !== "settled") {
    return { ok: false, error: "That move was refused", status: 400 };
  }
  if (res.status === "settled" && res.round_status !== "cashed") {
    return { ok: false, error: "This round is already over", status: 409 };
  }

  const round = await loadRound(opts.userId, opts.roundId);
  if (!round) return { ok: false, error: "No open round", status: 404 };

  if (res.status === "applied") {
    void recordEvent({
      userId: opts.userId,
      kind: "bet",
      req: opts.req,
      detail: {
        game: "mines",
        action: "cashout",
        stake: round.stake,
        payout: round.payout,
        multiplier: round.multiplier,
      },
    });
  }

  return roundOutcome(round, opts.econ, asNumber(res.balance));
}
