-- 015_casino_control.sql
-- Operator controls for the casino. These adjust profit without touching the
-- outcome: the result still comes from the committed seed, and the raw
-- roll/pocket/draw is stored, so every round stays verifiable. Only
-- games_disabled is public (the lobby needs it to hide games); the edge and cap
-- stay server-side. All additive.

alter table public.settings
  add column if not exists games_edge_boost numeric(5,2) not null default 0,
  add column if not exists games_max_win numeric(20,8) not null default 0,
  add column if not exists games_disabled text not null default '';

-- Constrain the edge so it can never exceed the app's own ceiling.
alter table public.settings
  drop constraint if exists settings_games_edge_boost_check;
alter table public.settings
  add constraint settings_games_edge_boost_check check (games_edge_boost >= 0 and games_edge_boost <= 50);

grant select (games_disabled) on public.settings to anon, authenticated;
