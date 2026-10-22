-- 031_paid_referral_bonus.sql
-- A one-time bonus to the referrer when a referred member's FIRST paid plan
-- activates. The rate lives in settings and defaults to 0, so nothing pays
-- until an admin sets it. Idempotent per referee: the key is
-- 'referral_bonus:<referee_id>', so a repeat IPN or a second paid plan cannot
-- pay again. Free signups never trigger it because they are not invoices.
-- Existing 2% commission on every paid invoice is unchanged.

alter table public.settings
  add column if not exists referral_bonus_percent numeric(6,2) not null default 0;

alter table public.settings
  drop constraint if exists settings_referral_bonus_percent_range;
alter table public.settings
  add constraint settings_referral_bonus_percent_range
  check (referral_bonus_percent >= 0 and referral_bonus_percent <= 100);

-- Ledger-side helper: the referrer gets the bonus on the referee's first
-- activated paid invoice. Returns the amount posted (0 if skipped).
create or replace function public.post_referral_bonus(
  p_referee uuid,
  p_referrer uuid,
  p_paid numeric,
  p_tx_id bigint
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pct numeric;
  v_amount numeric;
  v_prior int;
  v_result record;
begin
  if p_referrer is null or p_referrer = p_referee then
    return 0;
  end if;

  select s.referral_bonus_percent into v_pct from public.settings s order by s.id limit 1;
  if coalesce(v_pct, 0) <= 0 then
    return 0;
  end if;

  -- Only the referee's first paid invoice qualifies.
  select count(*) into v_prior
    from public.transactions_history t
   where t.user_id = p_referee
     and t.status = 'paid'
     and t.id <> p_tx_id;
  if v_prior > 0 then
    return 0;
  end if;

  v_amount := round(coalesce(p_paid, 0) * v_pct / 100.0, 8);
  if v_amount <= 0 then
    return 0;
  end if;

  select * into v_result from public.post_affiliate_commission(
    p_referrer,
    v_amount,
    'referral_bonus',
    p_tx_id::text,
    'referral_bonus:' || p_referee::text,
    jsonb_build_object('referee', p_referee, 'invoice', p_tx_id, 'percent', v_pct)
  );

  if v_result.status in ('applied', 'duplicate') then
    return v_amount;
  end if;
  return 0;
end;
$$;

revoke all on function public.post_referral_bonus(uuid, uuid, numeric, bigint) from public;
revoke all on function public.post_referral_bonus(uuid, uuid, numeric, bigint) from anon, authenticated;
grant execute on function public.post_referral_bonus(uuid, uuid, numeric, bigint) to service_role;
