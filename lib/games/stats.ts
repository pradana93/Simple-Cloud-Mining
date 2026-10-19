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
