-- 017_game_profit.sql
-- Per-game reporting for the operator panel. Instant bets and mines rounds are
-- merged so each game shows one row of rounds, wagers, and payouts. Service
-- role only: the numbers never reach the browser.

create or replace function public.game_stats_by_game(p_since timestamptz)
returns table (game text, bet_count bigint, total_wager numeric, total_payout numeric)
language sql
security definer
set search_path = public
as $$
  with all_bets as (
    select game, stake, payout from public.game_bets where created_at >= p_since
    union all
    select game, stake, payout from public.game_rounds where created_at >= p_since
  )
  select
    game,
    count(*),
    coalesce(sum(stake), 0),
    coalesce(sum(payout), 0)
  from all_bets
  group by game;
$$;

revoke all on function public.game_stats_by_game(timestamptz) from public;
revoke all on function public.game_stats_by_game(timestamptz) from anon, authenticated;
grant execute on function public.game_stats_by_game(timestamptz) to service_role;
