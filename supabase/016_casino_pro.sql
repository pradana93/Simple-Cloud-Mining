-- 016_casino_pro.sql
-- Advanced operator controls for the casino. Everything here shapes the payout
-- economics only: outcomes still come from the committed seed, so a member can
-- re-derive any round. These columns stay server-side; games_disabled (015) is
-- the only casino control exposed to the browser.

alter table public.settings
  add column if not exists games_config jsonb not null default '{}'::jsonb,
  add column if not exists games_tiers jsonb not null default '[]'::jsonb,
  add column if not exists games_schedule jsonb not null default
    '{"enabled":false,"startHour":0,"endHour":0,"edgeDelta":0}'::jsonb;

-- Aggregate reporting for the operator panel. Counts instant bets and mines
-- rounds together, over an arbitrary window.
create or replace function public.game_stats(p_since timestamptz)
returns table (bet_count bigint, total_wager numeric, total_payout numeric)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.game_bets where created_at >= p_since)
      + (select count(*) from public.game_rounds where created_at >= p_since),
    coalesce((select sum(stake) from public.game_bets where created_at >= p_since), 0)
      + coalesce((select sum(stake) from public.game_rounds where created_at >= p_since), 0),
    coalesce((select sum(payout) from public.game_bets where created_at >= p_since), 0)
      + coalesce((select sum(payout) from public.game_rounds where created_at >= p_since), 0);
$$;

revoke all on function public.game_stats(timestamptz) from public;
revoke all on function public.game_stats(timestamptz) from anon, authenticated;
grant execute on function public.game_stats(timestamptz) to service_role;

-- Lifetime wager for tier assignment. Service role only.
create or replace function public.game_wager_total(p_user uuid)
returns numeric
language sql
security definer
set search_path = public
as $$
  select coalesce((select sum(stake) from public.game_bets where user_id = p_user), 0)
       + coalesce((select sum(stake) from public.game_rounds where user_id = p_user), 0);
$$;

revoke all on function public.game_wager_total(uuid) from public;
revoke all on function public.game_wager_total(uuid) from anon, authenticated;
grant execute on function public.game_wager_total(uuid) to service_role;
