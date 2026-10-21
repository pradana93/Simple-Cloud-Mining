-- 020_money_ledger.sql
-- Append-only balance ledger, idempotent money mutations, and the
-- reconciliation view used by the admin ledger page.
--
-- The ledger is the source of truth for balance movement. Every balance change
-- below writes one ledger row with a reason, a reference, and a unique
-- idempotency key. The unique key makes retries safe: a repeated call returns
-- the original result instead of moving money twice.
--
-- This migration is additive and does not bootstrap opening balances. Run
-- public.bootstrap_balance_ledger() once at deploy time, after this migration
-- and before the matching app release, so existing balances have a baseline.

create table if not exists public.balance_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta numeric(30,8) not null,
  balance_after numeric(30,8) not null,
  reason text not null,
  ref_type text,
  ref_id text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint balance_ledger_delta_nonzero check (delta <> 0)
);

create index if not exists idx_balance_ledger_user_time
  on public.balance_ledger(user_id, created_at desc);
create index if not exists idx_balance_ledger_reason_time
  on public.balance_ledger(reason, created_at desc);
create index if not exists idx_balance_ledger_ref
  on public.balance_ledger(ref_type, ref_id);

alter table public.balance_ledger enable row level security;
revoke all on public.balance_ledger from anon, authenticated;
grant select on public.balance_ledger to service_role;

create or replace function public.prevent_balance_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'balance_ledger is append-only';
end;
$$;

drop trigger if exists balance_ledger_append_only on public.balance_ledger;
create trigger balance_ledger_append_only
  before update or delete on public.balance_ledger
  for each row execute function public.prevent_balance_ledger_mutation();

alter table public.transactions_history
  add column if not exists idempotency_key text;
create unique index if not exists idx_transactions_idempotency
  on public.transactions_history(idempotency_key)
  where idempotency_key is not null;

alter table public.user_withdrawal
  add column if not exists idempotency_key text;
create unique index if not exists idx_withdrawal_idempotency
  on public.user_withdrawal(idempotency_key)
  where idempotency_key is not null;

alter table public.affiliate_history
  add column if not exists idempotency_key text;
create unique index if not exists idx_affiliate_history_idempotency
  on public.affiliate_history(idempotency_key)
  where idempotency_key is not null;

alter table public.game_bets
  add column if not exists idempotency_key text;
create unique index if not exists idx_game_bets_idempotency
  on public.game_bets(idempotency_key)
  where idempotency_key is not null;

alter table public.game_rounds
  add column if not exists idempotency_key text;
create unique index if not exists idx_game_rounds_idempotency
  on public.game_rounds(idempotency_key)
  where idempotency_key is not null;

alter table public.crash_rounds
  add column if not exists idempotency_key text;
create unique index if not exists idx_crash_rounds_idempotency
  on public.crash_rounds(idempotency_key)
  where idempotency_key is not null;

-- One active round per member. The pre-check handles the common case, and these
-- indexes close the concurrent-start race so two stakes cannot open two rounds.
create unique index if not exists idx_game_rounds_one_active
  on public.game_rounds(user_id)
  where status = 'active';
create unique index if not exists idx_crash_rounds_one_active
  on public.crash_rounds(user_id)
  where status = 'active';

-- Core balance mutation. A negative delta is a guarded debit, so two requests
-- can never spend the same funds. The advisory lock serializes the same
-- idempotency key without blocking unrelated users.
create or replace function public.post_balance(
  p_user uuid,
  p_delta numeric,
  p_reason text,
  p_ref_type text default null,
  p_ref_id text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (status text, balance numeric, ledger_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric := round(coalesce(p_delta, 0), 8);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_id bigint;
  v_balance numeric;
begin
  if p_user is null then
    raise exception 'post_balance requires a user';
  end if;
  if v_delta = 0 then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'unchanged'::text, coalesce(v_balance, 0), null::bigint;
    return;
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'post_balance requires a reason';
  end if;
  if v_key is null then
    v_key := 'auto:' || gen_random_uuid()::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select l.id, l.balance_after into v_id, v_balance
    from public.balance_ledger l
   where l.idempotency_key = v_key;
  if found then
    return query select 'duplicate'::text, v_balance, v_id;
    return;
  end if;

  if v_delta < 0 then
    update public.profiles
       set balance = public.profiles.balance + v_delta
     where id = p_user
       and public.profiles.balance >= -v_delta
    returning public.profiles.balance into v_balance;
  else
    update public.profiles
       set balance = public.profiles.balance + v_delta
     where id = p_user
    returning public.profiles.balance into v_balance;
  end if;

  if v_balance is null then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select
      (case when v_balance is null then 'missing_user' else 'insufficient' end)::text,
      coalesce(v_balance, 0),
      null::bigint;
    return;
  end if;

  insert into public.balance_ledger
    (user_id, delta, balance_after, reason, ref_type, ref_id, idempotency_key, metadata)
  values
    (p_user, v_delta, v_balance, btrim(p_reason), p_ref_type, p_ref_id, v_key, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return query select 'applied'::text, v_balance, v_id;
end;
$$;

revoke all on function public.post_balance(uuid, numeric, text, text, text, text, jsonb) from public;
revoke all on function public.post_balance(uuid, numeric, text, text, text, text, jsonb) from anon, authenticated;
grant execute on function public.post_balance(uuid, numeric, text, text, text, text, jsonb) to service_role;

-- Legacy wrappers remain for older call sites and the security probe. New code
-- should call post_balance with a real reason and reference.
create or replace function public.credit_balance(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_balance numeric;
begin
  if p_amount is null then
    return null;
  end if;
  if p_amount = 0 then
    select balance into v_balance from public.profiles where id = p_user_id;
    return v_balance;
  end if;
  select * into r from public.post_balance(
    p_user_id,
    p_amount,
    'legacy_credit',
    'legacy',
    null,
    'legacy:credit:' || gen_random_uuid()::text,
    '{}'::jsonb
  );
  if r.status = 'missing_user' then
    return null;
  end if;
  return r.balance;
end;
$$;

create or replace function public.debit_balance(p_user_id uuid, p_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if p_amount is null or p_amount <= 0 then
    return null;
  end if;
  select * into r from public.post_balance(
    p_user_id,
    -p_amount,
    'legacy_debit',
    'legacy',
    null,
    'legacy:debit:' || gen_random_uuid()::text,
    '{}'::jsonb
  );
  if r.status <> 'applied' then
    return null;
  end if;
  return r.balance;
end;
$$;

revoke all on function public.credit_balance(uuid, numeric) from public;
revoke all on function public.credit_balance(uuid, numeric) from anon, authenticated;
revoke all on function public.debit_balance(uuid, numeric) from public;
revoke all on function public.debit_balance(uuid, numeric) from anon, authenticated;
grant execute on function public.credit_balance(uuid, numeric) to service_role;
grant execute on function public.debit_balance(uuid, numeric) to service_role;

create or replace function public.set_balance(
  p_user uuid,
  p_target numeric,
  p_reason text,
  p_ref_type text default null,
  p_ref_id text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (status text, balance numeric, ledger_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target numeric := round(coalesce(p_target, 0), 8);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_delta numeric;
  v_balance numeric;
  v_id bigint;
begin
  if p_user is null then
    raise exception 'set_balance requires a user';
  end if;
  if v_target < 0 then
    raise exception 'balance cannot be negative';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'set_balance requires a reason';
  end if;
  if v_key is null then
    v_key := 'auto:' || gen_random_uuid()::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select l.id, l.balance_after into v_id, v_balance
    from public.balance_ledger l
   where l.idempotency_key = v_key;
  if found then
    return query select 'duplicate'::text, v_balance, v_id;
    return;
  end if;

  select p.balance into v_balance from public.profiles p where p.id = p_user for update;
  if not found then
    return query select 'missing_user'::text, 0::numeric, null::bigint;
    return;
  end if;

  v_delta := round(v_target - v_balance, 8);
  if v_delta = 0 then
    return query select 'unchanged'::text, v_balance, null::bigint;
    return;
  end if;

  update public.profiles set balance = v_target where id = p_user
  returning public.profiles.balance into v_balance;

  insert into public.balance_ledger
    (user_id, delta, balance_after, reason, ref_type, ref_id, idempotency_key, metadata)
  values
    (p_user, v_delta, v_balance, btrim(p_reason), p_ref_type, p_ref_id, v_key, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return query select 'applied'::text, v_balance, v_id;
end;
$$;

revoke all on function public.set_balance(uuid, numeric, text, text, text, text, jsonb) from public;
revoke all on function public.set_balance(uuid, numeric, text, text, text, text, jsonb) from anon, authenticated;
grant execute on function public.set_balance(uuid, numeric, text, text, text, text, jsonb) to service_role;

-- Affiliate commission moves both balance and affiliate_earns, so it gets its
-- own atomic function instead of two separate updates.
create or replace function public.post_affiliate_commission(
  p_user uuid,
  p_amount numeric,
  p_ref_type text default null,
  p_ref_id text default null,
  p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table (status text, balance numeric, ledger_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric := round(coalesce(p_amount, 0), 8);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_balance numeric;
  v_id bigint;
begin
  if p_user is null then
    raise exception 'post_affiliate_commission requires a user';
  end if;
  if v_key is null then
    v_key := 'auto:' || gen_random_uuid()::text;
  end if;
  if v_amount <= 0 then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'unchanged'::text, coalesce(v_balance, 0), null::bigint;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select l.id, l.balance_after into v_id, v_balance
    from public.balance_ledger l
   where l.idempotency_key = v_key;
  if found then
    return query select 'duplicate'::text, v_balance, v_id;
    return;
  end if;

  update public.profiles
     set balance = public.profiles.balance + v_amount,
         affiliate_earns = public.profiles.affiliate_earns + v_amount
   where id = p_user
  returning public.profiles.balance into v_balance;

  if v_balance is null then
    return query select 'missing_user'::text, 0::numeric, null::bigint;
    return;
  end if;

  insert into public.affiliate_history (user_id, amount, status, idempotency_key)
  values (p_user, v_amount, 'paid', v_key);

  insert into public.balance_ledger
    (user_id, delta, balance_after, reason, ref_type, ref_id, idempotency_key, metadata)
  values
    (p_user, v_amount, v_balance, 'affiliate_commission', p_ref_type, p_ref_id, v_key, coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;

  return query select 'applied'::text, v_balance, v_id;
end;
$$;

revoke all on function public.post_affiliate_commission(uuid, numeric, text, text, text, jsonb) from public;
revoke all on function public.post_affiliate_commission(uuid, numeric, text, text, text, jsonb) from anon, authenticated;
grant execute on function public.post_affiliate_commission(uuid, numeric, text, text, text, jsonb) to service_role;

-- Turn a verified crypto invoice into a deposit, an active rig, and the
-- upline commission in one transaction. The invoice status guard keeps a
-- duplicate IPN from activating the plan twice.
create or replace function public.activate_paid_invoice(
  p_tx_id bigint,
  p_txid text default null,
  p_paid numeric default null
)
returns table (status text, claimed boolean, invoice_user uuid, invoice_plan bigint, commission numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_plan bigint;
  v_amount numeric;
  v_status text;
  v_paid numeric;
  v_duration int;
  v_ref uuid;
  v_aff int;
  v_commission numeric := 0;
begin
  select t.user_id, t.plan_id, t.amount, t.status
    into v_user, v_plan, v_amount, v_status
    from public.transactions_history t
   where t.id = p_tx_id
   for update;

  if not found then
    return query select 'missing'::text, false, null::uuid, null::bigint, 0::numeric;
    return;
  end if;
  if v_status = 'paid' then
    return query select 'already_paid'::text, false, v_user, v_plan, 0::numeric;
    return;
  end if;

  v_paid := round(coalesce(p_paid, v_amount), 8);

  update public.transactions_history
     set status = 'paid',
         paid_amount = v_paid,
         txid = coalesce(p_txid, txid)
   where id = p_tx_id;

  insert into public.user_deposits (user_id, amount, tx, status, date_paid)
  values (v_user, v_paid, p_txid, 'SUCCESS', now());

  select p.duration into v_duration from public.plans p where p.id = v_plan;
  if found then
    insert into public.user_plan_history (user_id, plan_id, status, expire_date, last_sum)
    values (
      v_user,
      v_plan,
      'active',
      now() + make_interval(days => v_duration),
      now()
    );

    select p.reference_user_id into v_ref from public.profiles p where p.id = v_user;
    if v_ref is not null then
      select s.aff_comission into v_aff from public.settings s order by s.id limit 1;
      v_commission := round(v_paid * coalesce(v_aff, 0) / 100.0, 8);
      if v_commission > 0 then
        perform public.post_affiliate_commission(
          v_ref,
          v_commission,
          'transaction',
          p_tx_id::text,
          'ipn:affiliate:' || p_tx_id::text,
          jsonb_build_object('buyer', v_user, 'plan', v_plan, 'invoice', p_txid)
        );
      end if;
    end if;
  end if;

  return query select 'paid'::text, true, v_user, v_plan, v_commission;
end;
$$;

revoke all on function public.activate_paid_invoice(bigint, text, numeric) from public;
revoke all on function public.activate_paid_invoice(bigint, text, numeric) from anon, authenticated;
grant execute on function public.activate_paid_invoice(bigint, text, numeric) to service_role;

create or replace function public.claim_checkin(
  p_user uuid,
  p_day date,
  p_amount numeric,
  p_streak int
)
returns table (status text, amount numeric, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric := round(coalesce(p_amount, 0), 8);
  v_balance numeric;
  r record;
begin
  if p_user is null then
    raise exception 'claim_checkin requires a user';
  end if;
  if v_amount <= 0 then
    raise exception 'claim_checkin requires a positive amount';
  end if;

  begin
    insert into public.checkins (user_id, day, amount, streak)
    values (p_user, p_day, v_amount, greatest(coalesce(p_streak, 1), 1));
  exception when unique_violation then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'already_claimed'::text, 0::numeric, coalesce(v_balance, 0);
    return;
  end;

  select * into r from public.post_balance(
    p_user,
    v_amount,
    'checkin_bonus',
    'checkin',
    p_day::text,
    'checkin:' || p_user::text || ':' || p_day::text,
    jsonb_build_object('streak', greatest(coalesce(p_streak, 1), 1))
  );
  if r.status <> 'applied' then
    raise exception 'checkin credit failed: %', r.status;
  end if;

  return query select 'claimed'::text, v_amount, r.balance;
end;
$$;

revoke all on function public.claim_checkin(uuid, date, numeric, integer) from public;
revoke all on function public.claim_checkin(uuid, date, numeric, integer) from anon, authenticated;
grant execute on function public.claim_checkin(uuid, date, numeric, integer) to service_role;

-- Mining accrual is computed under a row lock. Updating last_sum and crediting
-- the balance in one transaction removes the old read-modify-write race.
create or replace function public.accrue_plan(
  p_plan_id bigint,
  p_now timestamptz default now()
)
returns table (status text, credited numeric, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_status text;
  v_last timestamptz;
  v_created timestamptz;
  v_expire timestamptz;
  v_rate numeric;
  v_seconds bigint;
  v_earnings numeric;
  v_balance numeric;
  r record;
begin
  select uph.user_id, uph.status, uph.last_sum, uph.created_at, uph.expire_date, p.earning_rate
    into v_user, v_status, v_last, v_created, v_expire, v_rate
    from public.user_plan_history uph
    join public.plans p on p.id = uph.plan_id
   where uph.id = p_plan_id
   for update of uph;

  if not found then
    return query select 'missing'::text, 0::numeric, null::numeric;
    return;
  end if;

  select p.balance into v_balance from public.profiles p where p.id = v_user;

  if v_status <> 'active' then
    return query select 'inactive'::text, 0::numeric, coalesce(v_balance, 0);
    return;
  end if;
  if v_expire is not null and v_expire <= p_now then
    update public.user_plan_history set status = 'inactive' where id = p_plan_id;
    return query select 'expired'::text, 0::numeric, coalesce(v_balance, 0);
    return;
  end if;

  v_last := coalesce(v_last, v_created);
  v_seconds := greatest(0, floor(extract(epoch from (p_now - v_last)))::bigint);
  if v_seconds = 0 then
    return query select 'noop'::text, 0::numeric, coalesce(v_balance, 0);
    return;
  end if;

  v_earnings := round(v_seconds * coalesce(v_rate, 0) / 60.0, 8);
  update public.user_plan_history set last_sum = p_now where id = p_plan_id;

  if v_earnings <= 0 then
    return query select 'noop'::text, 0::numeric, coalesce(v_balance, 0);
    return;
  end if;

  select * into r from public.post_balance(
    v_user,
    v_earnings,
    'mining_accrual',
    'user_plan_history',
    p_plan_id::text,
    'accrue:' || p_plan_id::text || ':' || floor(extract(epoch from p_now))::bigint,
    jsonb_build_object('seconds', v_seconds, 'rate', v_rate)
  );

  if r.status = 'duplicate' then
    return query select 'duplicate'::text, 0::numeric, r.balance;
    return;
  end if;
  if r.status <> 'applied' then
    raise exception 'mining accrual credit failed: %', r.status;
  end if;

  return query select 'credited'::text, v_earnings, r.balance;
end;
$$;

revoke all on function public.accrue_plan(bigint, timestamptz) from public;
revoke all on function public.accrue_plan(bigint, timestamptz) from anon, authenticated;
grant execute on function public.accrue_plan(bigint, timestamptz) to service_role;

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
begin
  for r in
    select id from public.user_plan_history where status = 'active' limit 1000
  loop
    v_scanned := v_scanned + 1;
    select * into a from public.accrue_plan(r.id, p_now);
    if a.status = 'credited' then
      v_credited := v_credited + 1;
      v_total := v_total + a.credited;
    elsif a.status = 'expired' then
      v_expired := v_expired + 1;
    end if;
  end loop;

  return query select v_scanned, v_credited, v_expired, v_total;
end;
$$;

revoke all on function public.run_accrual(timestamptz) from public;
revoke all on function public.run_accrual(timestamptz) from anon, authenticated;
grant execute on function public.run_accrual(timestamptz) to service_role;

-- Request a withdrawal and reserve the amount in one transaction. The row and
-- the debit either both exist or neither does.
create or replace function public.request_withdrawal(
  p_user uuid,
  p_amount numeric,
  p_address text,
  p_idempotency_key text
)
returns table (status text, withdrawal_id bigint, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount numeric := round(coalesce(p_amount, 0), 8);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_id bigint;
  v_balance numeric;
  r record;
begin
  if p_user is null then
    raise exception 'request_withdrawal requires a user';
  end if;
  if v_amount <= 0 then
    raise exception 'request_withdrawal requires a positive amount';
  end if;
  if p_address is null or btrim(p_address) = '' then
    raise exception 'request_withdrawal requires an address';
  end if;
  if v_key is null then
    v_key := 'withdraw:' || gen_random_uuid()::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select w.id into v_id from public.user_withdrawal w where w.idempotency_key = v_key;
  if found then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'duplicate'::text, v_id, coalesce(v_balance, 0);
    return;
  end if;

  begin
    insert into public.user_withdrawal (user_id, amount, address, status, idempotency_key)
    values (p_user, v_amount, btrim(p_address), 'PENDING', v_key)
    returning id into v_id;

    select * into r from public.post_balance(
      p_user,
      -v_amount,
      'withdrawal_reserve',
      'withdrawal',
      v_id::text,
      'withdraw:stake:' || v_id::text,
      jsonb_build_object('amount', v_amount)
    );

    if r.status <> 'applied' then
      raise exception using errcode = 'P0002', message = 'insufficient_balance';
    end if;

    return query select 'applied'::text, v_id, r.balance;
  exception
    when sqlstate 'P0002' then
      select p.balance into v_balance from public.profiles p where p.id = p_user;
      return query select 'insufficient'::text, null::bigint, coalesce(v_balance, 0);
    when unique_violation then
      select w.id into v_id from public.user_withdrawal w where w.idempotency_key = v_key;
      select p.balance into v_balance from public.profiles p where p.id = p_user;
      return query select 'duplicate'::text, v_id, coalesce(v_balance, 0);
  end;
end;
$$;

revoke all on function public.request_withdrawal(uuid, numeric, text, text) from public;
revoke all on function public.request_withdrawal(uuid, numeric, text, text) from anon, authenticated;
grant execute on function public.request_withdrawal(uuid, numeric, text, text) to service_role;

-- Instant bets. The result is derived in TypeScript from the committed seed, so
-- the database only records and settles it. The idempotency key covers the
-- whole bet, including the stake and the payout.
create or replace function public.settle_game_bet(
  p_user uuid,
  p_game text,
  p_stake numeric,
  p_multiplier numeric,
  p_payout numeric,
  p_won boolean,
  p_params jsonb,
  p_result jsonb,
  p_seed_hash text,
  p_client_seed text,
  p_nonce bigint,
  p_idempotency_key text
)
returns table (status text, bet_id bigint, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stake numeric := round(coalesce(p_stake, 0), 8);
  v_payout numeric := round(coalesce(p_payout, 0), 8);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_id bigint;
  v_balance numeric;
  r record;
begin
  if p_user is null or p_game is null or p_game = '' then
    raise exception 'settle_game_bet requires a user and game';
  end if;
  if v_stake <= 0 then
    raise exception 'settle_game_bet requires a positive stake';
  end if;
  if v_payout < 0 then
    raise exception 'settle_game_bet requires a non-negative payout';
  end if;
  if v_key is null then
    v_key := 'bet:' || gen_random_uuid()::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select b.id into v_id from public.game_bets b where b.idempotency_key = v_key;
  if found then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'duplicate'::text, v_id, coalesce(v_balance, 0);
    return;
  end if;

  select * into r from public.post_balance(
    p_user,
    -v_stake,
    'casino_stake',
    'game_bet',
    v_key,
    'bet:stake:' || v_key,
    jsonb_build_object('game', p_game, 'stake', v_stake)
  );
  if r.status <> 'applied' then
    return query select r.status, null::bigint, r.balance;
    return;
  end if;

  insert into public.game_bets (
    user_id, game, stake, multiplier, payout, won, params, result,
    server_seed_hash, client_seed, nonce, idempotency_key
  ) values (
    p_user, p_game, v_stake, coalesce(p_multiplier, 0), v_payout, coalesce(p_won, false),
    p_params, p_result, p_seed_hash, p_client_seed, p_nonce, v_key
  )
  returning id into v_id;

  if v_payout > 0 then
    select * into r from public.post_balance(
      p_user,
      v_payout,
      'casino_payout',
      'game_bet',
      v_id::text,
      'bet:payout:' || v_key,
      jsonb_build_object('game', p_game, 'stake', v_stake, 'payout', v_payout)
    );
    if r.status <> 'applied' then
      raise exception 'casino payout credit failed: %', r.status;
    end if;
    v_balance := r.balance;
  else
    select p.balance into v_balance from public.profiles p where p.id = p_user;
  end if;

  return query select 'applied'::text, v_id, coalesce(v_balance, 0);
end;
$$;

revoke all on function public.settle_game_bet(uuid, text, numeric, numeric, numeric, boolean, jsonb, jsonb, text, text, bigint, text) from public;
revoke all on function public.settle_game_bet(uuid, text, numeric, numeric, numeric, boolean, jsonb, jsonb, text, text, bigint, text) from anon, authenticated;
grant execute on function public.settle_game_bet(uuid, text, numeric, numeric, numeric, boolean, jsonb, jsonb, text, text, bigint, text) to service_role;

create or replace function public.mines_multiplier(p_mine_count int, p_revealed int)
returns numeric
language plpgsql
immutable
as $$
declare
  v numeric := 1;
  i int;
begin
  if p_revealed <= 0 then
    return 1;
  end if;
  for i in 0..p_revealed - 1 loop
    v := v * (25 - i)::numeric / (25 - p_mine_count - i)::numeric;
  end loop;
  return trunc(v * 0.99, 2);
end;
$$;

revoke all on function public.mines_multiplier(integer, integer) from public;
revoke all on function public.mines_multiplier(integer, integer) from anon, authenticated;
grant execute on function public.mines_multiplier(integer, integer) to service_role;

create or replace function public.start_mines_round(
  p_user uuid,
  p_stake numeric,
  p_mine_count int,
  p_mines jsonb,
  p_seed_hash text,
  p_client_seed text,
  p_nonce bigint,
  p_idempotency_key text
)
returns table (status text, round_id bigint, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stake numeric := round(coalesce(p_stake, 0), 8);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_id bigint;
  v_balance numeric;
  v_active bigint;
  r record;
begin
  if p_user is null then
    raise exception 'start_mines_round requires a user';
  end if;
  if v_stake <= 0 then
    raise exception 'start_mines_round requires a positive stake';
  end if;
  if p_mine_count is null or p_mine_count < 1 or p_mine_count > 24 then
    raise exception 'start_mines_round requires a valid mine count';
  end if;
  if v_key is null then
    v_key := 'mines:' || gen_random_uuid()::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select g.id into v_id from public.game_rounds g where g.idempotency_key = v_key;
  if found then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'duplicate'::text, v_id, coalesce(v_balance, 0);
    return;
  end if;

  select g.id into v_active from public.game_rounds g
   where g.user_id = p_user and g.status = 'active' limit 1;
  if found then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'active_exists'::text, v_active, coalesce(v_balance, 0);
    return;
  end if;

  begin
    select * into r from public.post_balance(
      p_user,
      -v_stake,
      'casino_stake',
      'game_round',
      v_key,
      'mines:stake:' || v_key,
      jsonb_build_object('game', 'mines', 'mines', p_mine_count)
    );
    if r.status <> 'applied' then
      return query select r.status, null::bigint, r.balance;
      return;
    end if;

    insert into public.game_rounds (
      user_id, game, stake, mine_count, mines, revealed, multiplier, payout, status,
      server_seed_hash, client_seed, nonce, idempotency_key
    ) values (
      p_user, 'mines', v_stake, p_mine_count, p_mines, '[]'::jsonb, 1, 0, 'active',
      p_seed_hash, p_client_seed, p_nonce, v_key
    )
    returning id into v_id;

    return query select 'applied'::text, v_id, r.balance;
  exception when unique_violation then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'active_exists'::text, null::bigint, coalesce(v_balance, 0);
  end;
end;
$$;

revoke all on function public.start_mines_round(uuid, numeric, integer, jsonb, text, text, bigint, text) from public;
revoke all on function public.start_mines_round(uuid, numeric, integer, jsonb, text, text, bigint, text) from anon, authenticated;
grant execute on function public.start_mines_round(uuid, numeric, integer, jsonb, text, text, bigint, text) to service_role;

create or replace function public.settle_mines_reveal(
  p_round_id bigint,
  p_user uuid,
  p_tile int,
  p_edge numeric default 0,
  p_max_win numeric default 0
)
returns table (
  status text,
  round_status text,
  revealed jsonb,
  mines jsonb,
  multiplier numeric,
  payout numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stake numeric;
  v_mine_count int;
  v_mines jsonb;
  v_revealed jsonb;
  v_round_status text;
  v_safe_total int;
  v_finished boolean;
  v_raw numeric;
  v_scaled numeric;
  v_multiplier numeric := 0;
  v_payout numeric := 0;
  v_balance numeric;
  r record;
begin
  select g.stake, g.mine_count, g.mines, g.revealed, g.status
    into v_stake, v_mine_count, v_mines, v_revealed, v_round_status
    from public.game_rounds g
   where g.id = p_round_id and g.user_id = p_user
   for update;

  if not found then
    return query select 'missing'::text, null::text, null::jsonb, null::jsonb, 0::numeric, 0::numeric, null::numeric;
    return;
  end if;

  select p.balance into v_balance from public.profiles p where p.id = p_user;

  if v_round_status <> 'active' then
    return query select
      'settled'::text,
      v_round_status,
      v_revealed,
      case when v_round_status in ('busted', 'cashed') then v_mines else null::jsonb end,
      (select g.multiplier from public.game_rounds g where g.id = p_round_id),
      (select g.payout from public.game_rounds g where g.id = p_round_id),
      coalesce(v_balance, 0);
    return;
  end if;

  if p_tile is null or p_tile < 0 or p_tile >= 25 then
    return query select 'invalid_tile'::text, 'active'::text, v_revealed, null::jsonb, 0::numeric, 0::numeric, coalesce(v_balance, 0);
    return;
  end if;

  if v_revealed @> jsonb_build_array(p_tile) then
    return query select 'already_revealed'::text, 'active'::text, v_revealed, null::jsonb, 0::numeric, 0::numeric, coalesce(v_balance, 0);
    return;
  end if;

  v_revealed := v_revealed || jsonb_build_array(p_tile);

  if v_mines @> jsonb_build_array(p_tile) then
    update public.game_rounds
       set revealed = v_revealed,
           status = 'busted',
           multiplier = 0,
           payout = 0,
           ended_at = now()
     where id = p_round_id;

    return query select 'applied'::text, 'busted'::text, v_revealed, v_mines, 0::numeric, 0::numeric, coalesce(v_balance, 0);
    return;
  end if;

  v_safe_total := 25 - v_mine_count;
  v_finished := jsonb_array_length(v_revealed) >= v_safe_total;
  v_raw := public.mines_multiplier(v_mine_count, jsonb_array_length(v_revealed));
  v_scaled := v_raw * (1 - greatest(0, least(coalesce(p_edge, 0), 50)) / 100.0);

  if v_finished then
    v_payout := trunc(v_stake * v_scaled, 8);
    if coalesce(p_max_win, 0) > 0 and v_payout > p_max_win then
      v_payout := trunc(p_max_win, 8);
    end if;
    v_multiplier := case when v_stake > 0 then v_payout / v_stake else 0 end;

    update public.game_rounds
       set revealed = v_revealed,
           status = 'cashed',
           multiplier = v_multiplier,
           payout = v_payout,
           ended_at = now()
     where id = p_round_id;

    if v_payout > 0 then
      select * into r from public.post_balance(
        p_user,
        v_payout,
        'casino_payout',
        'game_round',
        p_round_id::text,
        'mines:payout:' || p_round_id::text,
        jsonb_build_object('game', 'mines', 'stake', v_stake, 'payout', v_payout)
      );
      if r.status <> 'applied' then
        raise exception 'mines payout credit failed: %', r.status;
      end if;
      v_balance := r.balance;
    else
      select p.balance into v_balance from public.profiles p where p.id = p_user;
    end if;

    return query select 'applied'::text, 'cashed'::text, v_revealed, v_mines, v_multiplier, v_payout, coalesce(v_balance, 0);
    return;
  end if;

  update public.game_rounds
     set revealed = v_revealed,
         multiplier = v_scaled,
         payout = 0,
         status = 'active'
   where id = p_round_id;

  return query select 'applied'::text, 'active'::text, v_revealed, null::jsonb, v_scaled, 0::numeric, coalesce(v_balance, 0);
end;
$$;

revoke all on function public.settle_mines_reveal(bigint, uuid, integer, numeric, numeric) from public;
revoke all on function public.settle_mines_reveal(bigint, uuid, integer, numeric, numeric) from anon, authenticated;
grant execute on function public.settle_mines_reveal(bigint, uuid, integer, numeric, numeric) to service_role;

create or replace function public.settle_mines_cashout(
  p_round_id bigint,
  p_user uuid,
  p_edge numeric default 0,
  p_max_win numeric default 0
)
returns table (
  status text,
  round_status text,
  revealed jsonb,
  mines jsonb,
  multiplier numeric,
  payout numeric,
  balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stake numeric;
  v_mine_count int;
  v_mines jsonb;
  v_revealed jsonb;
  v_round_status text;
  v_raw numeric;
  v_scaled numeric;
  v_multiplier numeric := 0;
  v_payout numeric := 0;
  v_balance numeric;
  r record;
begin
  select g.stake, g.mine_count, g.mines, g.revealed, g.status
    into v_stake, v_mine_count, v_mines, v_revealed, v_round_status
    from public.game_rounds g
   where g.id = p_round_id and g.user_id = p_user
   for update;

  if not found then
    return query select 'missing'::text, null::text, null::jsonb, null::jsonb, 0::numeric, 0::numeric, null::numeric;
    return;
  end if;

  select p.balance into v_balance from public.profiles p where p.id = p_user;

  if v_round_status <> 'active' then
    return query select
      'settled'::text,
      v_round_status,
      v_revealed,
      v_mines,
      (select g.multiplier from public.game_rounds g where g.id = p_round_id),
      (select g.payout from public.game_rounds g where g.id = p_round_id),
      coalesce(v_balance, 0);
    return;
  end if;

  if jsonb_array_length(v_revealed) = 0 then
    return query select 'no_reveals'::text, 'active'::text, v_revealed, null::jsonb, 0::numeric, 0::numeric, coalesce(v_balance, 0);
    return;
  end if;

  v_raw := public.mines_multiplier(v_mine_count, jsonb_array_length(v_revealed));
  v_scaled := v_raw * (1 - greatest(0, least(coalesce(p_edge, 0), 50)) / 100.0);
  v_payout := trunc(v_stake * v_scaled, 8);
  if coalesce(p_max_win, 0) > 0 and v_payout > p_max_win then
    v_payout := trunc(p_max_win, 8);
  end if;
  v_multiplier := case when v_stake > 0 then v_payout / v_stake else 0 end;

  update public.game_rounds
     set status = 'cashed',
         multiplier = v_multiplier,
         payout = v_payout,
         ended_at = now()
   where id = p_round_id;

  if v_payout > 0 then
    select * into r from public.post_balance(
      p_user,
      v_payout,
      'casino_payout',
      'game_round',
      p_round_id::text,
      'mines:payout:' || p_round_id::text,
      jsonb_build_object('game', 'mines', 'stake', v_stake, 'payout', v_payout)
    );
    if r.status <> 'applied' then
      raise exception 'mines payout credit failed: %', r.status;
    end if;
    v_balance := r.balance;
  else
    select p.balance into v_balance from public.profiles p where p.id = p_user;
  end if;

  return query select 'applied'::text, 'cashed'::text, v_revealed, v_mines, v_multiplier, v_payout, coalesce(v_balance, 0);
end;
$$;

revoke all on function public.settle_mines_cashout(bigint, uuid, numeric, numeric) from public;
revoke all on function public.settle_mines_cashout(bigint, uuid, numeric, numeric) from anon, authenticated;
grant execute on function public.settle_mines_cashout(bigint, uuid, numeric, numeric) to service_role;

create or replace function public.start_crash_round(
  p_user uuid,
  p_stake numeric,
  p_crash_at numeric,
  p_seed_hash text,
  p_client_seed text,
  p_nonce bigint,
  p_idempotency_key text
)
returns table (status text, round_id bigint, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stake numeric := round(coalesce(p_stake, 0), 8);
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_id bigint;
  v_balance numeric;
  v_active bigint;
  r record;
begin
  if p_user is null then
    raise exception 'start_crash_round requires a user';
  end if;
  if v_stake <= 0 then
    raise exception 'start_crash_round requires a positive stake';
  end if;
  if p_crash_at is null or p_crash_at < 1 then
    raise exception 'start_crash_round requires a valid crash point';
  end if;
  if v_key is null then
    v_key := 'crash:' || gen_random_uuid()::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select c.id into v_id from public.crash_rounds c where c.idempotency_key = v_key;
  if found then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'duplicate'::text, v_id, coalesce(v_balance, 0);
    return;
  end if;

  select c.id into v_active from public.crash_rounds c
   where c.user_id = p_user and c.status = 'active' limit 1;
  if found then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'active_exists'::text, v_active, coalesce(v_balance, 0);
    return;
  end if;

  begin
    select * into r from public.post_balance(
      p_user,
      -v_stake,
      'casino_stake',
      'crash_round',
      v_key,
      'crash:stake:' || v_key,
      jsonb_build_object('game', 'crash', 'stake', v_stake)
    );
    if r.status <> 'applied' then
      return query select r.status, null::bigint, r.balance;
      return;
    end if;

    insert into public.crash_rounds (
      user_id, stake, crash_at, status, server_seed_hash, client_seed, nonce, idempotency_key
    ) values (
      p_user, v_stake, p_crash_at, 'active', p_seed_hash, p_client_seed, p_nonce, v_key
    )
    returning id into v_id;

    return query select 'applied'::text, v_id, r.balance;
  exception when unique_violation then
    select p.balance into v_balance from public.profiles p where p.id = p_user;
    return query select 'active_exists'::text, null::bigint, coalesce(v_balance, 0);
  end;
end;
$$;

revoke all on function public.start_crash_round(uuid, numeric, numeric, text, text, bigint, text) from public;
revoke all on function public.start_crash_round(uuid, numeric, numeric, text, text, bigint, text) from anon, authenticated;
grant execute on function public.start_crash_round(uuid, numeric, numeric, text, text, bigint, text) to service_role;

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
     and status = 'active';
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
  end if;

  select p.balance into v_balance from public.profiles p where p.id = p_user;
  return query select true, coalesce(v_balance, 0);
end;
$$;

revoke all on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) from public;
revoke all on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) from anon, authenticated;
grant execute on function public.settle_crash_round(bigint, uuid, text, numeric, numeric) to service_role;

create or replace function public.bootstrap_balance_ledger()
returns table (inserted int, already_tracked int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_skipped int := 0;
begin
  insert into public.balance_ledger
    (user_id, delta, balance_after, reason, ref_type, ref_id, idempotency_key, metadata)
  select
    p.id,
    p.balance,
    p.balance,
    'opening_balance',
    'bootstrap',
    '020',
    'opening:020:' || p.id::text,
    jsonb_build_object('source', 'migration_020')
  from public.profiles p
  where p.balance <> 0
    and not exists (
      select 1 from public.balance_ledger l where l.user_id = p.id
    );

  get diagnostics v_inserted = row_count;

  select count(*) into v_skipped
  from public.profiles p
  where p.balance <> 0
    and exists (
      select 1 from public.balance_ledger l where l.user_id = p.id
    );

  return query select v_inserted, v_skipped;
end;
$$;

revoke all on function public.bootstrap_balance_ledger() from public;
revoke all on function public.bootstrap_balance_ledger() from anon, authenticated;
grant execute on function public.bootstrap_balance_ledger() to service_role;

create or replace view public.balance_reconciliation as
select
  p.id as user_id,
  p.username,
  p.balance,
  coalesce(sum(l.delta), 0) as ledger_balance,
  p.balance - coalesce(sum(l.delta), 0) as drift,
  count(l.id) as entries,
  max(l.created_at) as last_entry
from public.profiles p
left join public.balance_ledger l on l.user_id = p.id
group by p.id, p.username, p.balance;

revoke all on public.balance_reconciliation from anon, authenticated;
grant select on public.balance_reconciliation to service_role;

create or replace function public.ledger_summary()
returns table (
  profiles int,
  entries bigint,
  total_balance numeric,
  ledger_balance numeric,
  drift numeric,
  drift_users int
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.balance_reconciliation),
    (select count(*) from public.balance_ledger),
    coalesce((select sum(balance) from public.balance_reconciliation), 0),
    coalesce((select sum(ledger_balance) from public.balance_reconciliation), 0),
    coalesce((select sum(drift) from public.balance_reconciliation), 0),
    (select count(*)::int from public.balance_reconciliation where abs(drift) > 0.00000001);
$$;

revoke all on function public.ledger_summary() from public;
revoke all on function public.ledger_summary() from anon, authenticated;
grant execute on function public.ledger_summary() to service_role;
