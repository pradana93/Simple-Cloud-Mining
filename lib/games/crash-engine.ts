import { createAdminSupabase } from "../supabase/admin";
import { recordEvent } from "../risk-telemetry";
import { floatStream } from "./rng";
import { ensureSeedRow, type SeedView } from "./engine";
import { applyPayout, type CasinoEcon } from "./econ";
import { CRASH_MAX_SECONDS, crashMultiplierAt, crashPoint } from "./crash";
import { toLedger } from "./util";
import { firstRow, idempotencyKey } from "../ledger";
import { sendAlert } from "../alerts";

// Server-only crash rounds. The line is a function of the recorded start time,
// so the client can draw it but cannot decide when it stops. A cashout is
// settled against the server clock, and the hidden crash point is only revealed
// after the round is over.

export type CrashStatus = "active" | "cashed" | "crashed";

export type CrashRoundRow = {
  id: number;
  user_id: string;
  stake: number | string;
  crash_at: number | string;
  status: CrashStatus;
  cashout: number | string | null;
  payout: number | string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number | string;
  started_at: string;
  ended_at: string | null;
};

export type CrashView = {
  roundId: number;
  status: CrashStatus;
  startedAt: string;
  stake: number;
  live: number;
  crashAt: number | null;
  cashout: number | null;
  payout: number;
};

const MAX_MS = CRASH_MAX_SECONDS * 1000;

function n(v: unknown, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function elapsedOf(row: CrashRoundRow, now = Date.now()): number {
  const start = Date.parse(row.started_at);
  return Number.isFinite(start) ? Math.max(0, now - start) : 0;
}

function liveOf(row: CrashRoundRow, now = Date.now()): number {
  return crashMultiplierAt(elapsedOf(row, now));
}

function isDue(row: CrashRoundRow, now = Date.now()): boolean {
  return elapsedOf(row, now) >= MAX_MS || liveOf(row, now) >= n(row.crash_at);
}

export function crashView(row: CrashRoundRow, now = Date.now()): CrashView {
  const done = row.status !== "active";
  const live = done
    ? row.status === "crashed"
      ? n(row.crash_at)
      : n(row.cashout, n(row.crash_at))
    : liveOf(row, now);
  return {
    roundId: n(row.id),
    status: row.status,
    startedAt: row.started_at,
    stake: n(row.stake),
    live,
    crashAt: done ? n(row.crash_at) : null,
    cashout: row.cashout == null ? null : n(row.cashout),
    payout: n(row.payout),
  };
}

async function balanceOf(userId: string): Promise<number> {
  const { data } = await createAdminSupabase()
    .from("profiles")
    .select("balance")
    .eq("id", userId)
    .maybeSingle();
  return n((data as { balance?: unknown } | null)?.balance);
}

async function loadRound(userId: string, roundId: number): Promise<CrashRoundRow | null> {
  const { data } = await createAdminSupabase()
    .from("crash_rounds")
    .select("*")
    .eq("id", roundId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as CrashRoundRow | null) ?? null;
}

async function loadActive(userId: string): Promise<CrashRoundRow | null> {
  const { data } = await createAdminSupabase()
    .from("crash_rounds")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as CrashRoundRow | null) ?? null;
}

async function loadLatest(userId: string): Promise<CrashRoundRow | null> {
  const { data } = await createAdminSupabase()
    .from("crash_rounds")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as CrashRoundRow | null) ?? null;
}

async function recordSettled(row: CrashRoundRow, status: "cashed" | "crashed", cashout: number | null, paid: number) {
  const admin = createAdminSupabase();
  const stake = n(row.stake);
  const multiplier = paid > 0 && stake > 0 ? paid / stake : 0;
  const { error } = await admin.from("game_bets").insert({
    user_id: row.user_id,
    game: "crash",
    stake,
    multiplier,
    payout: paid,
    won: paid > 0,
    params: { cashout },
    result: { crashAt: n(row.crash_at), cashout, status },
    server_seed_hash: row.server_seed_hash,
    client_seed: row.client_seed,
    nonce: n(row.nonce),
    idempotency_key: idempotencyKey(row.user_id, "crash:bet", String(row.id)),
  });
  if (error && error.code !== "23505") {
    await sendAlert({
      title: "Crash verifier record was not written",
      message: error.message,
      tags: { flow: "crash", round: String(row.id) },
      extra: { userId: row.user_id, status, paid },
    });
  }
  void recordEvent({
    userId: row.user_id,
    kind: "bet",
    detail: { game: "crash", stake, payout: paid, multiplier, status },
  });
}

export type SettleResult = { settled: boolean; balance: number };

async function settleAsCrash(row: CrashRoundRow): Promise<SettleResult> {
  const { data, error } = await createAdminSupabase().rpc("settle_crash_round", {
    p_id: row.id,
    p_user: row.user_id,
    p_status: "crashed",
    p_cashout: null,
    p_payout: 0,
  });
  if (error) throw new Error(error.message);
  const res = firstRow(data);
  const balance = n(res?.balance);
  if (res?.settled) await recordSettled(row, "crashed", null, 0);
  return { settled: Boolean(res?.settled), balance };
}

// Settles a round that has run past its crash point or past the clock cap.
async function advance(row: CrashRoundRow): Promise<{ row: CrashRoundRow; balance: number | null }> {
  if (row.status !== "active" || !isDue(row)) return { row, balance: null };
  const res = await settleAsCrash(row);
  if (!res.settled) {
    const current = (await loadRound(row.user_id, row.id)) ?? row;
    return { row: current, balance: res.balance };
  }
  return {
    row: { ...row, status: "crashed", payout: 0, cashout: null, ended_at: new Date().toISOString() },
    balance: res.balance,
  };
}

export type StartOutcome =
  | { ok: true; round: CrashView; balance: number; seed: SeedView }
  | { ok: false; error: string; status: number; round?: CrashView; balance?: number };

export async function startCrash(opts: {
  userId: string;
  stake: number;
  idempotencyKey?: string;
}): Promise<StartOutcome> {
  const admin = createAdminSupabase();
  const stake = toLedger(opts.stake);
  if (!(stake > 0)) return { ok: false, error: "Enter a stake above zero", status: 400 };
  const key = idempotencyKey(opts.userId, "crash:start", opts.idempotencyKey);

  const { data: existing } = await admin
    .from("crash_rounds")
    .select("*")
    .eq("idempotency_key", key)
    .eq("user_id", opts.userId)
    .maybeSingle();
  if (existing) {
    const row = existing as CrashRoundRow;
    if (row.status !== "active") {
      return {
        ok: false,
        error: "That round is already over",
        status: 409,
        round: crashView(row),
        balance: await balanceOf(opts.userId),
      };
    }
    return {
      ok: true,
      round: crashView(row),
      balance: await balanceOf(opts.userId),
      seed: {
        serverSeedHash: row.server_seed_hash,
        clientSeed: row.client_seed,
        nonce: n(row.nonce),
        previous: null,
      },
    };
  }

  const active = await loadActive(opts.userId);
  if (active) {
    const now = Date.now();
    if (isDue(active, now)) {
      await settleAsCrash(active);
    } else {
      return {
        ok: false,
        error: "Finish your live round first",
        status: 409,
        round: crashView(active, now),
        balance: await balanceOf(opts.userId),
      };
    }
  }

  const seed = await ensureSeedRow(opts.userId);
  const { data: nonceData, error: nonceError } = await admin.rpc("next_game_nonce", {
    p_user_id: opts.userId,
  });
  if (nonceError) return { ok: false, error: nonceError.message, status: 500 };
  const nonce = n(nonceData);

  const floats = floatStream(seed.server_seed, seed.client_seed, nonce, 1);
  const crashAt = crashPoint(floats[0] ?? 0);

  const { data, error } = await admin.rpc("start_crash_round", {
    p_user: opts.userId,
    p_stake: stake,
    p_crash_at: crashAt,
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
    const live = res.round_id == null ? await loadActive(opts.userId) : await loadRound(opts.userId, n(res.round_id));
    return {
      ok: false,
      error: "A round is already live",
      status: 409,
      round: live ? crashView(live) : undefined,
      balance: await balanceOf(opts.userId),
    };
  }
  if (res?.status !== "applied" && res?.status !== "duplicate") {
    return { ok: false, error: "Could not start the round", status: 500 };
  }

  const row = res.round_id == null ? null : await loadRound(opts.userId, n(res.round_id));
  if (!row) return { ok: false, error: "Could not start the round", status: 500 };
  if (row.status !== "active") {
    return {
      ok: false,
      error: "That round is already over",
      status: 409,
      round: crashView(row),
      balance: n(res.balance),
    };
  }

  return {
    ok: true,
    round: { ...crashView(row), live: 1, crashAt: null },
    balance: n(res.balance),
    seed: {
      serverSeedHash: row.server_seed_hash,
      clientSeed: row.client_seed,
      nonce: n(row.nonce),
      previous: null,
    },
  };
}

export type CashOutOutcome =
  | { ok: true; round: CrashView; balance: number; paid: number; multiplier: number }
  | { ok: false; error: string; status: number };

export async function cashOutCrash(opts: {
  userId: string;
  roundId: number;
  econ: CasinoEcon;
}): Promise<CashOutOutcome> {
  const row = await loadRound(opts.userId, opts.roundId);
  if (!row) return { ok: false, error: "Round not found", status: 404 };

  if (row.status !== "active") {
    return {
      ok: true,
      round: crashView(row),
      balance: await balanceOf(opts.userId),
      paid: n(row.payout),
      multiplier: n(row.stake) > 0 ? n(row.payout) / n(row.stake) : 0,
    };
  }

  const now = Date.now();
  if (isDue(row, now)) {
    const res = await settleAsCrash(row);
    if (res.settled) {
      return {
        ok: true,
        round: crashView({ ...row, status: "crashed", payout: 0, cashout: null }, now),
        balance: res.balance,
        paid: 0,
        multiplier: 0,
      };
    }
    const current = (await loadRound(opts.userId, opts.roundId)) ?? row;
    return {
      ok: true,
      round: crashView(current, now),
      balance: res.balance,
      paid: n(current.payout),
      multiplier: n(current.stake) > 0 ? n(current.payout) / n(current.stake) : 0,
    };
  }

  const live = liveOf(row, now);
  const paid = applyPayout(opts.econ, n(row.stake), live);

  const { data, error } = await createAdminSupabase().rpc("settle_crash_round", {
    p_id: row.id,
    p_user: row.user_id,
    p_status: "cashed",
    p_cashout: live,
    p_payout: paid.payout,
  });
  if (error) return { ok: false, error: error.message, status: 500 };

  const res = firstRow(data);
  if (!res?.settled) {
    const current = (await loadRound(opts.userId, opts.roundId)) ?? row;
    return {
      ok: true,
      round: crashView(current),
      balance: await balanceOf(opts.userId),
      paid: n(current.payout),
      multiplier: n(current.stake) > 0 ? n(current.payout) / n(current.stake) : 0,
    };
  }

  await recordSettled(row, "cashed", live, paid.payout);
  return {
    ok: true,
    round: crashView({ ...row, status: "cashed", cashout: live, payout: paid.payout }, now),
    balance: n(res.balance),
    paid: paid.payout,
    multiplier: paid.multiplier,
  };
}

export async function crashStatus(userId: string, roundId: number): Promise<CashOutOutcome> {
  const row = await loadRound(userId, roundId);
  if (!row) return { ok: false, error: "Round not found", status: 404 };
  if (row.status !== "active") {
    return {
      ok: true,
      round: crashView(row),
      balance: await balanceOf(userId),
      paid: n(row.payout),
      multiplier: n(row.stake) > 0 ? n(row.payout) / n(row.stake) : 0,
    };
  }
  const now = Date.now();
  const next = await advance(row);
  return {
    ok: true,
    round: crashView(next.row, now),
    balance: next.balance == null ? await balanceOf(userId) : next.balance,
    paid: n(next.row.payout),
    multiplier: n(next.row.stake) > 0 ? n(next.row.payout) / n(next.row.stake) : 0,
  };
}

export type CrashState =
  | { active: true; round: CrashView; balance: number }
  | { active: false; last: CrashView | null; balance: number };

export async function crashState(userId: string): Promise<CrashState> {
  const balance = await balanceOf(userId);
  const active = await loadActive(userId);
  if (active) {
    const now = Date.now();
    const next = await advance(active);
    if (next.row.status === "active") {
      return { active: true, round: crashView(active, now), balance };
    }
    return { active: false, last: crashView(next.row, now), balance: next.balance == null ? balance : next.balance };
  }
  const latest = await loadLatest(userId);
  return { active: false, last: latest ? crashView(latest) : null, balance };
}
