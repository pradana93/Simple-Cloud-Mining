import { NextResponse } from "next/server";
import { requirePlayer } from "@/lib/games/api-guard";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { VerifiableBet } from "@/lib/games/verify";

type BetRow = {
  id: number;
  game: string;
  stake: number | string;
  multiplier: number | string;
  payout: number | string;
  won: boolean;
  nonce: number | string;
  server_seed_hash: string;
  client_seed: string;
  created_at: string;
  params: unknown;
  result: unknown;
};

type RoundRow = {
  id: number;
  game: string;
  stake: number | string;
  multiplier: number | string;
  payout: number | string;
  status: string;
  mine_count: number;
  mines: unknown;
  revealed: unknown;
  nonce: number | string;
  server_seed_hash: string;
  client_seed: string;
  created_at: string;
};

function n(value: unknown): number {
  const x = Number(value);
  return Number.isFinite(x) ? x : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNumbers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (let i = 0; i < value.length; i++) {
    const x = Math.trunc(Number(value[i]));
    if (Number.isInteger(x)) out.push(x);
  }
  return out;
}

function mapBet(row: BetRow): VerifiableBet {
  return {
    key: `bet:${row.id}`,
    source: "bet",
    game: String(row.game),
    createdAt: String(row.created_at),
    nonce: n(row.nonce),
    stake: n(row.stake),
    multiplier: n(row.multiplier),
    payout: n(row.payout),
    won: Boolean(row.won),
    serverSeedHash: String(row.server_seed_hash),
    clientSeed: String(row.client_seed),
    params: asRecord(row.params),
    result: asRecord(row.result),
    revealedServerSeed: null,
  };
}

function mapRound(row: RoundRow): VerifiableBet {
  const status = String(row.status);
  const mineCount = Math.trunc(n(row.mine_count));
  return {
    key: `mines:${row.id}`,
    source: "round",
    game: "mines",
    createdAt: String(row.created_at),
    nonce: n(row.nonce),
    stake: n(row.stake),
    multiplier: n(row.multiplier),
    payout: n(row.payout),
    won: status === "cashed",
    serverSeedHash: String(row.server_seed_hash),
    clientSeed: String(row.client_seed),
    params: { mines: mineCount },
    result: {
      mineCount,
      mines: asNumbers(row.mines),
      revealed: asNumbers(row.revealed),
      status,
    },
    revealedServerSeed: null,
  };
}

export async function GET() {
  const gate = await requirePlayer({ allowClosed: true });
  if ("error" in gate) return gate.error;

  const admin = createAdminSupabase();
  const [betsRes, roundsRes] = await Promise.all([
    admin
      .from("game_bets")
      .select("id,game,stake,multiplier,payout,won,nonce,server_seed_hash,client_seed,created_at,params,result")
      .eq("user_id", gate.player.id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("game_rounds")
      .select("id,game,stake,multiplier,payout,status,mine_count,mines,revealed,nonce,server_seed_hash,client_seed,created_at")
      .eq("user_id", gate.player.id)
      .eq("game", "mines")
      .in("status", ["busted", "cashed"])
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  if (betsRes.error) {
    return NextResponse.json({ ok: false, error: betsRes.error.message }, { status: 500 });
  }
  if (roundsRes.error) {
    return NextResponse.json({ ok: false, error: roundsRes.error.message }, { status: 500 });
  }

  const rows: VerifiableBet[] = [];
  const betRows = (betsRes.data ?? []) as BetRow[];
  const roundRows = (roundsRes.data ?? []) as RoundRow[];
  for (let i = 0; i < betRows.length; i++) rows.push(mapBet(betRows[i]));
  for (let i = 0; i < roundRows.length; i++) rows.push(mapRound(roundRows[i]));
  rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const hashes: string[] = [];
  const seen: Record<string, boolean> = {};
  for (let i = 0; i < rows.length; i++) {
    const hash = rows[i].serverSeedHash;
    if (hash && !seen[hash]) {
      seen[hash] = true;
      hashes.push(hash);
    }
  }

  const revealed: Record<string, string> = {};
  if (hashes.length > 0) {
    const { data } = await admin
      .from("game_seed_reveals")
      .select("server_seed,server_seed_hash")
      .eq("user_id", gate.player.id)
      .in("server_seed_hash", hashes);
    const seedRows = (data ?? []) as Array<{ server_seed: string; server_seed_hash: string }>;
    for (let i = 0; i < seedRows.length; i++) {
      revealed[seedRows[i].server_seed_hash] = seedRows[i].server_seed;
    }
  }

  for (let i = 0; i < rows.length; i++) {
    rows[i].revealedServerSeed = revealed[rows[i].serverSeedHash] ?? null;
  }

  return NextResponse.json({ ok: true, bets: rows });
}
