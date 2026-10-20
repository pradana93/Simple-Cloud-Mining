-- 018_crash.sql
-- Live crash rounds. A round is one member, one stake, one hidden crash point.
-- The multiplier is a function of the server start time, so the client can draw
-- the line but only the server can settle a cashout. All additive.

create table if not exists public.crash_rounds (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stake numeric(20,8) not null check (stake > 0),
  crash_at numeric(20,8) not null check (crash_at >= 1),
  status text not null default 'active' check (status in ('active', 'cashed', 'crashed')),
  cashout numeric(20,8),
  payout numeric(20,8) not null default 0,
  server_seed_hash text not null,
  client_seed text not null,
  nonce bigint not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_crash_rounds_user on public.crash_rounds(user_id, created_at desc);

-- One live round per member. The guarded insert in the route also catches this,
-- but the index makes the rule true at the database level.
create unique index if not exists idx_crash_rounds_one_active
  on public.crash_rounds(user_id)
  where status = 'active';

alter table public.crash_rounds enable row level security;

drop policy if exists "read own crash rounds" on public.crash_rounds;
create policy "read own crash rounds" on public.crash_rounds
  for select using (auth.uid() = user_id);

grant select on public.crash_rounds to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.crash_rounds from anon, authenticated;

-- Settle once. The conditional update makes a retried cashout idempotent: the
-- second call sees no active row and returns settled = false, so the balance is
-- credited exactly once.
create or replace function public.settle_crash_round(
  p_id bigint,
  p_user uuid,
  p_status text,
  p_cashout numeric,
  p_payout numeric
)
returns table (settled boolean, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_balance numeric;
begin
  if p_status not in ('cashed', 'crashed') then
    raise exception 'invalid crash status';
  end if;
  if p_payout is null or p_payout < 0 then
    raise exception 'invalid payout';
  end if;

  update public.crash_rounds
     set status = p_status,
         cashout = p_cashout,
         payout = p_payout,
         ended_at = now()
   where id = p_id
     and user_id = p_user
     and status = 'active';
  get diagnostics v_count = row_count;

  if v_count = 0 then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  if p_payout > 0 then
    perform public.credit_balance(p_user, p_payout);
  end if;

  select p.balance into v_balance from public.profiles p where p.id = p_user;
  return query select true, coalesce(v_balance, 0);
end;
$$;

revoke all on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) from public;
revoke all on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) from anon, authenticated;
grant execute on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) to service_role;
