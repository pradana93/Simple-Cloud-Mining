-- 014_games.sql
-- Provably fair casino layer. Balance moves through the same service-role
-- credit/debit functions the rest of the app uses, so every bet is settled by
-- the server only. All additive.

alter table public.settings
  add column if not exists games_enabled boolean not null default false,
  add column if not exists games_min_bet numeric(20,8) not null default 0,
  add column if not exists games_max_bet numeric(20,8) not null default 0;

grant select (games_enabled, games_min_bet, games_max_bet) on public.settings to anon, authenticated;

-- One seed pair per member. server_seed is the secret the house keeps until the
-- member rotates; server_seed_hash is the commitment shown up front. Nothing in
-- this table is readable with the anon or authenticated key.
create table if not exists public.game_seeds (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  server_seed text not null,
  server_seed_hash text not null,
  client_seed text not null default 'client',
  nonce bigint not null default 0,
  prev_server_seed text,
  prev_server_seed_hash text,
  rotated_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.game_seeds enable row level security;
revoke all on public.game_seeds from anon, authenticated;

-- Every settled instant bet, with the exact inputs needed to re-derive it.
create table if not exists public.game_bets (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  stake numeric(20,8) not null,
  multiplier numeric(20,8) not null default 0,
  payout numeric(20,8) not null default 0,
  won boolean not null default false,
  params jsonb,
  result jsonb,
  server_seed_hash text not null,
  client_seed text not null,
  nonce bigint not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_game_bets_user on public.game_bets(user_id, created_at desc);
alter table public.game_bets enable row level security;
drop policy if exists "read own bets" on public.game_bets;
create policy "read own bets" on public.game_bets for select using (auth.uid() = user_id);
grant select on public.game_bets to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.game_bets from anon, authenticated;

-- Interactive rounds (mines). The layout is fixed at start from the seed, so the
-- member can verify it after rotating their server seed.
create table if not exists public.game_rounds (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null default 'mines',
  stake numeric(20,8) not null,
  mine_count int not null,
  mines jsonb not null,
  revealed jsonb not null default '[]'::jsonb,
  multiplier numeric(20,8) not null default 1,
  payout numeric(20,8) not null default 0,
  status text not null default 'active' check (status in ('active', 'busted', 'cashed')),
  server_seed_hash text not null,
  client_seed text not null,
  nonce bigint not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists idx_game_rounds_user on public.game_rounds(user_id, status);
alter table public.game_rounds enable row level security;
drop policy if exists "read own rounds" on public.game_rounds;
create policy "read own rounds" on public.game_rounds for select using (auth.uid() = user_id);
grant select on public.game_rounds to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.game_rounds from anon, authenticated;

-- Atomic counter so two concurrent bets can never reuse one nonce.
create or replace function public.next_game_nonce(p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v bigint;
begin
  update public.game_seeds
     set nonce = nonce + 1, updated_at = now()
   where user_id = p_user_id
  returning nonce into v;
  return coalesce(v, 0);
end;
$$;

revoke all on function public.next_game_nonce(uuid) from public;
revoke all on function public.next_game_nonce(uuid) from anon, authenticated;
grant execute on function public.next_game_nonce(uuid) to service_role;
