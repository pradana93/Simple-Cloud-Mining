import { createAdminSupabase } from "../supabase/admin";

// Aggregate casino performance for the operator panel. Counts instant bets and
// mines rounds together over a window. Hold is the house share of wagers.

export type CasinoStat = {
  bets: number;
  wagers: number;
  payouts: number;
  hold: number;
  rtp: number;
};

export type GameProfit = {
  game: string;
  bets: number;
  wagers: number;
  payouts: number;
  profit: number;
  hold: number;
};

export async function casinoStatsByGame(since: Date): Promise<GameProfit[]> {
  try {
    const { data } = await createAdminSupabase().rpc("game_stats_by_game", {
      p_since: since.toISOString(),
    });
    const rows = Array.isArray(data) ? data : [];
    const out: GameProfit[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as Record<string, unknown>;
      const wagers = Number(r.total_wager ?? 0) || 0;
      const payouts = Number(r.total_payout ?? 0) || 0;
      const profit = wagers - payouts;
      out.push({
        game: String(r.game ?? ""),
        bets: Number(r.bet_count ?? 0) || 0,
        wagers,
        payouts,
        profit,
        hold: wagers > 0 ? profit / wagers : 0,
      });
    }
    out.sort((a, b) => b.profit - a.profit);
    return out;
  } catch {
    return [];
  }
}

export async function casinoStats(since: Date): Promise<CasinoStat> {
  try {
    const { data } = await createAdminSupabase().rpc("game_stats", { p_since: since.toISOString() });
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    const bets = Number(row?.bet_count ?? 0) || 0;
    const wagers = Number(row?.total_wager ?? 0) || 0;
    const payouts = Number(row?.total_payout ?? 0) || 0;
    return {
      bets,
      wagers,
      payouts,
      hold: wagers > 0 ? (wagers - payouts) / wagers : 0,
      rtp: wagers > 0 ? payouts / wagers : 0,
    };
  } catch {
    return { bets: 0, wagers: 0, payouts: 0, hold: 0, rtp: 0 };
  }
}
