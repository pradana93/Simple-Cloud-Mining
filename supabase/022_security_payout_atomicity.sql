-- 022_security_payout_atomicity.sql
-- Close the remaining audit findings:
--   * atomic withdrawal settlement (no read-then-update race, idempotent refunds)
--   * a single-claim transition for automatic payouts
--   * RLS/grants on legacy tables and the IPN error log
--   * support for bounded 2FA verification attempts

-- ---------------------------------------------------------------------------
-- Legacy tables from the old CMS. The app no longer reads or writes them, so
-- they must not be reachable with the public anon/authenticated roles.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'addon_demo', 'addons', 'addons_menu', 'groups', 'profile_groups'
  ] loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = t and c.relkind = 'r'
    ) then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end;
$$;

-- The table is service-role only; broad client grants were left over from 007.
revoke all on public.ipn_errors from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Withdrawal settlement.
--
-- The row is locked and its state is checked in the same transaction as the
-- refund. A concurrent approve/reject therefore sees the committed state and
-- cannot credit the same withdrawal twice. Refunds use a deterministic ledger
-- key, so a retried call is a no-op instead of a second credit.
-- ---------------------------------------------------------------------------
create or replace function public.settle_withdrawal(
  p_id bigint,
  p_action text,
  p_tx text default null
)
returns table (status text, withdrawal_status text, balance numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_amount numeric;
  v_status text;
  v_balance numeric;
  v_action text := lower(btrim(coalesce(p_action, '')));
  r record;
begin
  select w.user_id, w.amount, upper(coalesce(w.status, ''))
    into v_user, v_amount, v_status
    from public.user_withdrawal w
   where w.id = p_id
   for update;

  if not found then
    return query select 'missing'::text, null::text, 0::numeric;
    return;
  end if;

  select p.balance into v_balance from public.profiles p where p.id = v_user;

  if v_status in ('SUCCESS', 'CANCELED') then
    return query select 'already_settled'::text, v_status, coalesce(v_balance, 0);
    return;
  end if;

  if v_action = 'approve' then
    update public.user_withdrawal
       set status = 'SUCCESS',
           tx = coalesce(nullif(btrim(coalesce(p_tx, '')), ''), tx),
           date_paid = now()
     where id = p_id;

    select p.balance into v_balance from public.profiles p where p.id = v_user;
    return query select 'applied'::text, 'SUCCESS'::text, coalesce(v_balance, 0);
    return;
  end if;

  if v_action in ('reject', 'cancel_refund') then
    -- A PROCESSING row may already have been sent to the wallet. Only an
    -- explicit external cancellation (IPN) may refund it.
    if v_action = 'reject' and v_status = 'PROCESSING' then
      return query select 'invalid_state'::text, v_status, coalesce(v_balance, 0);
      return;
    end if;

    update public.user_withdrawal
       set status = 'CANCELED',
           date_paid = now()
     where id = p_id;

    select * into r from public.post_balance(
      v_user,
      v_amount,
      'withdrawal_refund',
      'withdrawal',
      p_id::text,
      'withdrawal:refund:' || p_id::text,
      jsonb_build_object('amount', v_amount)
    );

    if r.status not in ('applied', 'duplicate', 'unchanged') then
      raise exception 'withdrawal refund failed: %', r.status;
    end if;

    return query select 'applied'::text, 'CANCELED'::text, r.balance;
    return;
  end if;

  raise exception 'invalid withdrawal action: %', p_action;
end;
$$;

revoke all on function public.settle_withdrawal(bigint, text, text) from public;
revoke all on function public.settle_withdrawal(bigint, text, text) from anon, authenticated;
grant execute on function public.settle_withdrawal(bigint, text, text) to service_role;

-- The payout worker claims a queued row before calling the wallet API. Only one
-- worker can move PENDING -> PROCESSING; the loser gets no row and sends nothing.
create or replace function public.claim_withdrawal_payout(p_id bigint)
returns table (status text, withdrawal_status text, user_id uuid, amount numeric, address text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_amount numeric;
  v_address text;
  v_status text;
begin
  update public.user_withdrawal as w
     set status = 'PROCESSING'
   where w.id = p_id
     and upper(coalesce(w.status, '')) = 'PENDING'
  returning w.user_id, w.amount, w.address, w.status
       into v_user, v_amount, v_address, v_status;

  if not found then
    select w.user_id, w.amount, w.address, upper(coalesce(w.status, ''))
      into v_user, v_amount, v_address, v_status
      from public.user_withdrawal w
     where w.id = p_id;
    return query select 'not_claimable'::text, v_status, v_user, v_amount, v_address;
    return;
  end if;

  return query select 'claimed'::text, v_status, v_user, v_amount, v_address;
end;
$$;

revoke all on function public.claim_withdrawal_payout(bigint) from public;
revoke all on function public.claim_withdrawal_payout(bigint) from anon, authenticated;
grant execute on function public.claim_withdrawal_payout(bigint) to service_role;

-- IPv4/IPv6 plus username keys are stored as text already. This index keeps the
-- 2FA/login throttles cheap as the attempt log grows.
create index if not exists idx_login_attempts_login_time
  on public.login_attempts(login, time);
create index if not exists idx_login_attempts_ip_time
  on public.login_attempts(ip_address, time);
