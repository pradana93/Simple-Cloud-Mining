-- 021_money_hardening.sql
-- Close the remaining money-path review findings without changing the public
-- API: paginate accrual, key admin grants, and write the crash verifier row in
-- the same transaction as the payout.

alter table public.user_plan_history
  add column if not exists idempotency_key text;

create unique index if not exists idx_user_plan_history_idempotency
  on public.user_plan_history(idempotency_key)
  where idempotency_key is not null;

-- Walk every active plan in id order. The old single query stopped at the first
-- 1000 rows, so plans past that point never accrued.
create or replace function public.run_accrual(p_now timestamptz default now())
returns table (scanned int, credited int, expired int, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  a record;
  v_scanned int := 0;
  v_credited int := 0;
  v_expired int := 0;
  v_total numeric := 0;
  v_last_id bigint := 0;
  v_batch int;
begin
  loop
    v_batch := 0;

    for r in
      select id
        from public.user_plan_history
       where status = 'active'
         and id > v_last_id
       order by id
       limit 1000
    loop
      v_batch := v_batch + 1;
      v_last_id := r.id;
      v_scanned := v_scanned + 1;

      select * into a from public.accrue_plan(r.id, p_now);
      if a.status = 'credited' then
        v_credited := v_credited + 1;
        v_total := v_total + a.credited;
      elsif a.status = 'expired' then
        v_expired := v_expired + 1;
      end if;
    end loop;

    exit when v_batch < 1000;
  end loop;

  return query select v_scanned, v_credited, v_expired, v_total;
end;
$$;

revoke all on function public.run_accrual(timestamptz) from public;
revoke all on function public.run_accrual(timestamptz) from anon, authenticated;
grant execute on function public.run_accrual(timestamptz) to service_role;

-- The settlement update, balance credit, and verifier row now commit together.
-- If the game_bets insert fails, the round and payout roll back instead of
-- leaving a settled round with no verifiable history row.
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
  v_stake numeric;
  v_crash_at numeric;
  v_seed_hash text;
  v_client_seed text;
  v_nonce bigint;
  v_multiplier numeric := 0;
  r record;
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
     and status = 'active'
  returning stake, crash_at, server_seed_hash, client_seed, nonce
       into v_stake, v_crash_at, v_seed_hash, v_client_seed, v_nonce;
  get diagnostics v_count = row_count;

  if v_count = 0 then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select false, coalesce(v_balance, 0);
    return;
  end if;

  if p_payout > 0 then
    select * into r from public.post_balance(
      p_user,
      p_payout,
      'crash_payout',
      'crash_round',
      p_id::text,
      'crash:payout:' || p_id::text,
      jsonb_build_object('status', p_status, 'cashout', p_cashout, 'payout', p_payout)
    );
    if r.status <> 'applied' then
      raise exception 'crash payout credit failed: %', r.status;
    end if;
    v_balance := r.balance;
  else
    select p.balance into v_balance from public.profiles p where p.id = p_user;
  end if;

  v_multiplier := case when coalesce(v_stake, 0) > 0 then p_payout / v_stake else 0 end;

  insert into public.game_bets (
    user_id, game, stake, multiplier, payout, won, params, result,
    server_seed_hash, client_seed, nonce, idempotency_key
  ) values (
    p_user,
    'crash',
    v_stake,
    v_multiplier,
    p_payout,
    p_payout > 0,
    jsonb_build_object('cashout', p_cashout),
    jsonb_build_object('crashAt', v_crash_at, 'cashout', p_cashout, 'status', p_status),
    v_seed_hash,
    v_client_seed,
    v_nonce,
    p_user::text || ':crash:bet:' || p_id::text
  )
  on conflict do nothing;

  return query select true, coalesce(v_balance, 0);
end;
$$;

revoke all on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) from public;
revoke all on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) from anon, authenticated;
grant execute on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) to service_role;
